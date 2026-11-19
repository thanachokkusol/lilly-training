import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
const check = (url: string, key: string) =>
  spawnSync(process.execPath, ["scripts/check-build-config.mjs"], {
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
    },
  });
it("refuses to bundle a secret service key", () => {
  expect(
    check("https://example.supabase.co", "sb_secret_synthetic_not_a_real_key")
      .status,
  ).not.toBe(0);
});
it("accepts a public-key-only client configuration", () => {
  expect(
    check(
      "https://example.supabase.co",
      "sb_publishable_synthetic_not_a_real_key",
    ).status,
  ).toBe(0);
});
it("does not silently build a half-configured cloud client", () => {
  expect(check("https://example.supabase.co", "").status).not.toBe(0);
});
