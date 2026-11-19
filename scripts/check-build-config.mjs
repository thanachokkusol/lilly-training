import { loadEnv } from "vite";
const e = loadEnv("production", process.cwd(), "VITE_");
const url = e.VITE_SUPABASE_URL,
  key = e.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!!url !== !!key)
  throw Error(
    "Set both Supabase URL and publishable key, or leave both empty for local mode.",
  );
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))
  throw Error("Invalid Supabase project URL");
if (key) {
  let valid = key.startsWith("sb_publishable_");
  if (key.startsWith("eyJ")) {
    try {
      valid =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role === "anon";
    } catch {
      valid = false;
    }
  }
  if (!valid)
    throw Error(
      "Refusing to build: only publishable/anon keys are allowed. Never bundle a secret/service_role key.",
    );
}
console.log(
  url
    ? "Cloud client configuration validated (public key only)."
    : "Local mode: no cloud credentials bundled.",
);
