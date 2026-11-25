import { useEffect, useState } from "react";
import {
  changeOwnPassword,
  setMyDisplayName,
  trainerAdmin,
  listCoaches,
  setMyCoach,
  getSignupSettings,
  setSignupSettings,
  signUpWithInvite,
  type Profile,
  type Client,
  type Coach,
} from "./cloud";
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
export function TrainerAccounts() {
  const { run, notify } = useData();
  const [trainers, setTrainers] = useState<Trainer[] | null>(null);
  const [supportsFriends, setSupportsFriends] = useState(false);
  const [supportsRemoval, setSupportsRemoval] = useState(false);
  const [removeFor, setRemoveFor] = useState<Trainer | null>(null);
  const [removing, setRemoving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<Trainer | null>(null);
  const load = () =>
    trainerAdmin({ action: "list" })
      .then((d) => {
        setTrainers(d.trainers);
        setSupportsFriends(d.supportsFriends === true);
        setSupportsRemoval(d.supportsRemoval === true);
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
          {supportsRemoval && <button className="text-button danger-text" onClick={() => setRemoveFor(t)}>ลบบัญชี</button>}
        </div>
      ))}
      {removeFor && <Modal title="ลบบัญชีออกจากรายการ" close={() => { if (!removing) setRemoveFor(null); }}>
        <div className="form">
          <p><strong>{removeFor.displayName || removeFor.username}</strong> จะเข้าระบบไม่ได้และจะหายจากรายการบัญชี ประวัติการฝึกจะยังเก็บไว้</p>
          <button className="danger" disabled={removing} onClick={() => {
            setRemoving(true);
            void run(async () => {
              try {
                await trainerAdmin({ action: "remove", id: removeFor.id });
                setTrainers((accounts) => accounts?.filter((account) => account.id !== removeFor.id) ?? null);
                setRemoveFor(null);
              } finally {
                setRemoving(false);
              }
            }, "ลบบัญชีออกจากรายการแล้ว");
          }}>ยืนยันลบบัญชี</button>
          <button className="secondary" disabled={removing} onClick={() => setRemoveFor(null)}>ยกเลิก</button>
        </div>
      </Modal>}
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

export function EditDisplayName({ profile }: { profile: Profile }) {
  const { run } = useData();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-button" onClick={() => setOpen(true)}>
        เปลี่ยนชื่อที่แสดง
      </button>
      {open && (
        <Modal title="ชื่อที่แสดง" close={() => setOpen(false)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await setMyDisplayName(String(f.get("name")));
                setOpen(false);
              }, "บันทึกชื่อแล้ว โค้ชจะเห็นชื่อนี้หลังเปิดเว็บใหม่");
            }}
          >
            <label className="field">
              <span>ชื่อที่โค้ชและเพื่อนจะเห็น</span>
              <input name="name" required maxLength={80} defaultValue={profile.displayName.includes("@") ? "" : profile.displayName} />
            </label>
            <button className="primary">บันทึก</button>
          </form>
        </Modal>
      )}
    </>
  );
}

/** Coach: everyone who chose this coach, with a shortcut into their journal (read-only). */
export function MyClients({ clients, viewJournal }: { clients: Client[]; viewJournal: (client: Client) => void }) {
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>ลูกเทรนของฉัน ({clients.length})</h2>
          <p>คนที่เลือกคุณเป็นโค้ช · ดูข้อมูลได้อย่างเดียว</p>
        </div>
      </div>
      {!clients.length && (
        <p className="muted">ยังไม่มีลูกเทรน ลูกเทรนเลือกโค้ชได้เองที่ Settings → โค้ชของฉัน</p>
      )}
      {clients.map((c) => (
        <div className="trash-row" key={c.id}>
          <strong>ลูกเทรน {c.name}</strong>
          <button className="secondary" onClick={() => viewJournal(c)}>
            ดูข้อมูล
          </button>
        </div>
      ))}
    </section>
  );
}

/** Any member: choose which coaches may view your journal. */
export function MyCoaches() {
  const { run, notify } = useData();
  const [coaches, setCoaches] = useState<Coach[] | null>(null);
  const load = () =>
    listCoaches()
      .then(setCoaches)
      .catch((e) => {
        setCoaches([]);
        notify(e instanceof Error ? e.message : String(e));
      });
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>โค้ชของฉัน</h2>
          <p>เลือกโค้ชที่ดูแลคุณ โค้ชจะเห็นบันทึกของคุณได้อย่างเดียว แก้ไขไม่ได้ · เอาออกได้ทุกเมื่อ</p>
        </div>
      </div>
      {coaches === null && <p className="muted">กำลังโหลด…</p>}
      {coaches?.length === 0 && <p className="muted">ยังไม่มีบัญชีโค้ชในระบบ</p>}
      {coaches?.map((c) => (
        <label className="check-label coach-choice" key={c.id}>
          <input
            type="checkbox"
            checked={c.coachingMe}
            onChange={(e) => {
              const on = e.target.checked;
              void run(async () => {
                await setMyCoach(c.id, on);
                await load();
              }, on ? `โค้ช ${c.name} ดูข้อมูลของคุณได้แล้ว` : `เอาโค้ช ${c.name} ออกแล้ว`);
            }}
          />
          ฉันเป็นลูกเทรนของโค้ช {c.name}
        </label>
      ))}
    </section>
  );
}

