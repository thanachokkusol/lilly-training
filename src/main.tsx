import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { exportBackup, download } from "./db";
import "./style.css";
class AppBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty" style={{ margin: "10vh auto", maxWidth: 540 }}>
        <h1>เปิดหน้านี้ไม่สำเร็จ</h1>
        <p>ข้อมูลที่บันทึกอยู่ในเครื่องยังคงอยู่ ลองเปิดใหม่หรือเก็บไฟล์สำรองไว้ก่อน</p>
        <div className="upload-row" style={{ justifyContent: "center" }}>
          <button className="primary" onClick={() => location.reload()}>
            เปิดใหม่
          </button>
          <button
            className="secondary"
            onClick={async () =>
              download(await exportBackup(), "lilly-recovery.zip")
            }
          >
            สำรองข้อมูล
          </button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppBoundary>
      <App />
    </AppBoundary>
  </React.StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(console.error);
  });
