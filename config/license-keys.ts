/**
 * The license public keys a release build trusts, from the `LICENSE_TRUSTED_KEYS` build variable (a
 * GitHub Actions repository variable in CI): `<kid>:<base64url 32-byte Ed25519 public key>`,
 * comma-separated, e.g. `p1:-YX2cB…`. The portal (my-account) holds the matching private keys.
 *
 * A release build gets them injected as `__LICENSE_TRUSTED_KEYS__` (see `packages/sdk/src/license/keys.ts`),
 * and fails without the variable rather than publishing an SDK that rejects every key. A workspace
 * build gets them only if the variable is set (e.g. `d1:…` to verify beta-portal keys locally);
 * otherwise none, and it checks no signatures.
 *
 * To rotate: add the new key to the variable (`p1:…,p2:…`), release the SDK, then start signing with
 * it in the portal. Remove the old key once the last token it signed has expired.
 */

/** Parses `<kid>:<key>[,<kid>:<key>…]`, refusing anything that is not a 32-byte public key. */
export function parseLicenseKeys(value: string): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const entry of value.split(',').map(part => part.trim()).filter(Boolean)) {
    const match = /^([a-z][a-z0-9]{0,7}):([A-Za-z0-9_-]{43})$/.exec(entry);
    if (!match || Buffer.from(match[2], 'base64url').length !== 32) {
      throw new Error(`LICENSE_TRUSTED_KEYS: '${entry.slice(0, 12)}…' is not '<kid>:<43-character base64url public key>'.`);
    }
    keys[match[1]] = match[2];
  }
  if (Object.keys(keys).length === 0) throw new Error('LICENSE_TRUSTED_KEYS has no keys.');
  return keys;
}

/** The `define` entries for a build: the trusted keys, required for a release and optional otherwise. */
export function licenseKeysDefine(release: boolean): Record<string, string> {
  const value = process.env.LICENSE_TRUSTED_KEYS;
  if (!value) {
    if (release) throw new Error('LICENSE_TRUSTED_KEYS must be set for a release build (see config/license-keys.ts).');
    return {};
  }
  return { __LICENSE_TRUSTED_KEYS__: JSON.stringify(parseLicenseKeys(value)) };
}