const randomInvite = () => {
  const words = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)), (v) => words[v % words.length]).join("");
  return `LILLY-${pick(4)}-${pick(4)}`;
};

/** Owner: open or close self sign-up and set the invite code to share. */
export function SignupSettings() {
  const { run } = useData();
  const [state, setState] = useState<{ enabled: boolean; inviteCode: string } | null>(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    void getSignupSettings()
      .then((s) => {
        setState(s);
        setCode(s.inviteCode);
      })
      .catch(() => setState({ enabled: false, inviteCode: "" }));
  }, []);
  if (!state) return null;
  const apply = (enabled: boolean, next: string) =>
    run(async () => {
      await setSignupSettings(enabled, next);
      setState({ enabled, inviteCode: next });
      setCode(next);
    }, enabled ? "เปิดรับสมัครแล้ว ส่งรหัสเชิญให้เพื่อนได้เลย" : "ปิดรับสมัครแล้ว");
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>การสมัครสมาชิก</h2>
          <p>
            {state.enabled
              ? "เปิดรับสมัครอยู่ · เพื่อนสมัครเองได้ที่หน้าเข้าสู่ระบบโดยใช้รหัสเชิญ"
              : "ปิดรับสมัคร · มีแต่บัญชีที่สร้างแล้วเท่านั้นที่เข้าได้"}
          </p>
        </div>
      </div>
      <label className="field">
        <span>รหัสเชิญ (ส่งให้เฉพาะคนที่ชวน)</span>
        <input value={code} onChange={(e) => setCode(e.target.value.trim())} autoCapitalize="characters" spellCheck={false} />
      </label>
      <div className="upload-row">
        <button type="button" className="text-button" onClick={() => setCode(randomInvite())}>
          สุ่มรหัสใหม่
        </button>
        {state.enabled ? (
          <>
            <button className="secondary" onClick={() => apply(true, code)} disabled={code === state.inviteCode}>
              บันทึกรหัส
            </button>
            <button className="secondary" onClick={() => apply(false, code)}>
              ปิดรับสมัคร
            </button>
          </>
        ) : (
          <button className="primary" onClick={() => apply(true, code || randomInvite())}>
            เปิดรับสมัคร
          </button>
        )}
      </div>
      <p className="muted">
        บัญชีที่สมัครเองเป็น "เพื่อน" เห็นเครื่องและโปรแกรมกองกลาง และบันทึกของตัวเองเท่านั้น
        ส่วนบัญชีโค้ชสร้างได้จากหัวข้อบัญชีด้านล่าง เปลี่ยนรหัสเชิญเมื่อไหร่ รหัสเก่าก็ใช้สมัครไม่ได้ทันที
      </p>
    </section>
  );
}

export function SignupForm({ close, back, done }: { close: () => void; back: () => void; done: () => void }) {
  const { run } = useData();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="สมัครสมาชิก" close={close}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            if (f.get("password") !== f.get("again")) throw Error("รหัสผ่านสองช่องไม่ตรงกัน");
            setBusy(true);
            try {
              await signUpWithInvite({
                inviteCode: String(f.get("invite")).trim(),
                username: String(f.get("username")).trim().toLowerCase(),
                displayName: String(f.get("displayName")).trim(),
                password: String(f.get("password")),
              });
              done();
            } finally {
              setBusy(false);
            }
          }, "สมัครเรียบร้อย ยินดีต้อนรับค่ะ");
        }}
      >
        <label className="field">
          <span>รหัสเชิญ (ขอจากเจ้าของสมุด)</span>
          <input name="invite" required autoCapitalize="characters" spellCheck={false} autoComplete="off" />
        </label>
        <label className="field">
          <span>ชื่อที่แสดง</span>
          <input name="displayName" required maxLength={80} placeholder="ชื่อเล่น" />
        </label>
        <label className="field">
          <span>ชื่อผู้ใช้ (a-z 0-9 . _ - ยาว 3–32 ตัว ใช้ตอนเข้าสู่ระบบ)</span>
          <input
            name="username"
            required
            pattern="[a-zA-Z0-9._\-]{3,32}"
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>รหัสผ่าน (อย่างน้อย 8 ตัว)</span>
          <PasswordInput name="password" required minLength={8} maxLength={72} autoComplete="new-password" />
        </label>
        <label className="field">
          <span>ยืนยันรหัสผ่าน</span>
          <PasswordInput name="again" required minLength={8} maxLength={72} autoComplete="new-password" />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "กำลังสมัคร…" : "สมัครสมาชิก"}
        </button>
        <button type="button" className="text-button" onClick={back}>
          มีบัญชีแล้ว · เข้าสู่ระบบ
        </button>
        <p className="muted">ไม่ต้องใช้อีเมล · ลืมรหัสผ่านให้ติดต่อเจ้าของสมุดเพื่อตั้งรหัสใหม่</p>
      </form>
    </Modal>
  );
}
