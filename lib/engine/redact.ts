// Scrubs saved credential values out of anything a run reports (outputs, logs, errors, history).

const MASK = "••••••";
const MIN_SECRET_LENGTH = 6; // shorter values would mangle ordinary text when scrubbed

/** Builds a function that replaces every secret value (plain or JSON-escaped) inside any value. */
export function makeRedactor(secrets: Record<string, string>) {
    const needles = new Set<string>();
    for (const v of Object.values(secrets)) {
        if (typeof v !== "string" || v.length < MIN_SECRET_LENGTH) continue;
        // Every spelling a value can take once it has travelled through a URL, form, header or JSON body
        const forms = [
            v,
            JSON.stringify(v).slice(1, -1),                       // JSON-escaped
            encodeURIComponent(v),                                // %20, %2F, ...
            encodeURI(v),
            encodeURIComponent(v).replace(/%20/g, "+"),           // form encoding
            encodeURIComponent(v).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase()), // lower-case percent escapes
            Buffer.from(v, "utf8").toString("base64"),            // Basic-auth style
            Buffer.from(v, "utf8").toString("base64url"),
        ];
        for (const f of forms) if (f.length >= MIN_SECRET_LENGTH) needles.add(f);
    }
    const list = [...needles].sort((a, b) => b.length - a.length);
    const str = (s: string) => list.reduce((acc, n) => acc.split(n).join(MASK), s);
    return {
        str,
        any<T>(value: T): T {
            if (!list.length || value === undefined || value === null) return value;
            if (typeof value === "string") return str(value) as T;
            try {
                return JSON.parse(str(JSON.stringify(value))) as T;
            } catch {
                return value;
            }
        },
    };
}

