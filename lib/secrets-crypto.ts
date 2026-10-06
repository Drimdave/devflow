// Encryption for saved credentials: AES-256-GCM with a per-value random IV.
// Stored format:  v1.<iv>.<authTag>.<ciphertext>  (all base64url)
// The key comes from CREDENTIALS_KEY (32 random bytes, base64). Losing it makes saved values unreadable.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey(): Buffer {
    const raw = process.env.CREDENTIALS_KEY;
    if (!raw) throw new Error("CREDENTIALS_KEY is not set. Generate one with: openssl rand -base64 32");
    const key = Buffer.from(raw.trim(), "base64");
    if (key.length !== 32) throw new Error("CREDENTIALS_KEY must be 32 bytes, base64-encoded");
    return key;
}

export function encryptSecret(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(stored: string): string {
    const [v, iv, tag, data] = stored.split(".");
    if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised credential format");
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export const CREDENTIAL_NAME = /^[A-Z][A-Z0-9_]{1,39}$/;
