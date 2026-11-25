import { useEffect, useState } from "react";
import { changeOwnPassword, trainerAdmin, type Profile } from "./cloud";
import { Modal, useData } from "./App";
import PasswordInput from "./PasswordInput";

type Trainer = {
  id: string;
  username: string;
  displayName: string;
  disabled: boolean;
  lastSignInAt: string | null;
  role?: "trainer" | "friend";
};
const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      }).format(new Date(iso))
    : "ยังไม่เคยเข้าใช้";

/** Owner-only: create trainer accounts with a username and password, reset or disable them. */
export function TrainerAccounts({ viewJournal }: { viewJournal: (client: { id: string; name: string }) => void }) {
  const { run, notify } = useData();
  const [trainers, setTrainers] = useState<Trainer[] | null>(null);
  const [supportsFriends, setSupportsFriends] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<Trainer | null>(null);
  const load = () =>
    trainerAdmin({ action: "list" })
      .then((d) => {
        setTrainers(d.trainers);
        setSupportsFriends(d.supportsFriends === true);
      })
      .catch((e) => {
        setTrainers([]);
        notify(e instanceof Error ? e.message : String(e));
      });
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>จัดการบัญชี</h2>
          <p>โค้ชดูสมุดของคุณได้ · เพื่อนใช้สมุดส่วนตัวของตัวเอง · ทั้งสองประเภทใช้คลังฝึกร่วมกัน</p>
        </div>
        <button className="secondary" onClick={() => setCreating(true)}>
          สร้างบัญชี
        </button>
      </div>
      {trainers === null && <p className="muted">กำลังโหลด…</p>}
      {trainers?.length === 0 && <p className="muted">ยังไม่มีบัญชีโค้ชหรือเพื่อน</p>}
      {trainers?.map((t) => (
        <div className="trash-row" key={t.id}>
          <div>
            <strong>
              {t.displayName} · {t.username}
            </strong>
            <p className="muted">
              {t.role === "friend" ? "เพื่อน" : "โค้ช"} · {t.disabled ? "ปิดบัญชีอยู่" : "ใช้งานอยู่"} · เข้าใช้ล่าสุด {when(t.lastSignInAt)}
            </p>
          </div>
          {supportsFriends && <button className="text-button" onClick={() => viewJournal({ id: t.id, name: t.displayName || t.username })}>ดูข้อมูลของคนนี้</button>}
          <button className="text-button" onClick={() => setResetFor(t)}>
            ตั้งรหัสใหม่
          </button>
          <button
            className="text-button"
            onClick={() =>
              run(async () => {
                await trainerAdmin({ action: "set_disabled", id: t.id, disabled: !t.disabled });
                await load();
              }, t.disabled ? "เปิดบัญชีแล้ว" : "ปิดบัญชีแล้ว เทรนเนอร์ดูข้อมูลไม่ได้ทันที")
            }
          >
            {t.disabled ? "เปิดบัญชี" : "ปิดบัญชี"}
          </button>
        </div>
      ))}
      {creating && (
        <Modal title="สร้างบัญชี" close={() => setCreating(false)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await trainerAdmin({
                  action: "create",
                  role: supportsFriends ? String(f.get("role")) : "trainer",
                  username: String(f.get("username")).trim().toLowerCase(),
                  displayName: String(f.get("displayName")).trim(),
                  password: String(f.get("password")),
                });
                setCreating(false);
                await load();
              }, "สร้างบัญชีแล้ว");
            }}
          >
            <label className="field"><span>ประเภทบัญชี</span>
              <select name="role"><option value="trainer">โค้ช</option>{supportsFriends && <option value="friend">เพื่อน</option>}</select>
            </label>
            <label className="field">
              <span>ชื่อที่แสดง</span>
              <input name="displayName" required maxLength={80} placeholder="เช่น โค้ชแบงค์" />
            </label>
            <label className="field">
              <span>ชื่อผู้ใช้ (a-z 0-9 . _ - ยาว 3–32 ตัว)</span>
              <input
                name="username"
                required
                pattern="[a-zA-Z0-9._\-]{3,32}"
                autoCapitalize="none"
                autoComplete="off"
                placeholder="เช่น coachbank"
              />
            </label>
            <label className="field">
              <span>รหัสผ่าน (อย่างน้อย 8 ตัว)</span>
              <PasswordInput name="password" required minLength={8} maxLength={72} autoComplete="new-password" />
            </label>
            <p className="muted">ไม่ต้องใช้อีเมลจริง เทรนเนอร์ล็อกอินด้วยชื่อผู้ใช้นี้</p>
            <button className="primary">สร้างบัญชี</button>
          </form>
        </Modal>
      )}
      {resetFor && (
        <Modal title={`ตั้งรหัสใหม่ · ${resetFor.username}`} close={() => setResetFor(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await trainerAdmin({ action: "set_password", id: resetFor.id, password: String(f.get("password")) });
                setResetFor(null);
              }, "ตั้งรหัสใหม่แล้ว");
            }}
          >
            <label className="field">
              <span>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</span>
              <PasswordInput name="password" required minLength={8} maxLength={72} autoComplete="new-password" />
            </label>
            <button className="primary">บันทึกรหัสใหม่</button>
          </form>
        </Modal>
      )}
    </section>
  );
}

export function ChangePassword({ profile }: { profile: Profile }) {
  const { run } = useData();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-button" onClick={() => setOpen(true)}>
        เปลี่ยนรหัสผ่าน
      </button>
      {open && (
        <Modal title="เปลี่ยนรหัสผ่าน" close={() => setOpen(false)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                if (f.get("next") !== f.get("again")) throw Error("รหัสผ่านใหม่สองช่องไม่ตรงกัน");
                await changeOwnPassword(String(f.get("current")), String(f.get("next")));
                setOpen(false);
              }, "เปลี่ยนรหัสผ่านแล้ว");
            }}
          >
            <p className="muted">บัญชี: {profile.username || profile.displayName}</p>
            <label className="field">
              <span>รหัสผ่านเดิม</span>
              <PasswordInput name="current" required autoComplete="current-password" />
            </label>
            <label className="field">
              <span>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</span>
              <PasswordInput name="next" required minLength={8} maxLength={72} autoComplete="new-password" />
            </label>
            <label className="field">
              <span>ยืนยันรหัสผ่านใหม่</span>
              <PasswordInput name="again" required minLength={8} maxLength={72} autoComplete="new-password" />
            </label>
            <button className="primary">เปลี่ยนรหัสผ่าน</button>
          </form>
        </Modal>
      )}
    </>
  );
}
