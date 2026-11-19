import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
const url = "http://127.0.0.1:5173/";
async function status() {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return (await r.text()).includes("<title>Lilly Training");
  } catch {
    return false;
  }
}
if (!fs.existsSync(new URL("../dist/index.html", import.meta.url))) {
  console.error("ยังไม่มีไฟล์เว็บ กรุณารัน npm install และ npm run build ก่อน");
  process.exit(1);
}
if (!(await status())) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./serve.mjs", import.meta.url))],
    { detached: true, windowsHide: true, stdio: "ignore" },
  );
  child.unref();
  for (let i = 0; i < 30 && !(await status()); i++)
    await new Promise((r) => setTimeout(r, 200));
}
if (!(await status())) {
  console.error("เปิดเว็บไม่ได้ ตรวจว่าพอร์ต 5173 ถูกใช้งานโดยโปรแกรมอื่นหรือไม่");
  process.exit(1);
}
if (process.platform === "win32")
  spawn("cmd.exe", ["/d", "/c", "start", "", url], {
    windowsHide: true,
    stdio: "ignore",
  }).unref();
else console.log(url);
