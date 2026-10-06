import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

// An HTTP client for workflow nodes. Users type the URL, and it runs on OUR server, so without
// guards a workflow could be pointed at localhost, the cloud metadata service, or our database
// network (SSRF). Defence in depth here:
//   1. only http/https
//   2. every address the hostname resolves to is checked AT CONNECT TIME (no DNS-rebinding gap)
//   3. IP-literal URLs are checked up front
//   4. redirects are followed manually and re-checked each hop
//   5. a hard timeout and a response-size cap

export class BlockedRequestError extends Error {}

function isPrivateIPv4Bytes(a: number, b: number, c: number): boolean {
    return (
        a === 0 || a === 10 || a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||        // CGNAT
        (a === 169 && b === 254) ||                  // link-local, cloud metadata
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF protocol assignments, TEST-NET-1
        (a === 192 && b === 88 && c === 99) ||       // 6to4 relay
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||     // benchmarking
        (a === 198 && b === 51 && c === 100) ||      // TEST-NET-2
        (a === 203 && b === 0 && c === 113) ||       // TEST-NET-3
        a >= 224                                     // multicast, reserved, broadcast
    );
}

/** Parse any IPv6 text form (compressed, mixed dotted-quad, zone id) into its 16 bytes. */
function parseIPv6(input: string): number[] | null {
    let ip = input.toLowerCase().split("%")[0];
    let tail: number[] = [];
    const dotted = ip.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (dotted) {
        const parts = dotted.slice(1).map(Number);
        if (parts.some((n) => n > 255)) return null;
        tail = parts;
        ip = ip.slice(0, ip.length - dotted[0].length) + "0:0";
    }
    const halves = ip.split("::");
    if (halves.length > 2) return null;
    const toGroups = (t: string) => (t === "" ? [] : t.split(":"));
    const head = toGroups(halves[0]);
    const rest = halves.length === 2 ? toGroups(halves[1]) : [];
    const missing = 8 - head.length - rest.length;
    if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
    const groups = halves.length === 1 ? head : [...head, ...Array(missing).fill("0"), ...rest];
    const bytes: number[] = [];
    for (const g of groups) {
        if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
        const n = parseInt(g, 16);
        bytes.push(n >> 8, n & 255);
    }
    if (tail.length) bytes.splice(12, 4, ...tail);
    return bytes.length === 16 ? bytes : null;
}

/**
 * True for loopback, private, link-local, CGNAT, multicast, unspecified and reserved addresses, including
 * IPv6 forms that embed an IPv4 address (mapped ::ffff:a.b.c.d, NAT64, 6to4, IPv4-compatible).
 * Anything that isn't a valid IP counts as private (refuse).
 */
export function isPrivateAddress(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const [a, b, c] = ip.split(".").map(Number);
        return isPrivateIPv4Bytes(a, b, c);
    }
    if (!net.isIPv6(ip)) return true;
    const x = parseIPv6(ip);
    if (!x) return true;
    const v4 = (i: number) => isPrivateIPv4Bytes(x[i], x[i + 1], x[i + 2]);
    const zeros = (from: number, to: number) => x.slice(from, to).every((n) => n === 0);

    if (zeros(0, 12)) return true;                                   // ::/96: unspecified, loopback, IPv4-compatible (all non-routable)
    if (zeros(0, 10) && x[10] === 0xff && x[11] === 0xff) return v4(12);  // ::ffff:0:0/96 IPv4-mapped
    if (zeros(0, 8) && x[8] === 0xff && x[9] === 0xff && x[10] === 0 && x[11] === 0) return v4(12); // ::ffff:0:a.b.c.d (SIIT)
    if (x[0] === 0x00 && x[1] === 0x64 && x[2] === 0xff && x[3] === 0x9b) {
        if (zeros(4, 12)) return v4(12);                             // 64:ff9b::/96 NAT64
        if (x[4] === 0x00 && x[5] === 0x01) return true;             // 64:ff9b:1::/48 local-use NAT64
    }
    if (x[0] === 0x20 && x[1] === 0x02) return isPrivateIPv4Bytes(x[2], x[3], x[4]); // 2002::/16 6to4
    if (x[0] === 0x20 && x[1] === 0x01 && x[2] === 0x00 && x[3] === 0x00) return true; // 2001::/32 Teredo
    if (x[0] === 0x20 && x[1] === 0x01 && x[2] === 0x0d && x[3] === 0xb8) return true; // 2001:db8::/32 documentation
    if (x[0] === 0x01 && x[1] === 0x00 && zeros(2, 8)) return true;  // 100::/64 discard
    if ((x[0] & 0xfe) === 0xfc) return true;                         // fc00::/7 unique local
    if (x[0] === 0xfe && (x[1] & 0xc0) === 0x80) return true;        // fe80::/10 link-local
    if (x[0] === 0xfe && (x[1] & 0xc0) === 0xc0) return true;        // fec0::/10 site-local
    if (x[0] === 0xff) return true;                                  // ff00::/8 multicast
    return false;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

