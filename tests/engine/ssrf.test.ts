import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { isPrivateAddress, safeFetch } from "../../lib/engine/safe-fetch";

const PRIVATE = [
    // IPv4
    "0.0.0.0", "10.0.0.1", "127.0.0.1", "127.255.255.254", "100.64.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.0.0.1", "192.0.2.5", "192.168.1.1", "198.18.0.1", "198.51.100.7", "203.0.113.9", "224.0.0.1", "255.255.255.255",
    // IPv6 basics
    "::", "::1", "0:0:0:0:0:0:0:1", "fe80::1", "fe80::abcd:1%eth0", "fec0::1", "fc00::1", "fd12:3456::1", "ff02::1",
    // IPv6 forms that embed a private IPv4: the bypass that used to work
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "::ffff:a9fe:a9fe", "::ffff:10.0.0.1", "::ffff:c0a8:101",
    "0:0:0:0:0:ffff:7f00:1", "::127.0.0.1", "::7f00:1", "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "64:ff9b:1::1",
    "2002:7f00:1::", "2002:a9fe:a9fe::1", "2002:0a00:0001::", "2001:0:4136:e378:8000:63bf:3fff:fdd2", "2001:db8::1", "100::1",
    // not an IP at all
    "not-an-ip", "",
];
const PUBLIC = ["8.8.8.8", "1.1.1.1", "93.184.216.34", "192.0.78.1", "172.32.0.1", "172.15.255.255", "100.63.255.255", "100.128.0.1",
    "2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "::ffff:808:808", "64:ff9b::808:808", "2002:808:808::1"];

test("every private or embedded-private address form is refused", () => {
    for (const ip of PRIVATE) assert.equal(isPrivateAddress(ip), true, `should be private: ${ip}`);
});

test("public addresses are allowed, including ones near private ranges", () => {
    for (const ip of PUBLIC) assert.equal(isPrivateAddress(ip), false, `should be public: ${ip}`);
});

test("safeFetch can't reach a live local server through any address spelling", async () => {
    const server = http.createServer((_, res) => res.end("INTERNAL-SECRET")).listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const port = (server.address() as any).port;
    try {
        for (const host of ["127.0.0.1", "127.1", "2130706433", "0x7f000001", "0177.0.0.1", "[::ffff:127.0.0.1]", "[::ffff:7f00:1]", "[0:0:0:0:0:ffff:7f00:1]", "[::127.0.0.1]", "[64:ff9b::7f00:1]", "[2002:7f00:1::]", "localhost", "localhost.", "LOCALHOST", "foo.localhost"]) {
            await assert.rejects(safeFetch(`http://${host}:${port}/`, { timeoutMs: 2000 }), (e: Error) => !/INTERNAL-SECRET/.test(e.message), `reachable via ${host}`);
        }
    } finally {
        server.close();
    }
});

test("internal-looking hostnames are refused up front", async () => {
    for (const host of ["metadata.google.internal", "printer.local", "db.internal"]) {
        await assert.rejects(safeFetch(`http://${host}/`, { timeoutMs: 2000 }), /localhost|blocked/i, host);
    }
});
