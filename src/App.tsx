import {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  lazy,
  Suspense,
} from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  Dumbbell,
  Flame,
  History,
  ImagePlus,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  X,
  Camera,
  Download,
  Copy,
  Footprints,
  Scale,
  RefreshCw,
} from "lucide-react";

import type {
  Entry,
  Machine,
  Session,
  ExerciseLog,
  SetLog,
  Cardio,
  Body,
} from "./types";
import {
  sandbox,
  allEntries,
  save,
  trash,
  restoreEntry,
  addPhoto,
  photoBlob,
  exportBackup,
  exportCSV,
  importBackup,
  inspectBackup,
  download,
} from "./db";
import {
  today,
  weekOf,
  addDays,
  dateLabel,
  duration,
  timeInput,
  parseTime,
  loadLabel,
  formatSet,
  latestExercise,
  cardioTotals,
  coachMessage,
  ocrCandidates,
  minuteDuration,
  machineHistory,
  bestSet,
  hasLoad,
  weightLines,
} from "./core";
import { cloud, config, configure, sync, resolveConflict } from "./cloud";
const Progress = lazy(() => import("./Progress"));
type Context = {
  entries: Entry[];
  refresh: () => Promise<void>;
  run: (fn: () => Promise<unknown>, msg?: string) => Promise<void>;
  notify: (m: string) => void;
};
const Data = createContext<Context>(null!);
export const useData = () => useContext(Data);
const number = (v: FormDataEntryValue | null) =>
  v === null || v === "" ? null : Number(v);
