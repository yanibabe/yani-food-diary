// Where Open Food Facts lookups go.
// - Development and tests: always the staging server (world.openfoodfacts.net).
// - Production: only the address set in config (OFF_BASE_URL). Without it, barcode lookups are off.
// The contact email (OFF_CONTACT_EMAIL) lives in .env.local / Vercel settings, never in git.

export const OFF_STAGING_URL = "https://world.openfoodfacts.net";
/** Staging is behind a public login (off/off) only to keep search engines out. */
export const OFF_STAGING_AUTH = "off:off";

export type OffConfig =
  | { ok: true; baseUrl: string; basicAuth: string | null; userAgent: string }
  | { ok: false; reason: "no-contact" | "no-base-url" };

type Env = Record<string, string | undefined>;

export function offConfig(env: Env, appVersion: string): OffConfig {
  const contact = env.OFF_CONTACT_EMAIL?.trim();
  if (!contact) return { ok: false, reason: "no-contact" };
  const isProduction = env.NODE_ENV === "production";
  const baseUrl = (isProduction ? env.OFF_BASE_URL?.trim() : OFF_STAGING_URL) || null;
  if (!baseUrl) return { ok: false, reason: "no-base-url" };
  const onStaging = new URL(baseUrl).host === new URL(OFF_STAGING_URL).host;
  return {
    ok: true,
    baseUrl,
    basicAuth: onStaging ? OFF_STAGING_AUTH : null,
    userAgent: `SnapCal/${appVersion} (${contact})`,
  };
}
