import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a GitHub webhook HMAC-SHA256 signature.
 *
 * GitHub sends `X-Hub-Signature-256: sha256=<hex>`.
 * We recompute the HMAC over the raw body and compare
 * using timingSafeEqual to prevent timing attacks.
 */
export function verifyGitHubSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  const PREFIX = "sha256=";
  if (!signatureHeader.startsWith(PREFIX)) return false;

  const expected = Buffer.from(signatureHeader.slice(PREFIX.length), "hex");
  const computed = createHmac("sha256", secret).update(rawBody).digest();

  if (expected.length !== computed.length) return false;

  return timingSafeEqual(expected, computed);
}