const uid = () => crypto.randomUUID();
const longDate = (d: string) =>
  new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(d + "T12:00:00Z"));
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(d + "T12:00:00Z"));
function exerciseFor(machine: Entry): ExerciseLog {
  const m = machine.data as Machine;
  return {
    machineId: machine.id,
    setup: m.setup,
    loadMode: m.loadMode,
    note: "",
    sets: [{ id: uid(), load: null, reps: null, warmup: false, done: false }],
  };
}
function newSession(
  title: string,
  machineIds: string[],
  entries: Entry[],
  date = today(),
): Session {
  return {
    date,
    title,
    status: "draft",
    note: "",
    exercises: machineIds.flatMap((id) => {
      const m = entries.find((e) => e.id === id && e.kind === "machine");
      return m ? [exerciseFor(m)] : [];
    }),
  };
}
function Photo({
  id,
  alt,
  className = "",
}: {
  id?: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState("");
  const { entries } = useData();
  const revision = entries.find(
    (e) => e.id === id && e.kind === "photo",
  )?.updatedAt;
  useEffect(() => {
    let alive = true,
      url = "";
    setSrc("");
    if (id)
      photoBlob(id).then((b) => {
        if (b && alive) {
          url = URL.createObjectURL(b);
          setSrc(url);
        }
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, revision]);
  return src ? (
    <img className={className} src={src} alt={alt} />
  ) : (
    <div className={`photo-empty ${className}`}>
      <Dumbbell size={36} />
      <span>เพิ่มรูปเครื่องของคุณ</span>
    </div>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,a,[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      old?.focus();
    };
  }, []);
  return (
    <div className="backdrop" onClick={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" onClick={close} aria-label="ปิด">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Header({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function Empty({
  text,
  action,
}: {
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Activity />
      <p>{text}</p>
      {action}
    </div>
  );
}
function Ring({ value, size = 110 }: { value: number; size?: number }) {
  const p = Math.min(100, value);
  return (
    <div
      className="ring"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--lime) ${p}%,#ffffff20 0)`,
      }}
    >
      <div>
        <strong>
          {value.toFixed(1)}
          <small>%</small>
        </strong>
        <span>ของเป้าหมาย</span>
      </div>
    </div>
  );
}
function useNavigate() {
  const [page, setPage] = useState(location.hash.slice(1) || "today");
  useEffect(() => {
    const listener = () => setPage(location.hash.slice(1) || "today");
    window.addEventListener("hashchange", listener);
    window.addEventListener("popstate", listener);
    history.scrollRestoration = "manual";
    return () => {
      window.removeEventListener("hashchange", listener);
      window.removeEventListener("popstate", listener);
    };
  }, []);
  return [
    page,
    (p: string) => {
      history.pushState(null, "", `#${p}`);
      setPage(p);
      window.scrollTo(0, 0);
    },
  ] as const;
}
export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]),
    [loaded, setLoaded] = useState(false),
    [toast, setToast] = useState(""),
    [page, nav] = useNavigate(),
    [online, setOnline] = useState(navigator.onLine),
    [busy, setBusy] = useState(false),
    [login, setLogin] = useState(false),
    [authUser, setAuthUser] = useState<string | null>(
      config() ? null : "local",
    );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const refresh = async () => {
    setEntries(await allEntries());
    setLoaded(true);
  };
  const notify = (s: string) => {
    setToast(s);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6000);
  };
  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      await refresh();
      if (msg) notify(msg);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    }
  };
  const synchronize = async (silent = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await sync();
      await refresh();
      if (!silent)
        notify(
          `ซิงก์แล้ว · ส่ง ${r.pushed} รายการ${r.conflicts ? ` · รอเลือกฉบับ ${r.conflicts} รายการ` : ""}`,
        );
    } catch (e) {
      if (!silent) notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void refresh();
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      clearTimeout(toastTimer.current);
    };
  }, []);
  const cloudUrl = config()?.url,
    cloudKey = config()?.key;
  useEffect(() => {
    if (!config()) {
      setAuthUser("local");
      return;
    }
    let live = true,
      generation = 0,
      unsubscribe = () => {};
    const verify = (session: any) => {
      const n = ++generation;
      if (!session) {
        const cachedId = localStorage.getItem("lilly-owner");
        setAuthUser(
          !navigator.onLine &&
            localStorage.getItem("lilly-locked") !== "true" &&
            localStorage.getItem("lilly-owner-project") === cloudUrl
            ? (cachedId ?? "")
            : "",
        );
        return;
      }
      setAuthUser(null);
      setTimeout(async () => {
        if (!live || n !== generation) return;
        const cached =
          localStorage.getItem("lilly-owner") === session.user.id &&
          localStorage.getItem("lilly-owner-project") === cloudUrl &&
          localStorage.getItem("lilly-locked") !== "true";
        if (!navigator.onLine) {
          setAuthUser(cached ? session.user.id : "");
          return;
        }
        try {
          const c = (await cloud())!;
          const { data, error } = await c.rpc("is_training_owner");
          if (live && n === generation) {
            if (!error && data === true)
              localStorage.removeItem("lilly-locked");
            setAuthUser(!error && data === true ? session.user.id : "");
          }
        } catch {
          if (live && n === generation)
            setAuthUser(cached ? session.user.id : "");
        }
      }, 0);
    };
    void cloud().then(async (c) => {
      if (!c || !live) return;
      const { data } = await c.auth.getSession();
      if (live) verify(data.session);
      const {
        data: { subscription },
      } = c.auth.onAuthStateChange((_event, session) => {
        if (live) verify(session);
      });
      unsubscribe = () => subscription.unsubscribe();
      if (!live) unsubscribe();
    });
    return () => {
      live = false;
      generation++;
      unsubscribe();
    };
  }, [cloudUrl, cloudKey, online]);
  useEffect(() => {
    if (!online || !config() || !authUser || authUser === "local") return;
    const t = setInterval(() => {
      void synchronize(true);
    }, 30000);
    void synchronize(true);
    return () => clearInterval(t);
  }, [online, cloudUrl, authUser]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);
  const pending = entries.filter((e) => e.dirty).length;
  const tabs = [
    ["today", "วันนี้", LayoutDashboard],
    ["machines", "เครื่องและท่า", Dumbbell],
    ["cardio", "คาร์ดิโอ", Footprints],
    ["progress", "ความก้าวหน้า", TrendingUp],
    ["history", "ประวัติ", History],
    ["settings", "ตั้งค่า", Settings],
  ] as const;
  const short: Record<string, string> = {
    machines: "เครื่อง",
    progress: "สถิติ",
  };
  return (
    <Data.Provider value={{ entries, refresh, run, notify }}>
      <div className="app">
        <aside className="sidebar">
          <a className="brand" href="#today">
            <span className="brand-mark">
              L<span>•</span>
            </span>
            <div>
              Lilly<span>TRAINING JOURNAL</span>
            </div>
          </a>
          <nav>
            {tabs.map(([key, label, Icon]) => (
              <button
                key={key}
                className={page.split("#")[0] === key ? "active" : ""}
                onClick={() => nav(key)}
              >
                <Icon size={20} />
                {label}
                {page === key && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className="profile" onClick={() => nav("settings")}>
              <span className="avatar">L</span>
              <div>
                บัญชีและข้อมูล<small>ซิงก์ · สำรองข้อมูล</small>
              </div>
              <Settings size={17} />
            </button>
          </div>
        </aside>
        <main>
          <div className="topbar">
            <span className="top-brand">
              Lilly <small>TRAINING</small>
            </span>
            <span className="top-date">{dateLabel(today())}</span>
            <button
              className="sync-status"
              onClick={() => (config() ? synchronize() : nav("settings"))}
            >
              {online ? <Cloud size={16} /> : <CloudOff size={16} />}
              <span>
                {busy
                  ? "กำลังซิงก์…"
                  : !config()
                    ? "เก็บในเครื่องนี้"
                    : pending
                      ? `รอซิงก์ ${pending}`
                      : "พร้อมซิงก์"}
              </span>
            </button>
          </div>
          <div className="content">
            {sandbox && (
              <div className="notice">พื้นที่ทดสอบ · ข้อมูลแยกจากสมุดจริง</div>
            )}
            {cloudUrl &&
            (!authUser ||
              localStorage.getItem("lilly-locked") === "true" ||
              (localStorage.getItem("lilly-owner") &&
                localStorage.getItem("lilly-owner") !== authUser)) ? (
              <Empty
                text={
                  authUser === null
                    ? "กำลังตรวจบัญชี…"
                    : authUser
                      ? "ข้อมูลในเครื่องนี้ผูกกับบัญชีเจ้าของอีกบัญชี"
                      : "เข้าสู่ระบบด้วยบัญชีเจ้าของเพื่อเปิดสมุดฝึกส่วนตัว"
                }
                action={
                  <div
                    className="upload-row"
                    style={{ justifyContent: "center" }}
                  >
                    <button className="primary" onClick={() => setLogin(true)}>
                      เข้าสู่ระบบ
                    </button>
                    <ConnectionRecovery />
                  </div>
                }
              />
            ) : !loaded ? (
              <Empty text="กำลังเปิดสมุดฝึก…" />
            ) : page === "today" ? (
              <Today nav={nav} />
            ) : page === "machines" ? (
              <Machines />
            ) : page.startsWith("cardio") ? (
              <CardioPage openReport={page === "cardio#report"} />
            ) : page === "progress" ? (
              <Suspense fallback={<Empty text="กำลังเปิดกราฟ…" />}>
                <Progress />
              </Suspense>
            ) : page === "history" ? (
              <HistoryPage />
            ) : (
              <SettingsPage
                synchronize={() => synchronize()}
                busy={busy}
                openLogin={() => setLogin(true)}
              />
            )}
          </div>
        </main>
        <nav className="bottom-nav">
          {tabs
            .filter((t) => t[0] !== "history")
            .map(([key, label, Icon]) => (
              <button
                key={key}
                aria-label={label}
                onClick={() => nav(key)}
                className={page.split("#")[0] === key ? "active" : ""}
              >
                <Icon size={20} />
                <span className="long">{label}</span>
                <span className="short">{short[key] ?? label}</span>
              </button>
            ))}
        </nav>
        {toast && (
          <div role="status" className="toast">
            {toast}
            <button onClick={() => setToast("")} aria-label="ปิดข้อความ">
              <X size={16} />
            </button>
          </div>
        )}
        {login && (
          <Login
            close={() => setLogin(false)}
            done={() => {
              setLogin(false);
              void synchronize();
            }}
          />
        )}
      </div>
    </Data.Provider>
  );
}
function Today({ nav }: { nav: (p: string) => void }) {
  const { entries, run, refresh } = useData(),
    [start, setStart] = useState(false),
    [session, setSession] = useState<string | null>(null),
    [machineDetail, setMachineDetail] = useState<string | null>(null);
  const active = entries.filter((e) => !e.deleted),
    now = today(),
    week = weekOf(now),
    t = cardioTotals(active, week),
    settings = active.find((e) => e.id === "settings-main")?.data ?? {},
    goal = settings.cardioGoal ?? 150,
    sessions = active.filter(
      (e) =>
        e.kind === "session" &&
        e.data.date >= week &&
        e.data.date <= addDays(week, 6) &&
        e.data.status === "completed",
    ),
    draft = active
      .filter((e) => e.kind === "session" && e.data.status === "draft")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0],
    routines = active.filter((e) => e.kind === "routine"),
    machines = active.filter((e) => e.kind === "machine" && !e.data.archived),
    last = active
      .filter(
        (e) => e.kind === "session" && e.data.date && e.data.status !== "draft",
      )
      .sort((a, b) => b.data.date.localeCompare(a.data.date))
      .slice(0, 4);
  const startRoutine = (r: Entry) =>
    run(async () => {
      const e = await save(
        "session",
        newSession(
          r.data.title,
          r.data.machineIds.filter((id: string) =>
            machines.some((m) => m.id === id),
          ),
          entries,
        ),
      );
      await refresh();
      setSession(e.id);
    });
  return (
    <>
      <Header title="วันนี้" subtitle={longDate(now)} />
      <div className="hero-grid">
        <section className="session-card">
          <div className="card-head">
            <h2>{draft ? draft.data.title : "การฝึกวันนี้"}</h2>
            {draft && (
              <span className="tag">
                {
                  draft.data.exercises.filter((x: ExerciseLog) =>
                    x.sets.some((s) => s.done),
                  ).length
                }
                /{draft.data.exercises.length} ท่า
              </span>
            )}
          </div>
          {draft ? (
            <>
              <ul className="today-list">
                {draft.data.exercises.map((x: ExerciseLog) => {
                  const m = entries.find((e) => e.id === x.machineId)?.data;
                  const done = x.sets.filter((s) => s.done).length;
                  return (
                    <li key={x.machineId} className={done ? "done" : ""}>
                      <span className="check-dot">
                        {done ? <Check size={13} /> : null}
                      </span>
                      <span>{m?.name ?? "เครื่อง"}</span>
                      <small>{done ? `${done} เซต` : "ยังไม่เริ่ม"}</small>
                    </li>
                  );
                })}
              </ul>
              <button
                className="secondary wide"
                onClick={() => setSession(draft.id)}
              >
                เปิดรายการฝึก <ChevronRight size={17} />
              </button>
            </>
          ) : (
            <>
              <p className="muted">เลือกโปรแกรมเพื่อเริ่มบันทึก หรือเลือกเครื่องเอง</p>
              <div className="routine-buttons">
                {routines.map((r) => (
                  <button
                    key={r.id}
                    className="routine-button"
                    onClick={() => startRoutine(r)}
                  >
                    <span>
                      <strong>{r.data.title}</strong>
                      <small>{r.data.machineIds.length} ท่า</small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
                <button
                  className="routine-button ghost"
                  onClick={() => setStart(true)}
                >
                  <span>
                    <strong>เลือกเครื่องเอง</strong>
                    <small>กำหนดท่าและวันที่</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              </div>
            </>
          )}
        </section>
        <section className="hero">
          <div className="eyebrow light">
            คาร์ดิโอ · {dateLabel(week)} – {dateLabel(addDays(week, 6))}
          </div>
          <div className="hero-main">
            <div>
              <h2>
                {Math.floor(t.seconds / 60)}
                <span> / {goal} นาที</span>
              </h2>
              <p>
                {t.seconds >= goal * 60
                  ? `ครบเป้าแล้ว เกิน ${minuteDuration(t.seconds - goal * 60)}`
                  : `เหลือ ${minuteDuration(goal * 60 - t.seconds)}`}
              </p>
            </div>
            <Ring value={(t.seconds / (goal * 60)) * 100} />
          </div>
          <div className="hero-bottom">
            <button onClick={() => nav("cardio#report")}>
              <Copy size={16} /> รายงานโค้ช
            </button>
            <button onClick={() => nav("cardio")}>
              บันทึกคาร์ดิโอ <ArrowUpRight size={17} />
            </button>
          </div>
        </section>
      </div>
      <div className="stats-row">
        <Stat
          icon={<Dumbbell />}
          label="เวทสัปดาห์นี้"
          value={`${sessions.length}`}
          unit="ครั้ง"
        />
        <Stat
          icon={<Clock />}
          label="คาร์ดิโอสัปดาห์นี้"
          value={Math.floor(t.seconds / 60).toString()}
          unit="นาที"
        />
        <Stat
          icon={<Footprints />}
          label={t.unknownDistance ? "ระยะที่บันทึก" : "ระยะทาง"}
          value={t.distance.toFixed(2)}
          unit="กม."
        />
      </div>
      <div className="section-title">
        <h2>เครื่อง WE Fitness</h2>
        <button className="text-button" onClick={() => nav("machines")}>
          ทั้งหมด <ChevronRight size={17} />
        </button>
      </div>
      <div className="machine-grid compact">
        {machines
          .filter((e) => e.data.gym === "WE Fitness")
          .slice(0, 6)
          .map((e) => (
            <MachineTile
              key={e.id}
              e={e}
              onClick={() => setMachineDetail(e.id)}
            />
          ))}
      </div>
      {!machines.length && (
        <Empty
          text="ยังไม่มีเครื่อง เพิ่มเครื่องแรกได้ที่หน้าเครื่องและท่า"
          action={
            <button className="secondary" onClick={() => nav("machines")}>
              ไปที่เครื่องและท่า
            </button>
          }
        />
      )}
      <div className="section-title">
        <h2>บันทึกล่าสุด</h2>
        <button className="text-button" onClick={() => nav("history")}>
          ประวัติ <ChevronRight size={17} />
        </button>
      </div>
      {last.map((e) => (
        <button
          className="history-row"
          key={e.id}
          onClick={() => setSession(e.id)}
        >
          <span className="icon-disc">
            <Dumbbell size={20} />
          </span>
          <div>
            <strong>{e.data.title}</strong>
            <small>
              {dateLabel(e.data.date)} ·{" "}
              {e.data.exercises.length
                ? `${e.data.exercises.length} ท่า`
                : "บันทึกจากสมุดเดิม"}
            </small>
          </div>
          <ChevronRight size={18} />
        </button>
      ))}
      {start && (
        <StartSession
          close={() => setStart(false)}
          done={(id) => {
            setStart(false);
            setSession(id);
          }}
        />
      )}
      {session && <SessionEditor id={session} close={() => setSession(null)} />}
      {machineDetail && (
        <MachineDetail
          id={machineDetail}
          close={() => setMachineDetail(null)}
        />
      )}
    </>
  );
}
export function Stat({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>
          {value}
          <span>{unit}</span>
        </strong>
      </div>
    </div>
  );
}
function workoutMessage(s: Session, entries: Entry[]) {
  const lines = weightLines(
    [
      ...entries.filter((e) => e.kind === "machine"),
      {
        id: "current",
        kind: "session",
        data: { ...s, status: "completed" },
        updatedAt: "",
        version: 0,
        dirty: false,
      },
    ],
    s.date,
  );
  return `🏋️ อัปเดตเวท ${dateLabel(s.date)} (${lines.length} ท่า)\n${lines.join("\n")}${s.note.trim() ? `\n\n${s.note.trim()}` : ""}`;
}
function MachinePicker({
  excluded,
  choose,
  close,
}: {
  excluded: string[];
  choose: (m: Entry) => void;
  close: () => void;
}) {
  const { entries } = useData(),
    [query, setQuery] = useState("");
  return (
    <Modal title="เพิ่มท่า" close={close}>
      <div className="form">
        <input
          aria-label="ค้นหาท่าที่จะเพิ่ม"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเครื่อง / ท่า"
        />
        {entries
          .filter(
            (e) =>
              e.kind === "machine" &&
              !e.deleted &&
              !e.data.archived &&
              !excluded.includes(e.id) &&
              `${e.data.name} ${e.data.thai}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          )
          .map((e) => (
            <button key={e.id} className="select-row" onClick={() => choose(e)}>
              <span>
                {e.data.name}
                <small>
                  {e.data.gym} · {e.data.thai}
                </small>
              </span>
              <Plus size={17} />
            </button>
          ))}
      </div>
    </Modal>
  );
}
function RoutineSettings() {
  const { entries, run } = useData(),
    [edit, setEdit] = useState<Entry | null | undefined>(undefined),
    [selected, setSelected] = useState<string[]>([]);
  const routines = entries.filter((e) => e.kind === "routine" && !e.deleted),
    machines = entries.filter(
      (e) => e.kind === "machine" && !e.deleted && !e.data.archived,
    );
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>โปรแกรมฝึกของคุณ</h2>
          <p>บันทึกชุดท่าตามโค้ช แล้วเลือกใช้ซ้ำตอนเริ่มฝึก</p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setEdit(null);
            setSelected([]);
          }}
        >
          <Plus size={16} />
          เพิ่มโปรแกรม
        </button>
      </div>
      {routines.map((r) => (
        <div className="trash-row" key={r.id}>
          <div>
            <strong>{r.data.title}</strong>
            <p className="muted">
              {r.data.machineIds.length} ท่า ·{" "}
              {r.data.days?.join(" / ") || "ไม่กำหนดวัน"}
            </p>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setEdit(r);
              setSelected(r.data.machineIds);
            }}
          >
            แก้ไข
          </button>
          <button
            className="icon"
            aria-label="ลบโปรแกรม"
            onClick={() => run(() => trash(r.id), "เก็บโปรแกรมเข้าถังขยะแล้ว")}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      {!routines.length && (
        <p className="muted">
          ยังไม่มีโปรแกรมที่บันทึก เพิ่ม Upper / Lower หรือตารางตามเทรนเนอร์ได้
        </p>
      )}
      {edit !== undefined && (
        <Modal title="โปรแกรมฝึก" close={() => setEdit(undefined)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                if (!selected.length) throw Error("เลือกอย่างน้อยหนึ่งท่า");
                await save(
                  "routine",
                  {
                    title: String(f.get("title")),
                    machineIds: selected,
                    days: f.getAll("days"),
                    note: String(f.get("note")),
                  },
                  edit?.id,
                );
                setEdit(undefined);
              }, "บันทึกโปรแกรมแล้ว");
            }}
          >
            <Field label="ชื่อโปรแกรม">
              <input name="title" required defaultValue={edit?.data.title} />
            </Field>
            <p>วันฝึกที่วางไว้ (เลื่อนวันจริงได้)</p>
            <div className="upload-row">
              {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((day) => (
                <label key={day} className="check-label">
                  <input
                    type="checkbox"
                    name="days"
                    value={day}
                    defaultChecked={edit?.data.days?.includes(day)}
                  />
                  {day}
                </label>
              ))}
            </div>
            <Field label="โน้ตจากเทรนเนอร์">
              <textarea name="note" defaultValue={edit?.data.note} />
            </Field>
            <p>เลือกท่าตามลำดับ</p>
            {machines.map((m) => (
              <label key={m.id} className="select-row">
                <input
                  type="checkbox"
                  checked={selected.includes(m.id)}
                  onChange={() =>
                    setSelected((v) =>
                      v.includes(m.id)
                        ? v.filter((id) => id !== m.id)
                        : [...v, m.id],
                    )
                  }
                />
                <span>
                  {m.data.name}
                  <small>{m.data.gym}</small>
                </span>
                {selected.includes(m.id) && <b>{selected.indexOf(m.id) + 1}</b>}
              </label>
            ))}
            <button className="primary">บันทึกโปรแกรม</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
function MachineTile({ e, onClick }: { e: Entry; onClick: () => void }) {
  const { entries } = useData(),
    m = e.data as Machine,
    last = latestExercise(entries, e.id, today());
  return (
    <button className="machine-tile" onClick={onClick}>
      <div className="machine-photo">
        <Photo id={m.photoId ?? m.referencePhotoId} alt={m.name} />
        <span className="gym-label">{m.gym}</span>
        {!m.photoId && m.referencePhotoId && (
          <span className="reference-label">รูปอ้างอิง Jett</span>
        )}
      </div>
      <div className="machine-copy">
        <small>{m.group}</small>
        <h3>{m.name}</h3>
        <p>{m.thai}</p>
        <div className="last-load">
          {last ? (
            <>
              <span>ครั้งล่าสุด</span>
              <strong>
                {last
                  .exercise!.sets.filter((s) => s.done)
                  .map((s) => formatSet(s, last.exercise!.loadMode))
                  .join(" / ")}{" "}
              </strong>
            </>
          ) : (
            <span>ยังไม่มีผลที่ยืนยัน</span>
          )}
          <ArrowUpRight size={17} />
        </div>
      </div>
    </button>
  );
}
function Machines() {
  const { entries } = useData(),
    [query, setQuery] = useState(""),
    [gym, setGym] = useState("WE Fitness"),
    [group, setGroup] = useState("ทั้งหมด"),
    [selected, setSelected] = useState<string | null>(null),
    [create, setCreate] = useState(false),
    [showArchived, setShowArchived] = useState(false);
  const machines = entries.filter(
    (e) =>
      e.kind === "machine" &&
      !e.deleted &&
      (!e.data.archived || showArchived) &&
      (!gym || e.data.gym === gym) &&
      (group === "ทั้งหมด" || e.data.group === group) &&
      `${e.data.name} ${e.data.thai}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <Header title="เครื่องและท่า" subtitle="รูปเครื่อง การตั้งเบาะ และผลครั้งก่อน">
        <button className="primary" onClick={() => setCreate(true)}>
          <Plus size={18} />
          เพิ่มเครื่อง / ท่า
        </button>
      </Header>
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            placeholder="ค้นหาท่า หรือชื่อเครื่อง"
            aria-label="ค้นหาเครื่อง"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="ฟิตเนส"
          value={gym}
          onChange={(e) => setGym(e.target.value)}
        >
          <option value="WE Fitness">WE Fitness</option>
          <option value="Jett">Jett · สถิติเก่า</option>
          <option value="">ทุกสถานที่</option>
        </select>
      </div>
      <div className="chips">
        {["ทั้งหมด", "อก", "หลัง", "ขา", "แกนกลาง", "ไหล่", "แขน", "อื่น ๆ"].map(
          (g) => (
            <button
              className={group === g ? "selected" : ""}
              key={g}
              onClick={() => setGroup(g)}
            >
              {g}
            </button>
          ),
        )}
      </div>
      <label className="check-label archive-toggle">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        แสดงเครื่องที่เก็บเข้าคลัง
      </label>
      <div className="machine-grid">
        {machines.map((e) => (
          <MachineTile key={e.id} e={e} onClick={() => setSelected(e.id)} />
        ))}
      </div>
      {!machines.length && <Empty text="ยังไม่มีเครื่องในหมวดนี้" />}
      {selected && (
        <MachineDetail id={selected} close={() => setSelected(null)} />
      )}{" "}
      {create && <MachineForm close={() => setCreate(false)} />}
    </>
  );
}
function MachineDetail({ id, close }: { id: string; close: () => void }) {
  const { entries, run, refresh } = useData(),
    e = entries.find((e) => e.id === id),
    [edit, setEdit] = useState(false),
    [beginBusy, setBeginBusy] = useState(false),
    [showAll, setShowAll] = useState(false),
    [session, setSession] = useState<string | null>(null);
  if (!e) return null;
  const m = e.data as Machine;
  const history = machineHistory(entries, id),
    last = latestExercise(entries, id, today()),
    best = bestSet(entries, id),
    draft = entries
      .filter(
        (x) =>
          x.kind === "session" &&
          !x.deleted &&
          x.data.status === "draft" &&
          x.data.date === today(),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const photos = entries.filter(
    (p) =>
      !p.deleted &&
      p.kind === "photo" &&
      (p.data.machineId === id ||
        p.id === m.photoId ||
        p.id === m.referencePhotoId),
  );
  async function upload(file?: File) {
    if (!file) return;
    await run(async () => {
      const p = await addPhoto(file, `${m.gym} ${m.name}`);
      await save(
        "photo",
        { label: m.name, machineId: id, mime: "image/jpeg" },
        p,
      );
      await save("machine", { ...m, photoId: p }, id);
    }, "เพิ่มรูปและตั้งเป็นรูปหลักแล้ว");
  }
  const begin = () =>
    run(async () => {
      if (beginBusy) return;
      setBeginBusy(true);
      try {
        if (draft) {
          const d = draft.data as Session;
          if (!d.exercises.some((x) => x.machineId === id))
            await save(
              "session",
              { ...d, exercises: [...d.exercises, exerciseFor(e)] },
              draft.id,
            );
          await refresh();
          setSession(draft.id);
        } else {
          const entry = await save(
            "session",
            newSession("ฝึกเวท", [id], entries),
          );
          await refresh();
          setSession(entry.id);
        }
      } finally {
        setBeginBusy(false);
      }
    });
  const mainPhoto = m.photoId ?? m.referencePhotoId;
  return (
    <Modal title={m.name} close={close}>
      <div className="detail-photo">
        <Photo id={mainPhoto} alt={m.name} />
        {!m.photoId && m.referencePhotoId && (
          <span className="reference-label">รูปอ้างอิงจาก Jett</span>
        )}
      </div>
      <div className="detail-body">
        <div className="focus-title">
          <small>
            {m.gym} · {m.group} · {loadLabel(m.loadMode)}
          </small>
          <h3>{m.name}</h3>
          {m.thai && <p className="muted">{m.thai}</p>}
        </div>
        <div className="info-grid">
          <div className="previous">
            <span className="eyebrow">ครั้งก่อน</span>
            <h4>{last ? dateLabel(last.entry.data.date) : "ยังไม่มีผลที่ยืนยัน"}</h4>
            {last?.exercise?.sets
              .filter((s) => s.done)
              .map((s, i) => (
                <p key={i}>
                  {last.exercise!.reportedOnly ? "ผลที่รายงาน" : `เซต ${i + 1}`}:{" "}
                  <strong>{formatSet(s, last.exercise!.loadMode)}</strong>
                </p>
              ))}
            {last?.exercise?.setup && (
              <p className="muted">ตั้งเครื่อง: {last.exercise.setup}</p>
            )}
            {last?.exercise?.note && (
              <p className="muted">{last.exercise.note}</p>
            )}
          </div>
          <div className="previous best">
            <span className="eyebrow">สถิติสูงสุด</span>
            {best ? (
              <>
                <h4>{formatSet(best.set, best.mode)}</h4>
                <p className="muted">{dateLabel(best.date)}</p>
              </>
            ) : (
              <h4>ยังไม่มี</h4>
            )}
          </div>
        </div>
        {m.historicalResult && (
          <div className="notice">
            <strong>สถิติเก่า · ไม่ทราบวัน</strong>
            <p>{m.historicalResult}</p>
          </div>
        )}
        <div>
          <h4>การตั้งเครื่อง</h4>
          <p className="preserve">{m.setup || "ยังไม่มีบันทึก"}</p>
        </div>
        <div>
          <h4>วิธีเล่น</h4>
          <p className="preserve">{m.cues || "ยังไม่มีบันทึก"}</p>
        </div>
        <div>
          <h4>รูปเครื่อง</h4>
          <div className="photo-strip">
            {photos.map((p) => (
              <button
                key={p.id}
                className={p.id === mainPhoto ? "main" : ""}
                aria-label={p.id === mainPhoto ? "รูปหลัก" : "ตั้งเป็นรูปหลัก"}
                onClick={() =>
                  p.id !== mainPhoto &&
                  run(
                    () => save("machine", { ...m, photoId: p.id }, id),
                    "ตั้งรูปหลักแล้ว",
                  )
                }
              >
                <Photo id={p.id} alt={p.data.label} />
                {p.id === mainPhoto && <span>รูปหลัก</span>}
              </button>
            ))}
            <label className="photo-add">
              <Camera size={20} />
              ถ่ายรูป
              <input
                hidden
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(ev) => {
                  void upload(ev.target.files?.[0]);
                  ev.target.value = "";
                }}
              />
            </label>
            <label className="photo-add">
              <ImagePlus size={20} />
              เลือกรูป
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(ev) => {
                  void upload(ev.target.files?.[0]);
                  ev.target.value = "";
                }}
              />
            </label>
          </div>
          {photos.length > 1 && <p className="muted">แตะรูปเพื่อตั้งเป็นรูปหลัก</p>}
        </div>
        <div>
          <h4>ประวัติเครื่องนี้ ({history.length})</h4>
          {history.length ? (
            <div className="machine-history">
              {(showAll ? history : history.slice(0, 5)).map((h) => (
                <div key={h.entry.id}>
                  <span>{dateLabel(h.entry.data.date)}</span>
                  <strong>
                    {h.exercise.sets
                      .filter((s) => s.done)
                      .map((s) => formatSet(s, h.exercise.loadMode))
                      .join(" / ")}
                  </strong>
                </div>
              ))}
              {history.length > 5 && (
                <button
                  className="text-button"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? "แสดงน้อยลง" : `ดูทั้งหมด ${history.length} ครั้ง`}
                </button>
              )}
            </div>
          ) : (
            <p className="muted">ยังไม่มีผลที่บันทึก</p>
          )}
        </div>
        <div className="upload-row">
          <button className="secondary" onClick={() => setEdit(true)}>
            แก้ไขรายละเอียด
          </button>
          <button
            className="text-button"
            onClick={() =>
              run(
                () => save("machine", { ...m, archived: !m.archived }, id),
                m.archived ? "นำเครื่องกลับมาแล้ว" : "ซ่อนเครื่องแล้ว ประวัติยังอยู่",
              )
            }
          >
            {m.archived ? "นำกลับมาใช้งาน" : "ซ่อนเครื่องนี้"}
          </button>
        </div>
        <div className="sticky-actions">
          <button
            className="primary wide"
            disabled={beginBusy || !!m.archived}
            onClick={begin}
          >
            <Plus size={18} />
            {draft
              ? draft.data.exercises.some(
                  (x: ExerciseLog) => x.machineId === id,
                )
                ? "บันทึกเซตวันนี้"
                : "เพิ่มเข้าการฝึกวันนี้"
              : "เริ่มฝึกท่านี้"}
          </button>
        </div>
      </div>
      {edit && (
        <MachineForm entry={e} close={() => setEdit(false)} onDeleted={close} />
      )}
      {session && (
        <SessionEditor
          id={session}
          focusMachine={id}
          close={() => setSession(null)}
        />
      )}
    </Modal>
  );
}
function MachineForm({
  entry,
  close,
  onDeleted,
}: {
  entry?: Entry;
  close: () => void;
  onDeleted?: () => void;
}) {
  const { run } = useData(),
    m = entry?.data as Machine | undefined;
  return (
    <Modal title={entry ? "แก้ไขเครื่อง" : "เพิ่มเครื่องหรือท่า"} close={close}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            await save(
              "machine",
              {
                ...m,
                name: f.get("name"),
                thai: f.get("thai"),
                gym: f.get("gym"),
                group: f.get("group"),
                setup: f.get("setup"),
                cues: f.get("cues"),
                loadMode: f.get("loadMode"),
              },
              entry?.id,
            );
            close();
          }, "บันทึกเครื่องแล้ว");
        }}
      >
        <div className="form-grid">
          <Field label="ชื่อท่า / เครื่อง">
            <input required name="name" defaultValue={m?.name} />
          </Field>
          <Field label="ชื่อที่เรียกภาษาไทย">
            <input name="thai" defaultValue={m?.thai} />
          </Field>
          <Field label="ฟิตเนส">
            <select name="gym" defaultValue={m?.gym ?? "WE Fitness"}>
              <option>WE Fitness</option>
              <option>Jett</option>
              <option>ที่บ้าน</option>
              <option>อื่น ๆ</option>
            </select>
          </Field>
          <Field label="กล้ามเนื้อ">
            <select name="group" defaultValue={m?.group ?? "อื่น ๆ"}>
              {["อก", "หลัง", "ขา", "แกนกลาง", "ไหล่", "แขน", "อื่น ๆ"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="วิธีนับน้ำหนัก">
          <select name="loadMode" defaultValue={m?.loadMode ?? "total"}>
            <option value="total">น้ำหนักรวม / ตามหน้าปัด</option>
            <option value="per-side">น้ำหนักข้างละ</option>
            <option value="assistance">แรงช่วย (มากขึ้น = ง่ายขึ้น)</option>
            <option value="bodyweight">น้ำหนักตัว</option>
          </select>
        </Field>
        <Field label="การตั้งเบาะ / เครื่อง">
          <textarea name="setup" defaultValue={m?.setup} />
        </Field>
        <Field label="วิธีเล่น / จุดที่ต้องระวัง">
          <textarea name="cues" defaultValue={m?.cues} />
        </Field>
        <div className="sticky-actions">
          {entry && (
            <button
              type="button"
              className="danger"
              onClick={() =>
                run(async () => {
                  await trash(entry.id);
                  close();
                  onDeleted?.();
                }, "ย้ายเครื่องเข้าถังขยะแล้ว กู้คืนได้ที่หน้าตั้งค่า")
              }
            >
              <Trash2 size={16} />
              ลบเครื่อง
            </button>
          )}
          <button className="primary">บันทึกเครื่อง</button>
        </div>
      </form>
    </Modal>
  );
}
function StartSession({
  close,
  done,
  initial = [],
}: {
  close: () => void;
  done: (id: string) => void;
  initial?: string[];
}) {
  const { entries, run, refresh } = useData(),
    [selection, setSelection] = useState(initial),
    [title, setTitle] = useState(initial.length ? "ฝึกเวท" : "Upper Body"),
    [date, setDate] = useState(today());
  const machines = entries.filter(
      (e) => e.kind === "machine" && !e.deleted && !e.data.archived,
    ),
    routines = entries.filter((e) => e.kind === "routine" && !e.deleted);
  return (
    <Modal title="เริ่มฝึก" close={close}>
      <div className="form">
        <div className="form-grid">
          <Field label="ชื่อครั้งฝึก">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="วันที่ฝึก">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <div className="chips">
          {["Upper Body", "Lower Body", "Full Body"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTitle(t);
                setSelection(
                  machines
                    .filter(
                      (e) =>
                        e.data.gym === "WE Fitness" &&
                        (t === "Full Body" ||
                          (t === "Lower Body"
                            ? ["ขา", "แกนกลาง"].includes(e.data.group)
                            : !["ขา"].includes(e.data.group))),
                    )
                    .map((e) => e.id),
                );
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="chips">
          {routines.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setTitle(r.data.title);
                setSelection(
                  r.data.machineIds.filter((id: string) =>
                    machines.some((m) => m.id === id),
                  ),
                );
              }}
            >
              {r.data.title}
            </button>
          ))}
        </div>
        <p>เลือกท่าตามลำดับที่จะเล่น</p>
        {machines.map((e) => (
          <label className="select-row" key={e.id}>
            <input
              type="checkbox"
              checked={selection.includes(e.id)}
              onChange={() =>
                setSelection((s) =>
                  s.includes(e.id)
                    ? s.filter((id) => id !== e.id)
                    : [...s, e.id],
                )
              }
            />
            <span>
              {e.data.name}
              <small>
                {e.data.gym} · {e.data.thai}
              </small>
            </span>
            {selection.includes(e.id) && <b>{selection.indexOf(e.id) + 1}</b>}
          </label>
        ))}
        <button
          className="primary wide"
          disabled={!selection.length || !date || !title}
          onClick={() =>
            run(async () => {
              const e = await save(
                "session",
                newSession(title, selection, entries, date),
              );
              await refresh();
              done(e.id);
            })
          }
        >
          เริ่มบันทึก {selection.length} ท่า <ArrowUpRight size={18} />
        </button>
      </div>
    </Modal>
  );
}
function RestTimer() {
  const [end, setEnd] = useState<number | null>(null),
    [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!end) return;
    const t = setInterval(() => {
      const n = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSeconds(n);
      if (n === 0) {
        setEnd(null);
        navigator.vibrate?.([100, 100, 100]);
      }
    }, 250);
    return () => clearInterval(t);
  }, [end]);
  return (
    <div className="rest-timer">
      <Timer size={17} />
      <span>
        {end
          ? `พัก ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`
          : "จับเวลาพัก"}
      </span>
      {[60, 90, 120].map((n) => (
        <button
          key={n}
          onClick={() => {
            setEnd(Date.now() + n * 1000);
            setSeconds(n);
          }}
        >
          {n}วิ
        </button>
      ))}
      {end && (
        <button onClick={() => setEnd(null)} aria-label="หยุดเวลา">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
function CardioPage({ openReport = false }: { openReport?: boolean }) {
  const { entries, notify, run } = useData(),
    [week, setWeek] = useState(weekOf(today())),
    [date, setDate] = useState(today()),
    [reportWeek, setReportWeek] = useState(weekOf(today())),
    [withWeights, setWithWeights] = useState(true),
    [walking, setWalking] = useState(false),
    [edit, setEdit] = useState<Entry | null | undefined>(undefined),
    [copy, setCopy] = useState(openReport);
  useEffect(() => setCopy(openReport), [openReport]);
  const pickReportDate = (d: string) => {
    setDate(d);
    // Use the credited week of that day's logs so catch-up walks are reported correctly.
    const credited = entries.find(
      (e) =>
        e.kind === "cardio" &&
        !e.deleted &&
        e.data.status === "confirmed" &&
        e.data.date === d,
    )?.data.week;
    setReportWeek(credited ?? weekOf(d));
  };
  const settings =
      entries.find((e) => e.id === "settings-main" && !e.deleted)?.data ?? {},
    goal = walking ? (settings.walkGoal ?? 150) : (settings.cardioGoal ?? 150),
    totals = cardioTotals(entries, week, walking);
  const logs = entries
    .filter(
      (e) =>
        e.kind === "cardio" &&
        !e.deleted &&
        e.data.week === week &&
        (!walking || e.data.walkGoal),
    )
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
  const message = coachMessage(
    entries,
    date,
    reportWeek,
    goal,
    walking,
    withWeights,
  );
  return (
    <>
      <Header title="คาร์ดิโอ" subtitle="รอบสัปดาห์อาทิตย์–เสาร์ · เวลาไทย">
        <button className="primary" onClick={() => setEdit(null)}>
          <Plus size={18} />
          บันทึกคาร์ดิโอ
        </button>
      </Header>
      <div className="toolbar">
        <div className="segmented">
          <button
            className={!walking ? "active" : ""}
            onClick={() => setWalking(false)}
          >
            คาร์ดิโอทั้งหมด
          </button>
          <button
            className={walking ? "active" : ""}
            onClick={() => setWalking(true)}
          >
            เฉพาะเป้าเดิน
          </button>
        </div>
        <div className="week-select">
          <button
            className="icon"
            aria-label="สัปดาห์ก่อน"
            onClick={() => setWeek(addDays(week, -7))}
          >
            <ArrowLeft size={18} />
          </button>
          <span>
            {dateLabel(week)} – {dateLabel(addDays(week, 6))}
          </span>
          <button
            className="icon"
            aria-label="สัปดาห์ถัดไป"
            onClick={() => setWeek(addDays(week, 7))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="cardio-grid">
        <section className="hero">
          <div className="eyebrow light">
            {walking ? "เดินสะสม" : "คาร์ดิโอสะสม"} ·{" "}
            {weekOf(today()) === week ? "สัปดาห์นี้ · " : ""}
            {dateLabel(week)} – {dateLabel(addDays(week, 6))}
          </div>
          <div className="hero-main">
            <div>
              <h2>
                {Math.floor(totals.seconds / 60)}
                <span> นาที {totals.seconds % 60} วิ</span>
              </h2>
              <p>
                จากเป้าหมาย {goal} นาที · {totals.count} รายการ
              </p>
            </div>
            <Ring value={(totals.seconds / (goal * 60)) * 100} />
          </div>
          <div className="hero-bottom">
            <span>
              <Target size={16} />
              {totals.seconds >= goal * 60
                ? `เกินเป้า ${duration(totals.seconds - goal * 60)}`
                : `เหลือ ${duration(goal * 60 - totals.seconds)}`}
            </span>
          </div>
        </section>
        <section className="coach-intro">
          <span className="icon-disc">
            <Copy size={22} />
          </span>
          <h3>รายงานเทรนเนอร์</h3>
          <p>คาร์ดิโอ ยอดสะสมรอบสัปดาห์ และท่าเวทของวันนั้น พร้อมคัดลอก</p>
          <button
            className="secondary"
            onClick={() => {
              pickReportDate(today());
              setCopy(true);
            }}
          >
            สร้างข้อความ <ArrowUpRight size={17} />
          </button>
        </section>
      </div>
      <div className="section-title">
        <div>
          <h2>ล็อกในรอบนี้</h2>
          <p>วันที่เล่นจริงแยกจากรอบที่นับได้ เพื่อบันทึกการชดเชย</p>
        </div>
        <span className="tag">
          {totals.distance.toFixed(2)} กม.
          {totals.unknownDistance ? " ที่ทราบ" : ""}
        </span>
      </div>
      <div className="log-list">
        {logs.map((e) => (
          <button key={e.id} className="cardio-row" onClick={() => setEdit(e)}>
            <span
              className={`activity-disc ${e.data.activity === "ต่อยมวย" ? "boxing" : ""}`}
            >
              {e.data.activity === "ต่อยมวย" ? "🥊" : <Footprints />}
            </span>
            <div className="cardio-info">
              <strong>{e.data.activity}</strong>
              <small>
                {dateLabel(e.data.date)}
                {weekOf(e.data.date) !== e.data.week ? " · ชดเชยข้ามรอบ" : ""}
              </small>
              <small>{e.data.note}</small>
            </div>
            <div className="cardio-values">
              <strong>{duration(e.data.seconds)}</strong>
              <small>
                {e.data.distance !== null
                  ? `${e.data.distance} กม.`
                  : "ไม่ได้บันทึกระยะ"}{" "}
                · {e.data.status === "confirmed" ? "ยืนยันแล้ว" : "รอตรวจ"}
              </small>
            </div>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>
      {!logs.length && (
        <Empty
          text="ยังไม่มีรายการในสัปดาห์นี้"
          action={
            <button className="secondary" onClick={() => setEdit(null)}>
              บันทึกรายการแรก
            </button>
          }
        />
      )}
      <div className="notice">
        รายการ “รอตรวจ” ยังไม่นับยอด · ต่อยมวยและกิจกรรมอื่นรวมในคาร์ดิโอทั้งหมด
        แต่ไม่รวมเป้าเดินโดยอัตโนมัติ
      </div>
      {edit !== undefined && (
        <CardioForm
          entry={edit ?? undefined}
          close={() => setEdit(undefined)}
        />
      )}{" "}
      {copy && (
        <Modal title="ข้อความส่งเทรนเนอร์" close={() => setCopy(false)}>
          <div className="form">
            <div className="form-grid">
              <Field label="วันที่ที่ต้องการรายงาน">
                <input
                  type="date"
                  value={date}
                  max={today()}
                  onChange={(e) => pickReportDate(e.target.value)}
                />
              </Field>
              <Field label="นับยอดของรอบ (เริ่มวันอาทิตย์)">
                <input
                  type="date"
                  value={reportWeek}
                  onChange={(e) =>
                    e.target.value && setReportWeek(weekOf(e.target.value))
                  }
                />
              </Field>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={withWeights}
                onChange={(e) => setWithWeights(e.target.checked)}
              />
              ใส่สรุปท่าเวทของวันนั้นด้วย
            </label>
            <textarea
              className="coach-text"
              aria-label="ข้อความส่งเทรนเนอร์"
              value={message}
              readOnly
            />
            <button
              className="primary wide"
              onClick={() =>
                run(
                  () => navigator.clipboard.writeText(message),
                  "คัดลอกแล้ว พร้อมส่งให้โค้ช",
                )
              }
            >
              <Copy size={17} />
              คัดลอกข้อความ
            </button>
            <button
              className="text-button"
              onClick={() => {
                download(
                  new Blob([message], { type: "text/plain;charset=utf-8" }),
                  `coach-${date}.txt`,
                );
                notify("ดาวน์โหลดข้อความแล้ว");
              }}
            >
              <Download size={16} />
              ดาวน์โหลดข้อความ
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function CardioForm({ entry, close }: { entry?: Entry; close: () => void }) {
  const { entries, run, notify } = useData(),
    c = entry?.data as Cardio | undefined,
    [date, setDate] = useState(c?.date ?? today()),
    [week, setWeek] = useState(c?.week ?? weekOf(today())),
    [time, setTime] = useState(c ? timeInput(c.seconds) : ""),
    [activity, setActivity] = useState(c?.activity ?? "เดินลู่วิ่ง"),
    [walkGoal, setWalkGoal] = useState(c?.walkGoal ?? true),
    [distance, setDistance] = useState(c?.distance?.toString() ?? ""),
    [photoId, setPhotoId] = useState(c?.photoId),
    [ocr, setOcr] = useState<Blob | null>(null),
    [saving, setSaving] = useState(false),
    [duplicateId, setDuplicateId] = useState(""),
    [allowDuplicate, setAllowDuplicate] = useState(false);
  useEffect(() => {
    setDuplicateId("");
    setAllowDuplicate(false);
  }, [date, time, distance, activity]);
  const upload = async (f?: File) => {
    if (!f) return;
    await run(async () => {
      const id = await addPhoto(f, `หลักฐาน ${date}`);
      setPhotoId(id);
      setOcr(f);
    });
  };
  return (
    <Modal title={entry ? "แก้ไขล็อกคาร์ดิโอ" : "บันทึกคาร์ดิโอ"} close={close}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (saving) return;
          const f = new FormData(e.currentTarget);
          void run(async () => {
            setSaving(true);
            try {
              const seconds = parseTime(time);
              const data: Cardio = {
                date,
                week,
                activity,
                seconds,
                distance: distance === "" ? null : Number(distance),
                speed: number(f.get("speed")),
                incline: number(f.get("incline")),
                kcal: number(f.get("kcal")),
                status: f.get("confirmed") ? "confirmed" : "review",
                walkGoal,
                note: String(f.get("note") ?? ""),
                photoId,
                source: c?.source,
                sourceId: c?.sourceId,
              };
              if (!date || !week) throw Error("เลือกวันที่และรอบสัปดาห์");
              if (data.status === "confirmed" && date > today())
                throw Error("ผลที่ทำแล้วต้องไม่เป็นวันที่ในอนาคต");
              if (
                weekOf(week) !== week &&
                !(c && c.week === week && date < "2026-11-01")
              )
                throw Error("วันเริ่มรอบต้องเป็นวันอาทิตย์");
              if (
                [data.distance, data.speed, data.incline, data.kcal].some(
                  (n) => n !== null && (!Number.isFinite(n) || n < 0),
                )
              )
                throw Error("ตัวเลขต้องไม่ติดลบ");
              const duplicate = entries.find(
                (x) =>
                  x.kind === "cardio" &&
                  !x.deleted &&
                  x.id !== entry?.id &&
                  x.data.date === date &&
                  x.data.seconds === seconds &&
                  x.data.activity === activity &&
                  x.data.distance === data.distance,
              );
              if (duplicate && !allowDuplicate) {
                setDuplicateId(duplicate.id);
                throw Error(
                  "พบรายการคล้ายกันแล้ว ถ้าเป็นคนละครั้งให้ยืนยันช่องรายการซ้ำก่อนบันทึก",
                );
              }
              await save("cardio", data, entry?.id);
              close();
              notify("บันทึกคาร์ดิโอแล้ว ยอดและข้อความโค้ชอัปเดตแล้ว");
            } finally {
              setSaving(false);
            }
          });
        }}
      >
        <div className="upload-drop">
          <ImagePlus size={26} />
          <h3>เริ่มจากรูปหน้าจอเครื่องได้เลย</h3>
          <p>อ่านตัวเลขในเครื่องนี้ แล้วตรวจให้ตรงก่อนยืนยัน</p>
          <div className="upload-row">
            <label className="secondary">
              <Camera size={17} />
              ถ่ายรูป
              <input
                hidden
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
            <label className="secondary">
              <ImagePlus size={17} />
              เลือกรูป
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
        {photoId && (
          <div className="evidence-preview">
            <Photo id={photoId} alt="หลักฐานคาร์ดิโอ" />
            <button
              type="button"
              className="text-button"
              onClick={() =>
                run(async () => {
                  const b = await photoBlob(photoId);
                  if (b) setOcr(b);
                })
              }
            >
              ครอปและอ่านรูปอีกครั้ง
            </button>
          </div>
        )}
        <div className="form-grid">
          <Field label="วันที่ออกกำลังกายจริง">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (!c) setWeek(weekOf(e.target.value));
              }}
            />
          </Field>
          <Field label="กิจกรรม">
            <select
              value={activity}
              onChange={(e) => {
                setActivity(e.target.value);
                setWalkGoal(["เดิน", "เดินลู่วิ่ง"].includes(e.target.value));
              }}
            >
              {[
                "เดินลู่วิ่ง",
                "เดิน",
                "วิ่ง",
                "ต่อยมวย",
                "ปั่นจักรยาน",
                "แบดมินตัน",
                "คาร์ดิโออื่น ๆ",
              ].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="เวลา mm:ss หรือ hh:mm:ss">
            <input
              required
              placeholder="เช่น 34:09 หรือ 2:01:14"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <Field label="ระยะทาง (กม.) · ไม่ทราบเว้นว่าง">
            <input
              type="number"
              min="0"
              step="0.001"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </Field>
          <Field label="ความเร็ว (กม./ชม.)">
            <input
              name="speed"
              type="number"
              min="0"
              step="0.1"
              defaultValue={c?.speed ?? ""}
            />
          </Field>
          <Field label="ความชัน (%)">
            <input
              name="incline"
              type="number"
              min="0"
              step="0.1"
              defaultValue={c?.incline ?? ""}
            />
          </Field>
          <Field label="พลังงานตามเครื่อง (kcal)">
            <input
              name="kcal"
              type="number"
              min="0"
              step="1"
              defaultValue={c?.kcal ?? ""}
            />
          </Field>
          <Field label="นับให้รอบเริ่มวันอาทิตย์">
            <input
              type="date"
              required
              value={week}
              onChange={(e) => setWeek(e.target.value)}
            />
          </Field>
        </div>
        {week !== weekOf(date) && (
          <div className="notice">
            รายการวันที่ {dateLabel(date)} จะนับชดเชยให้รอบ {dateLabel(week)} –{" "}
            {dateLabel(addDays(week, 6))}
          </div>
        )}
        <label className="check-label">
          <input
            name="walkGoal"
            type="checkbox"
            checked={walkGoal}
            onChange={(e) => setWalkGoal(e.target.checked)}
          />
          นับเข้าเป้าเดินด้วย
        </label>
        <Field label="หมายเหตุ / ที่มาหรือข้อจำกัด">
          <textarea
            name="note"
            defaultValue={c?.note}
            placeholder="เช่น ชดเชยสัปดาห์ก่อน / ปรับความเร็วระหว่างเดิน"
          />
        </Field>
        <label className="check-label confirm">
          <input
            name="confirmed"
            type="checkbox"
            defaultChecked={c ? c.status === "confirmed" : true}
          />
          ตรวจข้อมูลแล้ว ยืนยันให้นับยอด
        </label>
        {duplicateId && (
          <label className="check-label notice">
            <input
              type="checkbox"
              checked={allowDuplicate}
              onChange={(e) => setAllowDuplicate(e.target.checked)}
            />
            ตรวจแล้ว เป็นการออกกำลังกายคนละครั้งกับรายการเดิม จึงให้นับเพิ่มได้
          </label>
        )}
        <div className="sticky-actions">
          {entry && (
            <button
              type="button"
              className="danger"
              onClick={() =>
                run(async () => {
                  await trash(entry.id);
                  close();
                }, "ย้ายเข้าถังขยะแล้ว กู้คืนได้ในตั้งค่า")
              }
            >
              <Trash2 size={16} />
              ลบรายการ
            </button>
          )}
          <button disabled={saving} className="primary">
            <Check size={18} />
            {saving ? "กำลังบันทึก…" : "บันทึกและคำนวณยอด"}
          </button>
        </div>
      </form>
      {ocr && (
        <OCRModal
          image={ocr}
          close={() => setOcr(null)}
          apply={(t, d) => {
            if (t) setTime(t);
            if (d !== undefined) setDistance(String(d));
            setOcr(null);
            notify("นำค่าจากรูปมาแล้ว ตรวจช่องอื่นก่อนยืนยัน");
          }}
        />
      )}
    </Modal>
  );
}
const OCR_WORKER =
  "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js";
const OCR_CORE = "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0";
function OCRModal({
  image,
  close,
  apply,
}: {
  image: Blob;
  close: () => void;
  apply: (t?: string, d?: number) => void;
}) {
  const [src, setSrc] = useState(""),
    [crop, setCrop] = useState({ top: 0, bottom: 100, left: 0, right: 100 }),
    [text, setText] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [chosen, setChosen] = useState(""),
    [dist, setDist] = useState("");
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(image);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  async function recognize() {
    setBusy(true);
    setStatus("กำลังโหลดตัวอ่านภาพ…");
    let worker: any;
    try {
      const { createWorker } = await import("tesseract.js");
      const im = img.current!;
      const x = (im.naturalWidth * crop.left) / 100,
        y = (im.naturalHeight * crop.top) / 100,
        w = (im.naturalWidth * (crop.right - crop.left)) / 100,
        h = (im.naturalHeight * (crop.bottom - crop.top)) / 100;
      if (w < 20 || h < 20) throw Error("เลือกกรอบให้กว้างและสูงอย่างน้อย 20 พิกเซล");
      const scale = Math.min(3, 2000 / w, 3000 / h);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas
        .getContext("2d")!
        .drawImage(im, x, y, w, h, 0, 0, canvas.width, canvas.height);
      // Pinned CDN paths; the production CSP only allows these packages.
      worker = await createWorker(["eng", "tha"], 1, {
        workerPath: OCR_WORKER,
        corePath: OCR_CORE,
        logger: (m) =>
          setStatus(`${m.status} ${Math.round((m.progress ?? 0) * 100)}%`),
      });
      const { data } = await worker.recognize(canvas);
      setText(data.text);
      const candidates = ocrCandidates(data.text);
      if (candidates.times.length === 1) setChosen(candidates.times[0]);
      if (candidates.distances.length === 1)
        setDist(String(candidates.distances[0]));
      setStatus("อ่านแล้ว · ตรวจตัวเลขกับภาพก่อนใช้ ค่าที่อ่านได้อาจคลาดเคลื่อน");
    } catch (e) {
      setStatus(
        `อ่านภาพไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)} · กรอกตัวเลขจากภาพเองได้`,
      );
    } finally {
      await worker?.terminate();
      setBusy(false);
    }
  }
  const candidates = ocrCandidates(text);
  return (
    <Modal title="ครอปและอ่านตัวเลขจากรูป" close={close}>
      <div className="form">
        <p>
          สำหรับภาพแชทยาว เลือกกรอบเฉพาะหน้าจอเครื่องหนึ่งรูป เพื่อไม่อ่านยอดสะสมปนกับเวลาวันนี้
        </p>
        <div className="crop-image">
          <img ref={img} src={src} alt="ภาพสำหรับอ่านตัวเลข" />
          <div
            className="crop-selection"
            style={{
              top: `${crop.top}%`,
              left: `${crop.left}%`,
              right: `${100 - crop.right}%`,
              bottom: `${100 - crop.bottom}%`,
            }}
          />
        </div>
        <div className="form-grid">
          {(["top", "bottom", "left", "right"] as const).map((key, i) => (
            <Field
              key={key}
              label={`${["ขอบบน", "ขอบล่าง", "ขอบซ้าย", "ขอบขวา"][i]} ${crop[key]}%`}
            >
              <input
                type="range"
                min="0"
                max="100"
                value={crop[key]}
                onChange={(e) =>
                  setCrop({ ...crop, [key]: Number(e.target.value) })
                }
              />
            </Field>
          ))}
        </div>
        <button className="secondary" disabled={busy} onClick={recognize}>
          <Search size={17} />
          {busy ? "กำลังอ่าน…" : "อ่านตัวเลขในกรอบ"}
        </button>
        <p role="status" className="muted">
          {status}
        </p>
        {candidates.times.length > 0 && (
          <div className="chips">
            {candidates.times.map((t) => (
              <button
                key={t}
                className={chosen === t ? "selected" : ""}
                onClick={() => setChosen(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="form-grid">
          <Field label="เวลาจากภาพที่เลือก">
            <input
              placeholder="mm:ss หรือ hh:mm:ss"
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
            />
          </Field>
          <Field label="ระยะทางที่ตรวจแล้ว (กม.)">
            <input
              type="number"
              min="0"
              step="0.001"
              value={dist}
              onChange={(e) => setDist(e.target.value)}
            />
          </Field>
        </div>
        <details>
          <summary>ข้อความที่อ่านได้ / วางข้อความเอง</summary>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="วางข้อความจากรูปเพื่อหาตัวเลือกเวลา"
          />
        </details>
        <div className="notice">
          รูปอ่านในเบราว์เซอร์ ไม่ส่งเข้า AI ภายนอก
          การอ่านครั้งแรกต้องใช้อินเทอร์เน็ตโหลดโมเดลภาษา
        </div>
        <button
          className="primary"
          disabled={busy || (!chosen && !dist)}
          onClick={() => {
            try {
              if (chosen) parseTime(chosen);
              if (dist && (!Number.isFinite(Number(dist)) || Number(dist) < 0))
                throw Error("ระยะไม่ถูกต้อง");
              apply(chosen || undefined, dist ? Number(dist) : undefined);
            } catch (e) {
              setStatus(String(e));
            }
          }}
        >
          ใช้ค่าที่ตรวจแล้ว <Check size={17} />
        </button>
      </div>
    </Modal>
  );
}
export function BodyForm({
  entry,
  close,
}: {
  entry?: Entry;
  close: () => void;
}) {
  const { run } = useData(),
    [photoId, setPhotoId] = useState<string | undefined>(entry?.data.photoId);
  return (
    <Modal title="บันทึกผลวัดร่างกาย" close={close}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            const data: Body = {
              date: String(f.get("date")),
              weight: number(f.get("weight")),
              waist: number(f.get("waist")),
              fat: number(f.get("fat")),
              smm: number(f.get("smm")),
              note: String(f.get("note")),
              photoId,
            };
            if (
              [data.weight, data.waist, data.fat, data.smm].every(
                (v) => v === null,
              )
            )
              throw Error("กรอกผลวัดอย่างน้อยหนึ่งค่า");
            await save("body", data, entry?.id);
            close();
          }, "บันทึกผลวัดแล้ว");
        }}
      >
        <Field label="วันที่วัด">
          <input
            name="date"
            type="date"
            required
            defaultValue={entry?.data.date ?? today()}
          />
        </Field>
        <div className="form-grid">
          {[
            ["weight", "น้ำหนัก (กก.)"],
            ["waist", "รอบเอว (ซม.)"],
            ["fat", "ไขมัน (%)"],
            ["smm", "มวลกล้ามเนื้อ (กก.)"],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <input
                name={k}
                type="number"
                min="0.1"
                max={k === "fat" ? 100 : 400}
                step="0.1"
                defaultValue={entry?.data[k] ?? ""}
              />
            </Field>
          ))}
        </div>
        <Field label="วิธีวัด / หมายเหตุ">
          <textarea
            name="note"
            defaultValue={entry?.data.note}
            placeholder="เช่น InBody / ก่อนอาหารเช้า"
          />
        </Field>
        <label className="secondary">
          <ImagePlus size={18} />
          แนบผล InBody
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                void run(async () =>
                  setPhotoId(await addPhoto(f, "ผลวัดร่างกาย")),
                );
            }}
          />
        </label>
        {photoId && (
          <div className="evidence-preview">
            <Photo id={photoId} alt="ผลวัด" />
          </div>
        )}
        <button className="primary">บันทึกผลวัด</button>
      </form>
    </Modal>
  );
}
function HistoryPage() {
  const { entries, run } = useData(),
    [selected, setSelected] = useState<Entry | null>(null),
    [filter, setFilter] = useState("all"),
    [gym, setGym] = useState("");
  const gymsOf = (e: Entry) =>
    new Set<string>(
      e.kind === "session"
        ? (e.data as Session).exercises
            .map((x) => entries.find((m) => m.id === x.machineId)?.data.gym)
            .filter(Boolean)
        : [],
    );
  const machineNames = (e: Entry) =>
    (e.data as Session).exercises
      .filter((x) => x.sets.some((a) => a.done))
      .map((x) => entries.find((m) => m.id === x.machineId)?.data.name)
      .filter(Boolean)
      .join(" · ");
  const rows = entries
    .filter(
      (e) =>
        !e.deleted &&
        ["session", "cardio", "body"].includes(e.kind) &&
        (filter === "all" || e.kind === filter) &&
        (!gym || (e.kind === "session" && gymsOf(e).has(gym))),
    )
    .sort((a, b) => (b.data.date || "").localeCompare(a.data.date || ""));
  return (
    <>
      <Header title="ประวัติ" subtitle="เวท คาร์ดิโอ และผลวัด เรียงจากล่าสุด" />
      <div className="chips">
        {[
          ["all", "ทั้งหมด"],
          ["session", "เวท"],
          ["cardio", "คาร์ดิโอ"],
          ["body", "ผลวัด"],
        ].map(([k, l]) => (
          <button
            className={filter === k ? "selected" : ""}
            key={k}
            onClick={() => {
              setFilter(k);
              if (k !== "session") setGym("");
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {filter === "session" && (
        <div className="chips">
          {[
            ["", "ทุกฟิตเนส"],
            ["WE Fitness", "WE Fitness"],
            ["Jett", "Jett"],
          ].map(([k, l]) => (
            <button
              className={gym === k ? "selected" : ""}
              key={k}
              onClick={() => setGym(k)}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {rows.map((e) => (
        <div key={e.id} className="history-row">
          <button className="history-open" onClick={() => setSelected(e)}>
            <span className="icon-disc">
              {e.kind === "session" ? (
                <Dumbbell />
              ) : e.kind === "cardio" ? (
                <Footprints />
              ) : (
                <Scale />
              )}
            </span>
            <div>
              <strong>
                {e.data.title ??
                  e.data.activity ??
                  `ผลวัด ${e.data.weight ?? "–"} กก.`}
              </strong>
              <small>
                {dateLabel(e.data.date)}
                {e.data.status === "draft"
                  ? " · กำลังฝึก"
                  : e.data.status === "review"
                    ? " · รอตรวจ"
                    : ""}
              </small>
              <small>
                {e.kind === "session"
                  ? machineNames(e) || e.data.source || e.data.note
                  : e.kind === "cardio"
                    ? `${minuteDuration(e.data.seconds)}${e.data.distance !== null ? ` · ${e.data.distance} กม.` : ""}`
                    : [
                        e.data.waist !== null && `เอว ${e.data.waist} ซม.`,
                        e.data.fat !== null && `ไขมัน ${e.data.fat}%`,
                        e.data.smm !== null && `กล้ามเนื้อ ${e.data.smm} กก.`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
              </small>
            </div>
            <ChevronRight size={18} />
          </button>
          <button
            className="icon"
            aria-label="ย้ายเข้าถังขยะ"
            onClick={() => run(() => trash(e.id), "ย้ายเข้าถังขยะแล้ว กู้คืนได้ในตั้งค่า")}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      {!rows.length && <Empty text="ยังไม่มีบันทึก เริ่มวันนี้ได้เลย" />}
      {selected &&
        (selected.kind === "session" ? (
          <SessionEditor id={selected.id} close={() => setSelected(null)} />
        ) : selected.kind === "cardio" ? (
          <CardioForm entry={selected} close={() => setSelected(null)} />
        ) : (
          <BodyForm entry={selected} close={() => setSelected(null)} />
        ))}
    </>
  );
}
function Login({ close, done }: { close: () => void; done: () => void }) {
  const { run } = useData(),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="เข้าสู่สมุดฝึกส่วนตัว" close={close}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            setBusy(true);
            try {
              const c = await cloud();
              if (!c) throw Error("ตั้งค่า Supabase ก่อน");
              const { error } = await c.auth.signInWithPassword({
                email: String(f.get("email")),
                password: String(f.get("password")),
              });
              if (error) throw error;
              done();
            } finally {
              setBusy(false);
            }
          });
        }}
      >
        <Field label="อีเมลบัญชีเจ้าของ">
          <input name="email" autoComplete="username" type="email" required />
        </Field>
        <Field label="รหัสผ่าน">
          <input
            name="password"
            autoComplete="current-password"
            type="password"
            required
          />
        </Field>
        <button className="primary" disabled={busy}>
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
        <p className="muted">
          ไม่มีการเปิดสมัครบัญชีสาธารณะ ใช้บัญชีเจ้าของที่ตั้งค่าใน Supabase
        </p>
      </form>
    </Modal>
  );
}
function ConnectionRecovery() {
  const { run } = useData(),
    [open, setOpen] = useState(false);
  return (
    <>
      <button className="secondary" onClick={() => setOpen(true)}>
        แก้การเชื่อมต่อ
      </button>
      {open && (
        <Modal title="แก้การเชื่อมต่อ" close={() => setOpen(false)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                configure({
                  url: String(f.get("url")).trim().replace(/\/$/, ""),
                  key: String(f.get("key")).trim(),
                });
                setOpen(false);
              });
            }}
          >
            <p>
              ตรวจว่า Project URL และ Publishable key ตรงกับโปรเจกต์ที่ตั้งบัญชีเจ้าของแล้ว
            </p>
            <Field label="Project URL">
              <input
                type="url"
                name="url"
                required
                defaultValue={config()?.url}
              />
            </Field>
            <Field label="Publishable key">
              <input name="key" required defaultValue={config()?.key} />
            </Field>
            <button className="primary">บันทึกการเชื่อมต่อ</button>
          </form>
        </Modal>
      )}
    </>
  );
}
function ArchiveItem({ e }: { e: Entry }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="archive-item"
      onToggle={(ev) => setOpen((ev.target as HTMLDetailsElement).open)}
    >
      <summary>{e.data.title}</summary>
      {open && (
        <>
          {e.data.photoId && (
            <div className="archive-photo">
              <Photo id={e.data.photoId} alt={e.data.title} />
            </div>
          )}
          <pre className="archive-text">{e.data.text}</pre>
        </>
      )}
    </details>
  );
}
function SettingsPage({
  synchronize,
  busy,
  openLogin,
}: {
  synchronize: () => void;
  busy: boolean;
  openLogin: () => void;
}) {
  const { entries, run, notify } = useData(),
    [cfg, setCfg] = useState(config()),
    [importFile, setImportFile] = useState<Blob | null>(null),
    [preview, setPreview] = useState<Entry[]>([]),
    [future, setFuture] = useState(0),
    [user, setUser] = useState(""),
    [configOpen, setConfigOpen] = useState(false);
  const settings = entries.find((e) => e.id === "settings-main")?.data ?? {},
    conflicts = entries.filter((e) => e.conflict);
  useEffect(() => {
    void cloud().then((c) =>
      c?.auth
        .getSession()
        .then(({ data }) => setUser(data.session?.user.email ?? "")),
    );
  }, [cfg]);
  async function inspect(f: Blob) {
    const p = await inspectBackup(f);
    setImportFile(f);
    setPreview(p.entries);
    setFuture(p.future.length);
  }
  return (
    <>
      <Header
        title="ตั้งค่า"
        subtitle="การซิงก์ เป้าหมาย โปรแกรมฝึก และการสำรองข้อมูล"
      />
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>การซิงก์ส่วนตัว</h2>
            <p>
              {user
                ? `เข้าสู่ระบบ: ${user}`
                : cfg
                  ? "ตั้งค่าแล้ว · เข้าสู่ระบบเพื่อซิงก์"
                  : "ตอนนี้บันทึกในเบราว์เซอร์เครื่องนี้ ยังไม่เชื่อมออนไลน์"}
            </p>
          </div>
          <Cloud size={24} />
        </div>
        <div className="upload-row">
          <button className="secondary" onClick={() => setConfigOpen(true)}>
            {cfg ? "แก้การเชื่อมต่อ" : "ตั้งค่า Supabase"}
          </button>
          {cfg && (
            <>
              <button className="primary" onClick={openLogin}>
                เข้าสู่ระบบ
              </button>
              <button
                className="secondary"
                onClick={synchronize}
                disabled={busy}
              >
                <RefreshCw size={16} />
                {busy ? "กำลังซิงก์…" : "ซิงก์ตอนนี้"}
              </button>
            </>
          )}
          {user && (
            <button
              className="text-button"
              onClick={() =>
                run(async () => {
                  const pending = entries.some((e) => e.dirty);
                  if (pending)
                    notify("รายการรอซิงก์ยังอยู่ในเครื่อง จะส่งเมื่อกลับเข้าบัญชีเดิม");
                  localStorage.setItem("lilly-locked", "true");
                  const result = await (
                    await cloud()
                  )?.auth.signOut({
                    scope: "local",
                  });
                  if (result?.error) throw result.error;
                  setUser("");
                }, "ออกจากระบบแล้ว")
              }
            >
              ออกจากระบบ
            </button>
          )}
        </div>
        <p className="muted">
          ข้อมูลและรูปส่วนตัวอยู่ในฐานข้อมูล ไม่อยู่ในโค้ด GitHub · รอซิงก์{" "}
          {entries.filter((e) => e.dirty).length} รายการ
        </p>
      </section>
      <RoutineSettings />
      <section className="panel">
        <h2>เป้าหมายรายสัปดาห์</h2>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(
              () =>
                save(
                  "settings",
                  {
                    ...settings,
                    cardioGoal: Number(f.get("cardioGoal")),
                    walkGoal: Number(f.get("walkGoal")),
                  },
                  "settings-main",
                ),
              "บันทึกเป้าหมายแล้ว",
            );
          }}
        >
          <div className="form-grid">
            <Field label="คาร์ดิโอทั้งหมด (นาที)">
              <input
                type="number"
                name="cardioGoal"
                min="1"
                max="10080"
                required
                defaultValue={settings.cardioGoal ?? 150}
              />
            </Field>
            <Field label="เฉพาะเดิน (นาที)">
              <input
                type="number"
                name="walkGoal"
                min="1"
                max="10080"
                required
                defaultValue={settings.walkGoal ?? 150}
              />
            </Field>
          </div>
          <p className="muted">
            รอบเริ่มอาทิตย์ สิ้นสุดเสาร์ · เวลาไทย · เลือกรอบชดเชยเป็นรายกิจกรรม
          </p>
          <button className="secondary">บันทึกเป้าหมาย</button>
        </form>
      </section>
      <section className="panel">
        <h2>สำรองข้อมูล</h2>
        <p className="muted">
          ZIP รวมข้อมูลและรูปทั้งหมด · CSV สำหรับเปิดใน Excel / Google Sheets
        </p>
        <div className="upload-row">
          <button
            className="primary"
            onClick={() =>
              run(
                async () =>
                  download(await exportBackup(), `lilly-backup-${today()}.zip`),
                "ดาวน์โหลดข้อมูลสำรองแล้ว",
              )
            }
          >
            <Download size={17} />
            สำรอง ZIP พร้อมรูป
          </button>
          <button
            className="secondary"
            onClick={() =>
              run(async () =>
                download(await exportCSV(), `lilly-data-${today()}.csv`),
              )
            }
          >
            ส่งออก CSV
          </button>
          {import.meta.env.DEV && (
            <button
              className="secondary"
              onClick={() =>
                run(async () => {
                  const r = await fetch("/__private_seed");
                  if (!r.ok) throw Error("ไม่พบไฟล์ข้อมูลตั้งต้นในเครื่อง");
                  await inspect(await r.blob());
                })
              }
            >
              โหลดข้อมูลตั้งต้น (เฉพาะโหมดพัฒนา)
            </button>
          )}
        </div>
      </section>
      {conflicts.length > 0 && (
        <section className="panel">
          <h2>รายการแก้ไขชนกัน</h2>
          {conflicts.map((e) => (
            <div className="conflict" key={e.id}>
              <strong>
                {e.data.title ?? e.data.name ?? e.data.activity ?? e.kind}
              </strong>
              <div className="form-grid">
                <div>
                  <h4>ในเครื่องนี้</h4>
                  <pre>{JSON.stringify(e.data, null, 2)}</pre>
                  <button
                    className="secondary"
                    onClick={() =>
                      run(
                        () => resolveConflict(e.id, "local"),
                        "เลือกฉบับในเครื่องแล้ว กดซิงก์เพื่อส่ง",
                      )
                    }
                  >
                    ใช้ฉบับในเครื่อง
                  </button>
                </div>
                <div>
                  <h4>จากออนไลน์</h4>
                  <pre>
                    {e.conflict?.deleted
                      ? "รายการถูกลบ"
                      : JSON.stringify(e.conflict?.data, null, 2)}
                  </pre>
                  <button
                    className="secondary"
                    onClick={() =>
                      run(
                        () => resolveConflict(e.id, "remote"),
                        "ใช้ฉบับออนไลน์แล้ว",
                      )
                    }
                  >
                    ใช้ฉบับออนไลน์
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="panel">
        <h2>ถังขยะ · กู้คืนได้</h2>
        {entries
          .filter((e) => e.deleted)
          .map((e) => (
            <div className="trash-row" key={e.id}>
              <span>
                {e.data.name ?? e.data.title ?? e.data.activity ?? e.kind} ·{" "}
                {e.data.date ?? ""}
              </span>
              <button
                className="text-button"
                onClick={() => run(() => restoreEntry(e.id), "กู้คืนแล้ว")}
              >
                กู้คืน
              </button>
            </div>
          ))}
        {!entries.some((e) => e.deleted) && (
          <p className="muted">ไม่มีรายการในถังขยะ</p>
        )}
      </section>
      <section className="panel">
        <h2>คลังข้อมูลเดิม</h2>
        <p className="muted">
          อาหาร แผนเก่า และโน้ตต้นฉบับ เก็บไว้อ้างอิง ไม่ถูกนับเป็นผลฝึกจริง
        </p>
        {entries
          .filter((e) => e.kind === "archive" && !e.deleted)
          .map((e) => (
            <ArchiveItem key={e.id} e={e} />
          ))}
      </section>
      {configOpen && (
        <Modal title="เชื่อม Supabase" close={() => setConfigOpen(false)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                configure({
                  url: String(f.get("url")).trim().replace(/\/$/, ""),
                  key: String(f.get("key")).trim(),
                });
                setCfg(config());
                setConfigOpen(false);
              }, "บันทึกการเชื่อมต่อแล้ว");
            }}
          >
            <p>
              ใช้ Project URL และ Publishable key จากบัญชีของคุณ ต้องรัน schema.sql
              และตั้งบัญชีเจ้าของก่อน
            </p>
            <Field label="Project URL">
              <input
                name="url"
                type="url"
                placeholder="https://project.supabase.co"
                defaultValue={cfg?.url}
                required
              />
            </Field>
            <Field label="Publishable key / anon key">
              <input
                name="key"
                defaultValue={cfg?.key}
                required
                placeholder="sb_publishable_…"
              />
            </Field>
            <div className="notice">
              ห้ามใส่ Secret key หรือ service_role · เปลี่ยนโปรเจกต์ให้สำรองข้อมูลก่อนเสมอ
            </div>
            <button className="primary">บันทึกการเชื่อมต่อ</button>
          </form>
        </Modal>
      )}
      {importFile && (
        <Modal title="ตรวจข้อมูลก่อนนำเข้า" close={() => setImportFile(null)}>
          <div className="form">
            <p>
              พบ {preview.length} รายการ · จะเพิ่ม{" "}
              {
                preview.filter((e) => !entries.some((x) => x.id === e.id))
                  .length
              }{" "}
              รายการใหม่
            </p>
            <p className="muted">
              รายการที่มีรหัสอยู่แล้วจะถูกข้าม จึงโหลดซ้ำได้โดยยอดไม่เบิ้ล
            </p>
            {future > 0 && (
              <div className="notice">
                มี {future} รายการลงวันที่ในอนาคต จะเก็บเป็น “รอตรวจ/ร่าง” ไม่นับเป็นผลจริง
              </div>
            )}
            <div className="import-preview">
              {preview
                .filter((e) => e.kind !== "photo")
                .map((e) => (
                  <div key={e.id}>
                    <strong>
                      {e.data.name ?? e.data.title ?? e.data.activity ?? e.kind}
                    </strong>
                    <small>
                      {e.data.date ?? "ไม่ทราบวัน"} · {e.data.status ?? e.kind}
                    </small>
                    {e.data.note && <p>{e.data.note}</p>}
                  </div>
                ))}
            </div>
            <button
              className="primary"
              onClick={() =>
                run(async () => {
                  const result = await importBackup(importFile, false);
                  setImportFile(null);
                  notify(
                    `นำเข้าแล้ว ${result.added} รายการ · ข้ามรหัสเดิม ${result.skipped} รายการ`,
                  );
                  if (config()) await synchronize();
                })
              }
            >
              ยืนยันนำเข้า
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function SessionEditor({
  id,
  close,
  focusMachine,
}: {
  id: string;
  close: () => void;
  focusMachine?: string;
}) {
  const { entries } = useData();
  const source = entries.find((e) => e.id === id);
  return source ? (
    <SessionEditorForm
      source={source}
      close={close}
      focusMachine={focusMachine}
    />
  ) : (
    <Modal title="กำลังเปิดการฝึก" close={close}>
      <Empty text="กำลังอ่านข้อมูลที่บันทึก…" />
    </Modal>
  );
}
const emptySet = (prev?: SetLog): SetLog => ({
  id: uid(),
  load: prev?.load ?? null,
  ...(prev?.loadText !== undefined && prev.load === null
    ? { loadText: prev.loadText }
    : {}),
  reps: prev?.reps ?? null,
  warmup: false,
  done: false,
});
const isTextLoad = (x: ExerciseLog) =>
  x.loadMode !== "bodyweight" &&
  x.sets.some((a) => a.load === null && typeof a.loadText === "string");
function SessionEditorForm({
  source,
  close,
  focusMachine,
}: {
  source: Entry;
  close: () => void;
  focusMachine?: string;
}) {
  const id = source.id;
  const { entries, run, notify } = useData(),
    [s, setS] = useState<Session>(() => structuredClone(source.data)),
    [saving, setSaving] = useState(false),
    [addMachine, setAddMachine] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [focus, setFocus] = useState<number | null>(() => {
      const i = (source.data as Session).exercises.findIndex(
        (x) => x.machineId === focusMachine,
      );
      return i >= 0 ? i : null;
    });
  const latest = useRef(s);
  latest.current = s;
  const savedText = useRef(JSON.stringify(source.data));
  const writeQueue = useRef(Promise.resolve());
  const scroller = useRef<HTMLDivElement>(null);
  const saveDraft = (next: Session) => {
    const snapshot = structuredClone(next);
    writeQueue.current = writeQueue.current
      .catch(() => {})
      .then(async () => {
        const text = JSON.stringify(snapshot);
        if (text === savedText.current) return;
        await save("session", snapshot, id);
        savedText.current = text;
      });
    return writeQueue.current;
  };
  useEffect(() => {
    if (JSON.stringify(s) === savedText.current) return;
    const timeout = setTimeout(() => {
      void run(() => saveDraft(s));
    }, 500);
    return () => clearTimeout(timeout);
  }, [s]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== savedText.current)
        e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, []);
  useEffect(() => {
    const modal = scroller.current?.closest<HTMLElement>(".modal");
    if (modal) modal.scrollTop = 0;
  }, [focus]);
  const update = (i: number, x: ExerciseLog) =>
    setS((v) => ({
      ...v,
      exercises: v.exercises.map((a, n) => (n === i ? x : a)),
    }));
  const patchSet = (i: number, j: number, patch: Partial<SetLog>) =>
    setS((v) => ({
      ...v,
      exercises: v.exercises.map((x, n) =>
        n === i
          ? {
              ...x,
              sets: x.sets.map((a, k) => (k === j ? { ...a, ...patch } : a)),
            }
          : x,
      ),
    }));
  const doneCount = s.exercises.filter((x) =>
    x.sets.some((a) => a.done),
  ).length;
  async function finish() {
    if (!s.date) {
      notify("เลือกวันที่ฝึก");
      return;
    }
    if (s.date > today()) {
      notify("ผลที่ทำแล้วต้องไม่เป็นวันที่ในอนาคต");
      return;
    }
    if (
      s.exercises.some(
        (x) =>
          !x.reportedOnly &&
          x.sets.some(
            (a) =>
              a.done &&
              (a.reps === null || a.reps <= 0 || !hasLoad(a, x.loadMode)),
          ),
      )
    ) {
      notify("เซตที่ยืนยันต้องมีน้ำหนักและจำนวนครั้งครบ");
      return;
    }
    if (!s.exercises.some((x) => x.sets.some((a) => a.done)) && !s.summary) {
      notify("ยืนยันอย่างน้อยหนึ่งเซตก่อนจบ");
      return;
    }
    setSaving(true);
    await run(
      async () => {
        await saveDraft({
          ...s,
          status: s.status === "draft" ? "completed" : s.status,
        });
        close();
      },
      s.status === "draft" ? "บันทึกการฝึกแล้ว" : "บันทึกการแก้ไขแล้ว",
    );
    setSaving(false);
  }
  const keep = () =>
    run(async () => {
      await saveDraft(latest.current);
      close();
    });
  const x = focus !== null ? s.exercises[focus] : undefined;
  const m = x
    ? (entries.find((e) => e.id === x.machineId)?.data as Machine | undefined)
    : undefined;
  return (
    <Modal title={x ? (m?.name ?? "เครื่อง") : s.title || "การฝึก"} close={keep}>
      <div className="form" ref={scroller}>
        {x && focus !== null ? (
          <ExerciseFocus
            key={x.machineId}
            x={x}
            index={focus}
            total={s.exercises.length}
            sessionId={id}
            date={s.date}
            update={(v) => update(focus, v)}
            patchSet={(j, p) => patchSet(focus, j, p)}
            back={() => setFocus(null)}
            go={(n) => setFocus(n)}
          />
        ) : (
          <>
            <div className="form-grid">
              <Field label="ชื่อการฝึก">
                <input
                  value={s.title}
                  onChange={(e) => setS({ ...s, title: e.target.value })}
                />
              </Field>
              <Field label="วันที่ฝึก">
                <input
                  type="date"
                  value={s.date}
                  max={today()}
                  onChange={(e) => setS({ ...s, date: e.target.value })}
                />
              </Field>
            </div>
            {s.exercises.length > 0 && (
              <div className="progress-line">
                <div>
                  <span
                    style={{
                      width: `${(doneCount / s.exercises.length) * 100}%`,
                    }}
                  />
                </div>
                <small>
                  เสร็จ {doneCount}/{s.exercises.length} ท่า
                  {s.status === "draft" ? " · บันทึกร่างอัตโนมัติ" : ""}
                </small>
              </div>
            )}
            {s.summary && <div className="notice preserve">{s.summary}</div>}
            <div className="exercise-list">
              {s.exercises.map((x, i) => {
                const m = entries.find((e) => e.id === x.machineId)?.data as
                  Machine | undefined;
                const last = latestExercise(entries, x.machineId, s.date, id);
                const done = x.sets.filter((a) => a.done);
                return (
                  <div
                    className={`exercise-item ${done.length ? "done" : ""}`}
                    key={x.machineId}
                  >
                    <button
                      className="exercise-open"
                      aria-label={`เปิด ${m?.name ?? "เครื่อง"}`}
                      onClick={() => setFocus(i)}
                    >
                      <span className="exercise-thumb">
                        <Photo
                          id={m?.photoId ?? m?.referencePhotoId}
                          alt={m?.name ?? "เครื่อง"}
                        />
                        <b>{i + 1}</b>
                      </span>
                      <span className="exercise-text">
                        <strong>{m?.name ?? "ไม่ทราบเครื่อง"}</strong>
                        {done.length ? (
                          <small className="ok">
                            {done
                              .map((a) => formatSet(a, x.loadMode))
                              .join(" / ")}
                          </small>
                        ) : (
                          <small>
                            ครั้งก่อน{" "}
                            {last
                              ? `${shortDate(last.entry.data.date)}: ${last
                                  .exercise!.sets.filter((a) => a.done)
                                  .map((a) =>
                                    formatSet(a, last.exercise!.loadMode),
                                  )
                                  .join(" / ")}`
                              : "· ยังไม่มีผล"}
                          </small>
                        )}
                        {x.setup && <small className="muted">{x.setup}</small>}
                      </span>
                      {done.length ? (
                        <span className="state-badge">
                          <Check size={15} />
                        </span>
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </button>
                    {s.status === "draft" && (
                      <button
                        className="icon remove"
                        aria-label={`เอา ${m?.name ?? "ท่านี้"} ออกจากการฝึก`}
                        onClick={() =>
                          setS((v) => ({
                            ...v,
                            exercises: v.exercises.filter((_, n) => n !== i),
                          }))
                        }
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!s.exercises.length && (
              <Empty text="ยังไม่มีท่าในการฝึกนี้ กดเพิ่มท่าเพื่อเริ่ม" />
            )}
            <div className="upload-row">
              <button className="secondary" onClick={() => setAddMachine(true)}>
                <Plus size={16} />
                เพิ่มท่า
              </button>
              <button
                className="secondary"
                onClick={() =>
                  run(
                    () =>
                      navigator.clipboard.writeText(workoutMessage(s, entries)),
                    "คัดลอกสรุปเวทแล้ว",
                  )
                }
              >
                <Copy size={16} />
                คัดลอกสรุปเวท
              </button>
            </div>
            <Field label="บันทึกการฝึก">
              <textarea
                value={s.note}
                placeholder="เช่น สิ่งที่โค้ชแนะนำวันนี้"
                onChange={(e) => setS({ ...s, note: e.target.value })}
              />
            </Field>
            {confirmDelete ? (
              <div className="notice confirm-delete">
                ย้ายการฝึกนี้เข้าถังขยะ? กู้คืนได้ที่หน้าตั้งค่า
                <div className="upload-row">
                  <button
                    className="danger"
                    onClick={() =>
                      run(async () => {
                        await writeQueue.current.catch(() => {});
                        await trash(id);
                        close();
                      }, "ย้ายการฝึกเข้าถังขยะแล้ว")
                    }
                  >
                    <Trash2 size={16} />
                    ย้ายเข้าถังขยะ
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setConfirmDelete(false)}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="text-button danger-text"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} />
                ลบการฝึกนี้
              </button>
            )}
            <div className="sticky-actions">
              {s.status === "draft" && (
                <button className="secondary" onClick={keep}>
                  เก็บไว้ก่อน
                </button>
              )}
              <button className="primary" disabled={saving} onClick={finish}>
                <Check size={18} />
                {s.status === "draft" ? "จบการฝึก" : "บันทึกการแก้ไข"}
              </button>
            </div>
          </>
        )}
        {addMachine && (
          <MachinePicker
            excluded={s.exercises.map((x) => x.machineId)}
            close={() => setAddMachine(false)}
            choose={(picked) => {
              setS((v) => ({
                ...v,
                exercises: [...v.exercises, exerciseFor(picked)],
              }));
              setAddMachine(false);
            }}
          />
        )}
      </div>
    </Modal>
  );
}
function ExerciseFocus({
  x,
  index,
  total,
  sessionId,
  date,
  update,
  patchSet,
  back,
  go,
}: {
  x: ExerciseLog;
  index: number;
  total: number;
  sessionId: string;
  date: string;
  update: (x: ExerciseLog) => void;
  patchSet: (j: number, p: Partial<SetLog>) => void;
  back: () => void;
  go: (n: number) => void;
}) {
  const { entries, notify } = useData();
  const m = entries.find((e) => e.id === x.machineId)?.data as
    Machine | undefined;
  const last = latestExercise(entries, x.machineId, date || today(), sessionId),
    best = bestSet(
      entries.filter((e) => e.id !== sessionId),
      x.machineId,
    ),
    textLoad = isTextLoad(x);
  const unit =
    x.loadMode === "bodyweight" ? "" : textLoad ? "" : loadLabel(x.loadMode);
  return (
    <>
      <div className="focus-nav">
        <button className="text-button" onClick={back}>
          <ArrowLeft size={17} />
          รายการวันนี้
        </button>
        <span className="muted">
          ท่า {index + 1}/{total}
        </span>
      </div>
      <div className="focus-photo">
        <Photo
          id={m?.photoId ?? m?.referencePhotoId}
          alt={m?.name ?? "เครื่อง"}
        />
        {!m?.photoId && m?.referencePhotoId && (
          <span className="reference-label">รูปอ้างอิงจาก Jett</span>
        )}
      </div>
      <div className="focus-title">
        <small>
          {m?.gym} · {m?.group} · {loadLabel(x.loadMode)}
        </small>
        <h3>{m?.name ?? "ไม่ทราบเครื่อง"}</h3>
        {m?.thai && <p className="muted">{m.thai}</p>}
      </div>
      <div className="info-grid">
        <div className="previous">
          <span className="eyebrow">ครั้งก่อน</span>
          <h4>{last ? dateLabel(last.entry.data.date) : "ยังไม่มีผลที่ยืนยัน"}</h4>
          {last?.exercise?.sets
            .filter((a) => a.done)
            .map((a, k) => (
              <p key={k}>
                {last.exercise!.reportedOnly ? "ผลที่รายงาน" : `เซต ${k + 1}`}:{" "}
                <strong>{formatSet(a, last.exercise!.loadMode)}</strong>
              </p>
            ))}
          {last?.exercise?.setup && (
            <p className="muted">ตั้งเครื่อง: {last.exercise.setup}</p>
          )}
          {last && (
            <button
              className="text-button"
              onClick={() =>
                update({
                  ...x,
                  sets: last
                    .exercise!.sets.filter((a) => a.done)
                    .map((a) => ({
                      ...a,
                      id: uid(),
                      done: false,
                      warmup: false,
                    })),
                })
              }
            >
              <Copy size={14} />
              ใช้ค่าครั้งก่อนเป็นค่าตั้งต้น
            </button>
          )}
        </div>
        <div className="previous best">
          <span className="eyebrow">สถิติสูงสุด</span>
          {best ? (
            <>
              <h4>{formatSet(best.set, best.mode)}</h4>
              <p className="muted">{dateLabel(best.date)}</p>
            </>
          ) : (
            <h4>ยังไม่มี</h4>
          )}
          {m?.historicalResult && (
            <p className="muted">สถิติเก่า (ไม่ทราบวัน): {m.historicalResult}</p>
          )}
        </div>
      </div>
      {x.reportedOnly && (
        <div className="notice">
          ผลที่รายงาน · ไม่ทราบจำนวนเซตจริง แถวนี้ไม่ใช่จำนวนเซตที่เล่น
        </div>
      )}
      <RestTimer />
      <div className="set-table">
        <div className="set-head">
          <span>เซต</span>
          <span>{textLoad ? "น้ำหนัก (ข้อความ)" : `น้ำหนัก ${unit}`}</span>
          <span>ครั้ง</span>
          <span>วอร์ม</span>
          <span>เสร็จ</span>
          <span />
        </div>
        {x.sets.map((a, j) => (
          <div className={`set-row ${a.done ? "done" : ""}`} key={a.id}>
            <span className="set-no">{x.reportedOnly ? "ผล" : j + 1}</span>
            {textLoad ? (
              <input
                aria-label={`เซต ${j + 1} น้ำหนักแบบข้อความ`}
                value={a.loadText ?? ""}
                placeholder="เช่น 13.5 กก. + 10 ที่หมุน"
                onChange={(e) => patchSet(j, { loadText: e.target.value })}
              />
            ) : (
              <input
                aria-label={`เซต ${j + 1} น้ำหนัก`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder={x.loadMode === "bodyweight" ? "ตัว" : "–"}
                value={a.load ?? ""}
                disabled={x.loadMode === "bodyweight"}
                onChange={(e) =>
                  patchSet(j, {
                    load: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            )}
            <input
              aria-label={`เซต ${j + 1} จำนวนครั้ง`}
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="–"
              value={a.reps ?? ""}
              onChange={(e) =>
                patchSet(j, {
                  reps: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <input
              aria-label={`เซต ${j + 1} เป็นเซตวอร์ม`}
              type="checkbox"
              checked={a.warmup}
              onChange={(e) => patchSet(j, { warmup: e.target.checked })}
            />
            <button
              className={`set-check ${a.done ? "checked" : ""}`}
              aria-label={`ยืนยันเซต ${j + 1}`}
              aria-pressed={a.done}
              onClick={() => {
                if (!a.done && (!a.reps || !hasLoad(a, x.loadMode))) {
                  notify("กรอกน้ำหนักและจำนวนครั้งก่อนยืนยัน");
                  return;
                }
                patchSet(j, { done: !a.done });
              }}
            >
              <Check size={18} />
            </button>
            <button
              className="set-remove"
              aria-label={`ลบเซต ${j + 1}`}
              disabled={x.sets.length === 1}
              onClick={() =>
                update({ ...x, sets: x.sets.filter((_, k) => k !== j) })
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="upload-row set-tools">
        <button
          className="secondary"
          onClick={() =>
            update({ ...x, sets: [...x.sets, emptySet(x.sets.at(-1))] })
          }
        >
          <Plus size={16} />
          เพิ่มเซต
        </button>
        {x.loadMode !== "bodyweight" && (
          <button
            className="text-button"
            onClick={() =>
              update({
                ...x,
                sets: x.sets.map((a) => {
                  if (textLoad) {
                    const n = Number(
                      a.loadText?.replace(/กก\.?|kg/gi, "").trim(),
                    );
                    const { loadText: _drop, ...rest } = a;
                    return {
                      ...rest,
                      load: a.loadText?.trim() && Number.isFinite(n) ? n : null,
                    };
                  }
                  return {
                    ...a,
                    loadText:
                      a.load !== null ? `${a.load} กก.` : (a.loadText ?? ""),
                    load: null,
                  };
                }),
              })
            }
          >
            {textLoad ? "กรอกน้ำหนักเป็นตัวเลข" : "กรอกน้ำหนักเป็นข้อความ"}
          </button>
        )}
      </div>
      <Field label="การตั้งเครื่องครั้งนี้">
        <input
          value={x.setup}
          placeholder="เช่น เบาะระดับ 6"
          onChange={(e) => update({ ...x, setup: e.target.value })}
        />
      </Field>
      {m?.cues && (
        <details className="how-to" open>
          <summary>วิธีเล่น</summary>
          <p className="preserve">{m.cues}</p>
        </details>
      )}
      <Field label="โน้ตท่านี้">
        <input
          value={x.note}
          placeholder="ความรู้สึก / สิ่งที่โค้ชแนะนำ"
          onChange={(e) => update({ ...x, note: e.target.value })}
        />
      </Field>
      <div className="sticky-actions split">
        <button
          className="secondary"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <ArrowLeft size={16} />
          ก่อนหน้า
        </button>
        {index < total - 1 ? (
          <button className="primary" onClick={() => go(index + 1)}>
            ท่าถัดไป
            <ChevronRight size={17} />
          </button>
        ) : (
          <button className="primary" onClick={back}>
            <Check size={17} />
            กลับรายการ
          </button>
        )}
      </div>
    </>
  );
}