function guardedLookup(hostname: string, options: dns.LookupOptions, cb: LookupCb) {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return cb(err, "", 4);
        const list = addresses as dns.LookupAddress[];
        if (!list.length) return cb(new Error("No address found"), "", 4);
        const bad = list.find((a) => isPrivateAddress(a.address));
        if (bad) return cb(new BlockedRequestError(`Blocked: ${hostname} resolves to a private address`), "", 4);
        if (options.all) return cb(null, list);
        cb(null, list[0].address, list[0].family);
    });
}

export interface SafeFetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
}

export interface SafeFetchResult {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    truncated: boolean;
    url: string;
}

function assertAllowedUrl(raw: string): URL {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new BlockedRequestError(`"${raw}" isn't a valid URL`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedRequestError("Only http and https URLs are allowed");
    const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (!host || host.toLowerCase() === "localhost" || host.toLowerCase().endsWith(".localhost") || host.toLowerCase().endsWith(".internal") || host.toLowerCase().endsWith(".local")) throw new BlockedRequestError("Requests to localhost are blocked");
    if (net.isIP(host) && isPrivateAddress(host)) throw new BlockedRequestError("Requests to private network addresses are blocked");
    return url;
}

function once(url: URL, opts: Required<Pick<SafeFetchOptions, "method" | "timeoutMs" | "maxBytes">> & { headers: Record<string, string>; body?: string }): Promise<SafeFetchResult & { location?: string }> {
    return new Promise((resolve, reject) => {
        const lib = url.protocol === "https:" ? https : http;
        const req = lib.request(
            url,
            { method: opts.method, headers: opts.headers, lookup: guardedLookup as any, timeout: opts.timeoutMs },
            (res) => {
                const chunks: Buffer[] = [];
                let size = 0;
                let truncated = false;
                res.on("data", (c: Buffer) => {
                    size += c.length;
                    if (size > opts.maxBytes) {
                        truncated = true;
                        chunks.push(c.subarray(0, Math.max(0, c.length - (size - opts.maxBytes))));
                        res.destroy();
                        return;
                    }
                    chunks.push(c);
                });
                const done = () => {
                    const headers: Record<string, string> = {};
                    for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(", ") : String(v);
                    resolve({
                        status: res.statusCode ?? 0,
                        statusText: res.statusMessage ?? "",
                        headers,
                        body: Buffer.concat(chunks).toString("utf8"),
                        truncated,
                        url: url.toString(),
                        location: headers.location,
                    });
                };
                res.on("end", done);
                res.on("close", () => { if (truncated) done(); });
                res.on("error", (e) => (truncated ? done() : reject(e)));
            }
        );
        req.on("timeout", () => req.destroy(new Error(`Timed out after ${Math.round(opts.timeoutMs / 1000)}s`)));
        req.on("error", reject);
        if (opts.body) req.write(opts.body);
        req.end();
    });
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
    const method = (options.method ?? "GET").toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method)) throw new BlockedRequestError(`Method ${method} isn't supported`);

    const maxRedirects = options.maxRedirects ?? 3;
    const headers: Record<string, string> = { "user-agent": "DevFlow/0.1 (+workflow automation)", accept: "*/*", ...lowerKeys(options.headers) };
    if (options.body && !headers["content-length"]) headers["content-length"] = String(Buffer.byteLength(options.body));

    let url = assertAllowedUrl(rawUrl);
    let currentMethod = method;
    let body = options.body;

    for (let hop = 0; hop <= maxRedirects; hop++) {
        const res = await once(url, {
            method: currentMethod,
            headers,
            body,
            timeoutMs: options.timeoutMs ?? 10_000,
            maxBytes: options.maxBytes ?? 256 * 1024,
        });
        if (res.status >= 300 && res.status < 400 && res.location) {
            if (hop === maxRedirects) throw new BlockedRequestError("Too many redirects");
            const next = assertAllowedUrl(new URL(res.location, url).toString()); // re-checked every hop
            if (next.host !== url.host) {
                // Never carry credentials to a different host: keep only harmless headers, and no request body
                for (const k of Object.keys(headers)) if (!SAFE_REDIRECT_HEADERS.has(k)) delete headers[k];
                if (body && (res.status === 307 || res.status === 308)) throw new BlockedRequestError("Refusing to re-send the request body to a different host after a redirect");
                body = undefined;
                delete headers["content-length"];
                delete headers["content-type"];
            }
            url = next;
            if (res.status === 303 || ((res.status === 301 || res.status === 302) && currentMethod === "POST")) {
                currentMethod = "GET";
                body = undefined;
                delete headers["content-length"];
            }
            continue;
        }
        const { location: _l, ...rest } = res;
        return rest;
    }
    throw new BlockedRequestError("Too many redirects");
}

const SAFE_REDIRECT_HEADERS = new Set(["user-agent", "accept", "accept-language", "content-type", "content-length"]);

function lowerKeys(h?: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(h ?? {})) out[k.toLowerCase()] = String(v);
    return out;
}
