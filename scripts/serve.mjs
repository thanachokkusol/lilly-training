import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".wasm": "application/wasm",
};
const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  if (req.url === "/health.json") {
    res.setHeader("Content-Type", "application/json");
    res.end('{"app":"lilly-training"}');
    return;
  }
  try {
    const u = new URL(req.url, "http://localhost");
    const pathname = decodeURIComponent(u.pathname);
    const target = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (
      !target.startsWith(root) ||
      !fs.existsSync(target) ||
      !fs.statSync(target).isFile()
    ) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.setHeader(
      "Content-Type",
      types[path.extname(target)] ?? "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Cache-Control",
      path.extname(target) === ".html" || target.endsWith("sw.js")
        ? "no-cache"
        : "public,max-age=3600",
    );
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(target).pipe(res);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
  }
});
server.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
server.listen(5173, "127.0.0.1", () =>
  console.log("Lilly Training: http://127.0.0.1:5173/"),
);
