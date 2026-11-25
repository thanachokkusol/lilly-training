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
  ExerciseTarget,
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
  moveReviewedSession,
  moveMachinePhoto,
  addMissingHomeTraining,
  alignOctoberWalkWeeks,
  removeEmptyNovemberPulldown,
  addBundledMachinePhotos,
  adoptLocalAccount,
  clearLocalAccount,
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
  octoberWalkWeek,
  machineHistory,
  bestSet,
  hasLoad,
  weightLines,
  exerciseKey,
  machinePhotoIds,
  totalLoad,
  activityEmoji,
} from "./core";
import {
  cloud,
  config,
  configure,
  sync,
  resolveConflict,
  loginEmail,
  myProfile,
  myClients,
  fetchUserRecords,
  remotePhoto,
  machineEditor,
  currentProfile,
  type Profile,
  type Client,
} from "./cloud";
import { isReadOnly, setReadOnly } from "./db";
import { usePastedImage } from "./usePastedImage";
import {
  TrainerAccounts,
  ChangePassword,
  EditDisplayName,
  MyClients,
  MyCoaches,
  SignupSettings,
  SignupForm,
} from "./Accounts";
import PasswordInput from "./PasswordInput";
/** Common equipment and programs; everything else belongs to one person. */
const isSharedEntry = (e: Entry) =>
  e.kind === "machine" ||
  e.kind === "routine" ||
  e.id === "settings-gym-catalog" ||
  (e.kind === "photo" && !!e.data?.machineId);
const Progress = lazy(() => import("./Progress"));
import ExerciseChart from "./ExerciseChart";
import { gymCatalogId, gymName, gymsFor, type Gym } from "./gyms";
import { planSessionMove, type MachineMove } from "./migration";
import { recoverFormDraft } from "./formDraft";
import { exerciseDemoLink, exerciseGuide, exerciseGuideFrames, homeCoachRoutine, homeLegsRoutine, homeGym, homeMoves, isObsoleteHomeRoutine } from "./homeTraining";
import { reportUrl } from "./bodyDetails";
import { cardioMix } from "./cardioMix";
import Stretch from "./Stretch";
import { chestStretchRoutine, isStretch, stretchMoves, stretchTiming } from "./stretchTraining";
import StrengthTile from "./StrengthTile";
type Context = {
  entries: Entry[];
  refresh: () => Promise<void>;
  run: (fn: () => Promise<unknown>, msg?: string) => Promise<void>;
  notify: (m: string) => void;
  readOnly: boolean;
};
export const Data = createContext<Context>(null!);
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
const targetText = (target: ExerciseTarget) => `${target.sets} เซต × ${target.reps} ครั้ง`;
function exerciseFor(
  machine: Entry, entries: Entry[] = [], date = today(), sessionId?: string, target?: ExerciseTarget,
): ExerciseLog {
  const m = machine.data as Machine;
  if (isStretch(machine.id)) return { machineId: machine.id, setup: m.setup, loadMode: "bodyweight", note: "", sets: [] };
  const last = latestExercise(entries, machine.id, date, sessionId)?.exercise;
  const comparable = last && (last.loadMode === m.loadMode ||
    (["total", "per-side"].includes(last.loadMode) && ["total", "per-side"].includes(m.loadMode)));
  const previous = comparable ? last.sets.filter((set) => set.done && !set.warmup) : [];
  const suggestedSets = last?.reportedOnly ? previous.slice(0, 1) : previous;
  if (target) return {
    machineId: machine.id,
    setup: m.setup,
    loadMode: m.loadMode,
    note: "",
    target,
    // The planned repetitions are only a starting value; a set counts after it is confirmed.
    sets: Array.from({ length: target.sets }, (_, index) => {
      const before = suggestedSets[Math.min(index, suggestedSets.length - 1)];
      return {
        id: uid(), reps: target.reps, warmup: false, done: false,
        load: before ? totalLoad(before, last!.loadMode) : null,
        ...(before && { enteredAs: before.enteredAs ?? (last!.loadMode === "per-side" ? "perSide" : "total") }),
      };
    }),
  };
  return {
    machineId: machine.id,
    setup: m.setup,
    loadMode: m.loadMode,
    note: "",
    sets: suggestedSets.length
      ? suggestedSets.map((set) => ({
          ...set, id: uid(), done: false,
          load: totalLoad(set, last!.loadMode),
          enteredAs: set.enteredAs ?? (last!.loadMode === "per-side" ? "perSide" : "total"),
        }))
      : [{ id: uid(), load: null, reps: null, warmup: false, done: false }],
  };
}
function newSession(
  title: string,
  machineIds: string[],
  entries: Entry[],
  date = today(),
  gym?: string,
  targets: Record<string, ExerciseTarget> = {},
): Session {
  return {
    date,
    gym,
    title,
    status: "draft",
    note: "",
    exercises: machineIds.flatMap((id) => {
      const m = entries.find((e) => e.id === id && e.kind === "machine");
      return m ? [exerciseFor(m, entries, date, undefined, targets[id])] : [];
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
  const { entries, readOnly } = useData();
  const revision = entries.find(
    (e) => e.id === id && e.kind === "photo",
  );
  const path = revision?.data?._photoPath;
  const version = revision?.version;
  const updatedAt = revision?.updatedAt;
  useEffect(() => {
    let alive = true,
      url = "";
    setSrc("");
    if (id)
      photoBlob(id).then(async (local) => {
        const b = local ?? (path ? await remotePhoto(path) : undefined);
        if (b && alive) {
          url = URL.createObjectURL(b);
          setSrc(url);
        }
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, path, version, updatedAt]);
  return src ? (
    <img className={className} src={src} alt={alt} />
  ) : (
    <div className={`photo-empty ${className}`}>
      <Dumbbell size={36} />
      <span>{readOnly ? "ยังไม่มีรูป" : "เพิ่มรูปเครื่องของคุณ"}</span>
    </div>
  );
}
export function Modal({
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
function viewStorageKey(name: string) {
  const cloudUrl = config()?.url;
  return `lilly-view:${sandbox ? "sandbox" : cloudUrl ?? "local"}:${name}`;
}

function readView(name: string): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(viewStorageKey(name)) ?? "null");
    return saved && Date.now() - saved.at < 12 * 60 * 60 * 1000 ? saved.value : null;
  }
  catch { return null; }
}

function writeView(name: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(viewStorageKey(name));
    else localStorage.setItem(viewStorageKey(name), JSON.stringify({ value, at: Date.now() }));
  } catch { /* Views can still open when storage is unavailable. */ }
}

export function useRememberedView(name: string, fallback: string | null = null) {
  const [value, setValue] = useState(() => readView(name) ?? fallback);
  return [value, (next: string | null) => {
    writeView(name, next);
    setValue(next);
  }] as const;
}

function useNavigate() {
  const [page, setPage] = useState(() => {
    if (location.hash) return location.hash.slice(1);
    try {
      const saved = JSON.parse(localStorage.getItem("lilly-last-page") ?? "null");
      if (saved && typeof saved.page === "string" &&
          /^(today|machines|cardio(?:#report)?|progress|history|settings)$/.test(saved.page) &&
          Date.now() - saved.at < 12 * 60 * 60 * 1000) return saved.page;
    } catch { /* An unavailable route cache should never prevent startup. */ }
    return "today";
  });
  useEffect(() => {
    try {
      localStorage.setItem("lilly-last-page", JSON.stringify({ page, at: Date.now() }));
    } catch { /* Navigation still works without storage. */ }
  }, [page]);
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
    [initialSync, setInitialSync] = useState<string | null>(null),
    [login, setLogin] = useState(false),
    [profile, setProfile] = useState<Profile | null>(null),
    [clients, setClients] = useState<Client[]>([]),
    [viewing, setViewing] = useState<Client | null>(null),
    [clientRecords, setClientRecords] = useState<Entry[]>([]),
    [authUser, setAuthUser] = useState<string | null>(
      config() ? null : "local",
    );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const syncing = useRef(false);
  const latestUser = useRef(authUser);
  latestUser.current = authUser;
  const viewRequest = useRef(0);
  const refresh = async () => {
    setEntries(await allEntries());
    setLoaded(true);
  };
  const notify = (s: string) => {
    setToast(s);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
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
    if (syncing.current) return;
    syncing.current = true;
    setBusy(true);
    const startedAs = latestUser.current;
    let retry = false;
    try {
      // Sign-in starts a sync before the account is verified, so mark the account that was actually synced.
      const r = await sync(async (userId) => {
        await refresh();
        setInitialSync(userId);
      });
      await refresh();
      if (!silent && (r.pushed || r.conflicts || r.missingPhotos))
        notify(
          `ซิงก์แล้ว · ส่ง ${r.pushed} รายการ${r.conflicts ? ` · รอเลือกฉบับ ${r.conflicts} รายการ` : ""}${r.missingPhotos ? ` · รูปรอดึง ${r.missingPhotos} รูป` : ""}`,
        );
    } catch (e) {
      if (!silent) notify(e instanceof Error ? e.message : String(e));
      retry = latestUser.current !== startedAs;
      if (!retry) setInitialSync(startedAs);
    } finally {
      syncing.current = false;
      setBusy(false);
      if (retry) void synchronize(true);
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
      // Token refreshes repeat for the same account; keep the open page while it is checked again.
      setAuthUser((user) => user === session.user.id ? user : null);
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
            const member = !error && data === true;
            // Signing in as a different account replaces this browser's local copy (when nothing is unsynced).
            if (member && (await adoptLocalAccount(session.user.id))) {
              localStorage.removeItem("lilly-locked");
              await refresh();
            }
            if (live && n === generation) setAuthUser(member ? session.user.id : "");
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
  const canSync = Boolean(cloudUrl && authUser && authUser !== "local");
  const cachedOwner = localStorage.getItem("lilly-owner");
  const locked = cloudUrl && (!authUser || localStorage.getItem("lilly-locked") === "true" ||
    (cachedOwner && cachedOwner !== authUser));
  const ready = loaded && (!canSync || !online || initialSync === authUser);
  const needsHomeTraining = [homeCoachRoutine, homeLegsRoutine, chestStretchRoutine, ...homeMoves, ...stretchMoves].some(({ id }) =>
    !entries.some((entry) => entry.id === id));
  const obsoleteHomeRoutineId = entries.find(isObsoleteHomeRoutine)?.id;
  const octoberWalkIds = entries.filter(octoberWalkWeek).map((entry) => entry.id).join(",");
  useEffect(() => {
    if (ready && !locked && (needsHomeTraining || obsoleteHomeRoutineId))
      void run(() => addMissingHomeTraining(obsoleteHomeRoutineId));
  }, [ready, locked, needsHomeTraining, obsoleteHomeRoutineId]);
  useEffect(() => {
    if (ready && !locked && octoberWalkIds) void run(() => alignOctoberWalkWeeks(octoberWalkIds.split(",")));
  }, [ready, locked, octoberWalkIds]);
  useEffect(() => {
    if (ready && !locked && profile?.role === "owner") void run(removeEmptyNovemberPulldown);
  }, [ready, locked, profile?.role]);
  const hasPushable = entries.some((e) => e.dirty && !e.conflict);
  useEffect(() => {
    if (!canSync || !online || !hasPushable) return;
    const timer = setTimeout(() => void synchronize(true), 2000);
    return () => clearTimeout(timer);
  }, [canSync, online, entries, hasPushable]);
  useEffect(() => {
    if (!cloudUrl || !pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [cloudUrl, pending]);
  useEffect(() => {
    viewRequest.current++;
    setReadOnly("");
    setViewing(null);
    setClientRecords([]);
    setClients([]);
    if (!authUser || authUser === "local" || !online) {
      setProfile(null);
      return;
    }
    let live = true;
    void myProfile().then(async (p) => {
      if (!live) return;
      setProfile(p);
      const visible = p ? await myClients(p.role) : [];
      if (live) setClients(visible);
    }).catch(() => { if (live) setClients([]); });
    return () => {
      live = false;
    };
  }, [authUser, online]);
  const viewJournal = async (client: Client | null) => {
    const request = ++viewRequest.current;
    if (!client) {
      setReadOnly("");
      setViewing(null);
      setClientRecords([]);
      return;
    }
    try {
      const records = await fetchUserRecords(client.id);
      if (request !== viewRequest.current) return;
      setReadOnly(`กำลังดูข้อมูลของ ลูกเทรน ${client.name} · ดูอย่างเดียว กลับไปที่ "ของฉัน" เพื่อบันทึก`);
      setClientRecords(records);
      setViewing(client);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    }
  };
  const tabs = [
    ["today", "Today", LayoutDashboard],
    ["machines", "Strength", Dumbbell],
    ["cardio", "Cardio", Footprints],
    ["progress", "Progress", TrendingUp],
    ["history", "History", History],
    ["settings", "Settings", Settings],
  ] as const;
  return (
    <Data.Provider
      value={{
        entries: viewing
          ? [...entries.filter(isSharedEntry), ...clientRecords]
          : entries,
        refresh,
        run,
        notify,
        readOnly: !!viewing,
      }}
    >
      <div className={`app${viewing ? " viewing" : ""}`}>
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
            {clients.length > 0 && (
              <select
                className="view-switch"
                aria-label="กำลังดูข้อมูลของ"
                value={viewing?.id ?? ""}
                onChange={(e) =>
                  void viewJournal(clients.find((c) => c.id === e.target.value) ?? null)
                }
              >
                <option value="">กำลังดู: ของฉัน</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    กำลังดู: ลูกเทรน {c.name}
                  </option>
                ))}
              </select>
            )}
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
            {viewing && (
              <div className="notice view-banner">
                <strong>กำลังดูข้อมูลของ ลูกเทรน {viewing.name} · ดูอย่างเดียว</strong>
                <button className="secondary" onClick={() => void viewJournal(null)}>
                  กลับไปข้อมูลของฉัน
                </button>
              </div>
            )}
            {locked ? (
              <Empty
                text={
                  authUser === null
                    ? "กำลังตรวจบัญชี…"
                    : authUser
                      ? "ข้อมูลในเครื่องนี้ผูกกับบัญชีอื่น ใช้เบราว์เซอร์แยกสำหรับแต่ละบัญชี"
                      : "เข้าสู่ระบบเพื่อเปิดสมุดฝึก"
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
            ) : !ready ? (
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
                profile={profile}
                viewJournal={(client) => void viewJournal(client)}
                clients={clients}
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
                <span className="short">{label}</span>
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
function sessionGyms(entries: Entry[], session: Session): string[] {
  if (session.gym) return [session.gym];
  return [...new Set(session.exercises.flatMap((exercise) => {
    const gym = entries.find((e) => e.kind === "machine" && e.id === exercise.machineId)?.data.gym;
    return typeof gym === "string" && gym ? [gym] : [];
  }))];
}

const cardioSummary = (cardio: Cardio) =>
  [minuteDuration(cardio.seconds), cardio.distance != null && `${cardio.distance} กม.`]
    .filter(Boolean).join(" · ");

function Today({ nav }: { nav: (p: string) => void }) {
  const { entries, run, refresh, readOnly } = useData(),
    [start, setStart] = useState(false),
    [discardDraft, setDiscardDraft] = useState<string | null>(null),
    [cardioId, setCardioId] = useState<string | null>(null),
    [session, setSession] = useRememberedView("today-session"),
    [machineDetail, setMachineDetail] = useRememberedView("today-machine");
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
        e.data.status === "completed" &&
        ((e.data.exercises as ExerciseLog[]).length === 0 ||
          (e.data.exercises as ExerciseLog[]).some((exercise) => !isStretch(exercise.machineId))),
    ),
    draft = active
      .filter((e) => e.kind === "session" && e.data.status === "draft")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0],
    routines = active.filter((e) => e.kind === "routine" && !isObsoleteHomeRoutine(e)),
    machines = active.filter((e) => e.kind === "machine" && !e.data.archived && e.data.gym !== homeGym),
    last = active
      .filter(
        (e) => e.data.date && (e.kind === "cardio" || (e.kind === "session" && e.data.status !== "draft")),
      )
      .sort((a, b) => b.data.date.localeCompare(a.data.date) || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 4);
  const [routine, setRoutine] = useState<{ data: {
    title: string; machineIds: string[]; note?: string; targets?: Record<string, ExerciseTarget>;
  } } | null>(null);
  const startRoutine = (r: NonNullable<typeof routine>) => {
    setRoutine(r);
    setStart(true);
  };
  const lastWorkout = active.filter((e) => e.kind === "session" && e.data.status === "completed")
    .sort((a, b) => b.data.date.localeCompare(a.data.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
  const repeatMachines = ((lastWorkout?.data.exercises ?? []) as ExerciseLog[])
    .map(({ machineId }) => active.find((entry) => entry.id === machineId && entry.kind === "machine" && !entry.data.archived))
    .filter((entry): entry is Entry => Boolean(entry));
  const repeatGym = repeatMachines[0]?.data.gym;
  const repeatable = repeatMachines.length > 0 && repeatMachines.every((entry) => entry.data.gym === repeatGym) &&
    !gymsFor(entries).some((gym) => gym.id === repeatGym && gym.archived);
  return (
    <>
      <Header title="Today" subtitle={longDate(now)} />
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
                {readOnly ? "ดูรายการ" : "ทำต่อจากที่ค้างไว้"} <ChevronRight size={17} />
              </button>
              <button className="text-button edit-only" onClick={() => setDiscardDraft(draft.id)}>
                ทิ้งร่างการฝึก
              </button>
            </>
          ) : (
            <>
              <p className="muted">{readOnly ? "ไม่มีการฝึกที่ค้างอยู่" : "เลือกโปรแกรมเพื่อเริ่มบันทึก หรือเลือกเครื่องเอง"}</p>
              <div className="routine-buttons">
                {lastWorkout && repeatable && (
                  <button className="routine-button" onClick={() => startRoutine({
                    data: { title: lastWorkout.data.title, machineIds: repeatMachines.map(({ id }) => id) },
                  })}>
                    <span><strong>ทำซ้ำครั้งฝึกล่าสุด</strong>
                      <small>{dateLabel(lastWorkout.data.date)} · {gymName(entries, repeatGym)} · {repeatMachines.length} ท่า</small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                )}
                {routines.map((r) => (
                  <button
                    key={r.id}
                    className="routine-button"
                    onClick={() => startRoutine(r)}
                  >
                    <span>
                      <strong>{r.data.title}</strong>
                      <small>
                        {r.data.machineIds.length} ท่า
                        {r.data.assignedBy ? ` · จากเทรนเนอร์ ${r.data.assignedBy}` : ""}
                      </small>
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
              {readOnly ? "ดูคาร์ดิโอ" : "บันทึกคาร์ดิโอ"} <ArrowUpRight size={17} />
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
        <h2>Strength</h2>
        <button className="text-button" onClick={() => nav("machines")}>
          ทั้งหมด <ChevronRight size={17} />
        </button>
      </div>
      <div className="machine-grid compact">
        {exerciseCards(entries, machines)
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
          text="ยังไม่มีท่า เพิ่มท่าแรกได้ที่หน้า Strength"
          action={
            <button className="secondary" onClick={() => nav("machines")}>
              เปิด Strength
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
          onClick={() => e.kind === "cardio" ? setCardioId(e.id) : setSession(e.id)}
        >
          <span className="icon-disc">
            {e.kind === "cardio" ? activityEmoji(e.data.activity) : <Dumbbell size={20} />}
          </span>
          <div>
            <strong>{e.kind === "cardio" ? e.data.activity : e.data.title}</strong>
            <small>
              {dateLabel(e.data.date)} ·{" "}
              {e.kind === "cardio"
                ? [cardioSummary(e.data), e.data.status === "review" && "รอตรวจ"].filter(Boolean).join(" · ")
                : [e.data.exercises.length ? `${e.data.exercises.length} ท่า` : "บันทึกจากสมุดเดิม",
                    ...sessionGyms(entries, e.data).map((id) => gymName(entries, id))].join(" · ")}
            </small>
          </div>
          <ChevronRight size={18} />
        </button>
      ))}
      {cardioId && entries.some((e) => e.id === cardioId && !e.deleted) && (
        <CardioForm entry={entries.find((e) => e.id === cardioId)} close={() => setCardioId(null)} />
      )}
      {start && (
        <StartSession
          initial={routine?.data.machineIds}
          initialTitle={routine?.data.title}
          initialNote={routine?.data.note}
          initialTargets={routine?.data.targets}
          close={() => { setStart(false); setRoutine(null); }}
          done={(id) => {
            setStart(false);
            setRoutine(null);
            setSession(id);
          }}
        />
      )}
      {session && active.some((e) => e.id === session && e.kind === "session") &&
        <SessionEditor id={session} close={() => setSession(null)} />}
      {discardDraft && (
        <Modal title="ทิ้งร่างการฝึก" close={() => setDiscardDraft(null)}>
          <div className="form">
            <p>ย้ายร่างนี้เข้าถังขยะ กู้คืนได้ในหน้าตั้งค่า</p>
            <button className="danger" onClick={() => {
              void run(async () => {
                const current = (await allEntries()).find((e) => e.id === discardDraft);
                if (!current || current.deleted || current.data.status !== "draft")
                  throw Error("ร่างนี้เปลี่ยนแล้ว กรุณาเปิดรายการล่าสุด");
                await trash(discardDraft);
                writeView(`focus:${discardDraft}`, null);
                setDiscardDraft(null);
              }, "ย้ายร่างเข้าถังขยะแล้ว");
            }}>ยืนยันย้ายร่างเข้าถังขยะ</button>
          </div>
        </Modal>
      )}
      {machineDetail && active.some((e) => e.id === machineDetail && e.kind === "machine") && (
        <MachineDetail
          key={machineDetail}
          selectMachine={setMachineDetail}
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
function MissingGymMachines({
  gym, entries, choose, query = "",
}: {
  gym: string;
  entries: Entry[];
  choose: (machine: Entry) => void;
  query?: string;
}) {
  const { run } = useData();
  const creating = useRef(false);
  const available = entries.filter((entry) => entry.kind === "machine" && !entry.deleted && !entry.data.archived);
  const local = new Set(available.filter((entry) => entry.data.gym === gym).map((entry) => exerciseKey(entry.data)));
  const missing = exerciseCards(entries, available.filter((entry) =>
    !local.has(exerciseKey(entry.data)) &&
    [entry.data.name, entry.data.thai, ...(entry.data.aliases ?? [])].join(" ").toLowerCase().includes(query.toLowerCase()),
  ));
  const create = (source: Entry, file?: File) => {
    if (creating.current) return;
    creating.current = true;
    void run(async () => {
      try {
        const m = source.data as Machine;
        const existing = (await allEntries()).find((entry) =>
          entry.kind === "machine" && !entry.deleted && !entry.data.archived &&
          entry.data.gym === gym && exerciseKey(entry.data) === exerciseKey(m),
        );
        if (existing) {
          choose(existing);
          return;
        }
        const id = uid();
        const photoId = file ? await addPhoto(file, `${gym} · ${m.name}`) : undefined;
        if (photoId) await save("photo", { label: m.name, mime: "image/jpeg", machineId: id }, photoId);
        const machine: Machine = {
          exerciseId: m.exerciseId,
          name: m.name,
          thai: m.thai,
          aliases: m.aliases,
          group: m.group,
          gym,
          setup: "",
          cues: "",
          loadMode: "total",
          photoId,
        };
        choose(await save("machine", machine, id));
      } finally {
        creating.current = false;
      }
    });
  };
  return missing.length > 0 && (
    <details open={query ? true : undefined}>
      <summary>ท่าที่ยังไม่มีเครื่องที่ {gymName(entries, gym)}</summary>
      {missing.map((entry) => (
        <div className="notice" key={entry.id}>
          <p>ยังไม่มีเครื่อง {entry.data.name} ที่ {gymName(entries, gym)}</p>
          <div className="upload-row">
            <label className="secondary">
              ถ่ายรูปเพิ่มเครื่อง
              <input hidden type="file" accept="image/*" capture="environment" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) create(entry, file);
              }} />
            </label>
            <button type="button" className="text-button" onClick={() => create(entry)}>
              บันทึกไปก่อน เพิ่มรูปทีหลัง
            </button>
          </div>
        </div>
      ))}
    </details>
  );
}

function MachinePicker({
  excluded,
  gym,
  choose,
  close,
}: {
  excluded: string[];
  gym?: string;
  choose: (m: Entry) => void;
  close: () => void;
}) {
  const { entries } = useData(),
    [query, setQuery] = useState(""),
    [create, setCreate] = useState(false);
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
              (!gym || e.data.gym === gym) &&
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
                  {[gymName(entries, e.data.gym), e.data.label, e.data.thai].filter(Boolean).join(" · ")}
                </small>
              </span>
              <Plus size={17} />
            </button>
          ))}
        {gym && <MissingGymMachines gym={gym} entries={entries} choose={choose} query={query} />}
        {query.trim() && gym && <button className="secondary" onClick={() => setCreate(true)}>+ สร้างท่าใหม่ «{query.trim()}»</button>}
      </div>
      {create && <MachineForm initialName={query.trim()} fixedGym={gym} close={() => setCreate(false)} onSaved={(_, saved) => choose(saved)} />}
    </Modal>
  );
}
function RoutineSettings() {
  const { entries, run } = useData(),
    [edit, setEdit] = useState<Entry | null | undefined>(undefined),
    [selected, setSelected] = useState<string[]>([]);
  const routines = entries.filter((e) => e.kind === "routine" && !e.deleted && !isObsoleteHomeRoutine(e)),
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
                    ...(edit?.data.targets && {
                      targets: Object.fromEntries(Object.entries(edit.data.targets).filter(([id]) => selected.includes(id))),
                    }),
                    ...(currentProfile()?.role === "trainer"
                      ? { assignedBy: currentProfile()!.displayName }
                      : edit?.data.assignedBy
                        ? { assignedBy: edit.data.assignedBy }
                        : {}),
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
                  <small>{gymName(entries, m.data.gym)}</small>
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
function exerciseCards(entries: Entry[], machines: Entry[]) {
  const byExercise = new Map<string, { machine: Entry; date: string }>();
  for (const machine of machines) {
    const key = exerciseKey(machine.data);
    const last = latestExercise(entries, machine.id, today())?.entry;
    const date = last ? `${last.data.date}/${last.updatedAt}` : "";
    const current = byExercise.get(key);
    if (!current || date > current.date) byExercise.set(key, { machine, date });
  }
  return [...byExercise.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || a.machine.data.name.localeCompare(b.machine.data.name))
    .map(({ machine }) => machine);
}

function machineVariants(entries: Entry[], machine: Machine) {
  return entries.filter((e) =>
    e.kind === "machine" && !e.deleted && !e.data.archived &&
    exerciseKey(e.data) === exerciseKey(machine),
  );
}

function MachineCover({ entry, entries }: { entry: Entry; entries: Entry[] }) {
  const m = entry.data as Machine;
  const coverPhoto = machinePhotoIds(entries, entry.id, m).main;
  const guide = m.gym === homeGym ? exerciseGuide(m.name) : undefined;
  const frame = guide ? exerciseGuideFrames(guide)[0] : 0;
  const replaced = coverPhoto === `guide-photo-${entry.id}-0` && frame !== 0;
  return guide && (replaced || (!coverPhoto && !entries.some((item) => item.id === `guide-photo-${entry.id}-${frame}`)))
    ? <img loading="lazy" src={`${import.meta.env.BASE_URL}exercise-guides/${guide}/${frame}.jpg`} alt={`ภาพประกอบ ${m.name}`} />
    : <Photo id={coverPhoto} alt={m.name} />;
}

/** The machine's own photo, or both frames of the bundled guide for a home exercise. */
function MachinePhoto({ id }: { id: string }) {
  const { entries } = useData();
  const entry = entries.find((e) => e.id === id && e.kind === "machine");
  if (!entry) return <Photo alt="เครื่อง" />;
  const { main } = machinePhotoIds(entries, id, entry.data);
  const guide = entry.data.gym === homeGym && (!main || main.startsWith("guide-photo-")) ? exerciseGuide(entry.data.name) : undefined;
  return guide ? <>{exerciseGuideFrames(guide).map((frame) => (
    <img key={frame} src={`${import.meta.env.BASE_URL}exercise-guides/${guide}/${frame}.jpg`} alt={`${entry.data.name} ภาพ ${frame + 1}`} />
  ))}</> : <Photo id={main} alt={entry.data.name} />;
}

function MachineTile({ e, onClick }: { e: Entry; onClick: () => void }) {
  const { entries } = useData(),
    m = e.data as Machine,
    last = latestExercise(entries, e.id, today());
  const thai = m.thai?.trim() || ({
    "seated cable row": "เคเบิลโรว์นั่ง (ดึงหลัง)",
    "incline press": "ดันอกแนวเฉียงขึ้น",
  } as Record<string, string>)[m.name.trim().toLowerCase()];
  return (
    <StrengthTile name={m.name} thai={thai} group={m.group} location={gymName(entries, m.gym)} onClick={onClick}
      photo={<MachineCover entry={e} entries={entries} />}>
        <p className="muted">
          มีเครื่องที่: {[...new Set(machineVariants(entries, m).map((x) => gymName(entries, x.data.gym)))].join(" · ")}
        </p>
        <div className="last-load">
          {last ? (
            <>
              <span>ครั้งล่าสุด · {gymName(entries, m.gym)}</span>
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
    </StrengthTile>
  );
}
function Machines() {
  const { entries, run } = useData(),
    [query, setQuery] = useState(""),
    [gym, setGym] = useState(""),
    [savedGroup, setGroup] = useRememberedView("strength-category", "ทั้งหมด"),
    [selected, setSelected] = useRememberedView("machine-detail"),
    [create, setCreate] = useState(false),
    [showArchived, setShowArchived] = useState(false);
  const group = savedGroup ?? "ทั้งหมด";
  const machines = entries.filter(
    (e) =>
      e.kind === "machine" &&
      !e.deleted &&
      (!e.data.archived || showArchived) &&
      (!gym || e.data.gym === gym) &&
      (group === "ทั้งหมด" || e.data.group === group) &&
      [e.data.name, e.data.thai, ...(e.data.aliases ?? [])].join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <Header title="Strength">
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
          <option value="">ทุกสถานที่</option>
          {gymsFor(entries).map((item) => <option key={item.id} value={item.id}>{item.name}{item.id === "Jett" ? " · สถิติเก่า" : ""}</option>)}
        </select>
      </div>
      <div className="chips">
        {["ทั้งหมด", "อก", "หลัง", "ขา", "แกนกลาง", "ไหล่", "แขน", "อื่น ๆ", "Stretch"].map(
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
      {group !== "Stretch" && (
      <label className="check-label archive-toggle">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        แสดงเครื่องที่เก็บเข้าคลัง
      </label>
      )}
      <div className="machine-grid">
        {exerciseCards(entries, machines).map((e) => (
          <MachineTile key={e.id} e={e} onClick={() => setSelected(e.id)} />
        ))}
      </div>
      {!machines.length && <Empty text="ยังไม่มีเครื่องหรือท่าในหมวดนี้" />}
      {selected && entries.some((e) => e.id === selected && e.kind === "machine" && !e.deleted) && (
        <MachineDetail key={selected} id={selected} close={() => setSelected(null)} selectMachine={setSelected} />
      )}{" "}
      {create && <MachineForm close={() => setCreate(false)} />}
    </>
  );
}
function MachineDetail({ id, close, selectMachine }: {
  id: string;
  close: () => void;
  selectMachine: (id: string) => void;
}) {
  const { entries, run, refresh } = useData(),
    e = entries.find((e) => e.id === id),
    [edit, setEdit] = useState(false),
    [addVariant, setAddVariant] = useState(false),
    [previewId, setPreviewId] = useState<string | null>(null),
    [photoTarget, setPhotoTarget] = useState(""),
    [confirmPhotoTrash, setConfirmPhotoTrash] = useState(false),
    [beginBusy, setBeginBusy] = useState(false),
    [showAll, setShowAll] = useState(false),
    [session, setSession] = useState<string | null>(null);
  const touchStart = useRef<number | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<{ name: string; at: string } | null>(null);
  const cloudVersion = e?.version ?? 0;
  useEffect(() => {
    let live = true;
    setEditor(null);
    if (cloudVersion) void machineEditor(id).then((found) => { if (live) setEditor(found); });
    return () => { live = false; };
  }, [id, cloudVersion]);
  const guide = e ? exerciseGuide(e.data.name) : undefined;
  const hasBundledPhotos = !guide || exerciseGuideFrames(guide).every((frame) =>
    entries.some((item) => item.id === `guide-photo-${id}-${frame}`),
  );
  useEffect(() => {
    // Viewing a client's journal is read-only, so never add the bundled photos from there.
    if (e && guide && !hasBundledPhotos && !isReadOnly())
      void run(() => addBundledMachinePhotos(id, e.data.name, guide));
  }, [id, guide, hasBundledPhotos]);
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
          sessionGyms(entries, x.data).every((gym) => gym === m.gym) &&
          x.data.date === today(),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const { photos, main: mainPhoto } = machinePhotoIds(entries, id, m);
  const shown = photos.find((p) => p.id === previewId)?.id ?? mainPhoto;
  const photoIndex = photos.findIndex((p) => p.id === shown);
  const photoTargets = entries.filter((item) => item.kind === "machine" && !item.deleted && !item.data.archived && item.id !== id);
  async function setMainPhoto(photoId: string) {
    const old = entries.find(
      (p) =>
        p.kind === "photo" &&
        !p.deleted &&
        p.id === mainPhoto,
    );
    if (old && !old.data.machineId)
      await save("photo", { ...old.data, machineId: id }, old.id);
    await save("machine", { ...m, photoId }, id);
  }
  async function upload(file?: File) {
    if (!file) return;
    await run(async () => {
      const p = await addPhoto(file, `${m.gym} ${m.name}`);
      await save(
        "photo",
        { label: m.name, machineId: id, mime: "image/jpeg" },
        p,
      );
      await setMainPhoto(p);
      setPreviewId(null);
    }, "เพิ่มรูปและตั้งเป็นรูปหลักแล้ว");
  }
  usePastedImage(body, upload);
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
              { ...d, gym: m.gym, exercises: [...d.exercises, exerciseFor(e, entries, d.date, draft.id)] },
              draft.id,
            );
          await refresh();
          setSession(draft.id);
        } else {
          const entry = await save(
            "session",
            newSession(isStretch(id) ? m.name : "ฝึกเวท", [id], entries, today(), m.gym),
          );
          await refresh();
          setSession(entry.id);
        }
      } finally {
        setBeginBusy(false);
      }
    });
  return (
    <Modal title={m.name} close={close}>
      <div className="chips" aria-label="เลือกเครื่อง">
        {machineVariants(entries, m).map((variant) => (
          <button key={variant.id} className={variant.id === id ? "selected" : ""}
            aria-pressed={variant.id === id} onClick={() => selectMachine(variant.id)}>
            {gymName(entries, variant.data.gym)}{variant.data.label ? ` · ${variant.data.label}` : ""}
          </button>
        ))}
        <button className="edit-only" onClick={() => setAddVariant(true)}>เพิ่มเครื่องของท่านี้</button>
      </div>
      <div className="detail-photo"
        onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          const end = event.changedTouches[0]?.clientX;
          if (start === null || end === undefined || Math.abs(end - start) < 40) return;
          const next = photos[photoIndex + (end < start ? 1 : -1)];
          if (next) setPreviewId(next.id);
        }}>
        {!shown && guide && !hasBundledPhotos ? (
          <img src={`${import.meta.env.BASE_URL}exercise-guides/${guide}/${exerciseGuideFrames(guide)[0]}.jpg`} alt={m.name} />
        ) : <Photo id={shown} alt={m.name} />}
      </div>
      {photos.length > 1 && (
        <div className="upload-row">
          <button disabled={photoIndex <= 0} onClick={() => setPreviewId(photos[photoIndex - 1].id)}>รูปก่อนหน้า</button>
          <span>{photoIndex + 1} / {photos.length}</span>
          <button disabled={photoIndex >= photos.length - 1} onClick={() => setPreviewId(photos[photoIndex + 1].id)}>รูปถัดไป</button>
        </div>
      )}
      <div className="detail-body" ref={body}>
        <div className="focus-title">
          <small>
            {gymName(entries, m.gym)} · {m.group} · {loadLabel(m.loadMode)}
          </small>
          <h3>{m.name}</h3>
          {m.thai && <p className="muted">{m.thai}</p>}
          {editor && <small className="muted">แก้ล่าสุดโดย {editor.name} · {dateLabel(today(new Date(editor.at)))}</small>}
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
          {exerciseDemoLink(m.name) && (
            <a className="text-button" href={exerciseDemoLink(m.name)} target="_blank" rel="noreferrer">ดูตัวอย่างท่า</a>
          )}
        </div>
        <div>
          <h4>รูปเครื่อง</h4>
          <p className="muted edit-only">วางรูปที่คัดลอกไว้เพื่อเพิ่มรูปได้</p>
          <div className="photo-strip">
            {photos.map((p) => (
              <button
                key={p.id}
                className={p.id === mainPhoto ? "main" : ""}
                aria-label={p.id === mainPhoto ? "รูปหลัก" : "เปิดรูปเครื่อง"}
                aria-pressed={p.id === shown}
                onClick={() => setPreviewId(p.id)}
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
          {shown && photoIndex >= 0 && (
            <div className="upload-row edit-only">
              {shown !== mainPhoto && <button className="secondary" onClick={() =>
                run(() => setMainPhoto(shown), "ตั้งรูปหลักแล้ว")}>ใช้รูปที่เปิดเป็นรูปหลัก</button>}
              <button className="text-button" onClick={() => setConfirmPhotoTrash(true)}>ลบรูปที่เปิด</button>
              {photos[photoIndex].data.machineId === id && !shown.startsWith("photo-") && (
                <>
                  <select aria-label="เครื่องปลายทางของรูป" value={photoTarget} onChange={(event) => setPhotoTarget(event.target.value)}>
                    <option value="">เลือกเครื่องที่จะย้ายรูปไป</option>
                    {photoTargets.map((item) => <option key={item.id} value={item.id}>{gymName(entries, item.data.gym)} · {item.data.name}{item.data.label ? ` · ${item.data.label}` : ""}</option>)}
                  </select>
                  <button className="secondary" disabled={!photoTarget} onClick={() => run(async () => {
                    await moveMachinePhoto(shown, id, photoTarget);
                    setPreviewId(null);
                    setPhotoTarget("");
                  }, "ย้ายรูปเครื่องแล้ว")}>ย้ายรูปที่เปิด</button>
                </>
              )}
            </div>
          )}
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
          <ExerciseChart entries={entries} machines={entries.filter((item) =>
            item.kind === "machine" && !item.deleted && exerciseKey(item.data) === exerciseKey(m)
          )} />
        <div className="upload-row edit-only">
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
            disabled={beginBusy || !!m.archived || gymsFor(entries).some((gym) => gym.id === m.gym && gym.archived)}
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
      {confirmPhotoTrash && shown && (
        <Modal title="ลบรูปเครื่อง" close={() => setConfirmPhotoTrash(false)}>
          <div className="form">
            <p>รูปจะถูกย้ายเข้าถังขยะและกู้คืนได้ในหน้าตั้งค่า</p>
            <button className="danger" onClick={() => run(async () => {
              await trash(shown);
              setConfirmPhotoTrash(false);
              setPreviewId(null);
            }, "ย้ายรูปเข้าถังขยะแล้ว")}>ยืนยันลบรูป</button>
          </div>
        </Modal>
      )}
      {addVariant && (
        <MachineForm
          variantOf={e}
          close={() => setAddVariant(false)}
          onSaved={(id) => selectMachine(id)}
        />
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
function normalizedExerciseName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}

function similarExerciseName(a: string, b: string) {
  const x = normalizedExerciseName(a);
  const y = normalizedExerciseName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) < 4) return false;
  if (x.includes(y) || y.includes(x)) return true;
  if (Math.abs(x.length - y.length) > 1) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const mismatch = [...short].findIndex((char, i) => char !== long[i]);
  return mismatch < 0 ||
    short.slice(mismatch + (short.length === long.length ? 1 : 0)) === long.slice(mismatch + 1);
}

function MachineForm({
  entry,
  variantOf,
  close,
  onDeleted,
  onSaved,
  initialName,
  fixedGym,
}: {
  entry?: Entry;
  variantOf?: Entry;
  close: () => void;
  onDeleted?: () => void;
  onSaved?: (id: string, entry: Entry) => void;
  initialName?: string;
  fixedGym?: string;
}) {
  const { run, entries } = useData(),
    m = entry?.data as Machine | undefined;
  const gyms = gymsFor(entries).filter((gym) => !gym.archived || gym.id === m?.gym);
  const [name, setName] = useState(m?.name ?? variantOf?.data.name ?? initialName ?? "");
  const [match, setMatch] = useState<Entry | null>(variantOf ?? null);
  const [distinct, setDistinct] = useState(false);
  const suggestions = entry ? [] : exerciseCards(entries, entries.filter((e) =>
    e.kind === "machine" && !e.deleted &&
    [e.data.name, e.data.thai, ...(e.data.aliases ?? [])].some((alias) => alias && similarExerciseName(name, alias)),
  )).slice(0, 5);
  return (
    <Modal title={entry ? "แก้ไขเครื่อง" : "เพิ่มเครื่องหรือท่า"} close={close}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (suggestions.length && !match && !distinct) return;
          const matched = match?.data as Machine | undefined;
          void run(async () => {
            const saved = await save(
              "machine",
              {
                ...m,
                name: matched?.name ?? name.trim(),
                thai: matched?.thai ?? f.get("thai"),
                exerciseId: matched ? exerciseKey(matched) : m ? exerciseKey(m) : distinct ? uid() : undefined,
                aliases: matched?.aliases ?? m?.aliases,
                label: String(f.get("label")).trim(),
                gym: fixedGym ?? f.get("gym"),
                group: matched?.group ?? f.get("group"),
                setup: f.get("setup"),
                cues: f.get("cues"),
                loadMode: f.get("loadMode"),
              },
              entry?.id,
            );
            close();
            onSaved?.(saved.id, saved);
          }, "บันทึกเครื่องแล้ว");
        }}
      >
        <div className="form-grid">
          <Field label="ชื่อท่า / เครื่อง">
            <input required name="name" value={name} readOnly={!!variantOf} onChange={(e) => {
              setName(e.target.value);
              setMatch(null);
              setDistinct(false);
            }} autoComplete="off" />
          </Field>
          <Field label="ชื่อที่เรียกภาษาไทย">
            <input name="thai" defaultValue={m?.thai} />
          </Field>
          <Field label="ฟิตเนส">
            <select name="gym" required disabled={!!fixedGym} defaultValue={fixedGym ?? m?.gym ?? gyms[0]?.id}>
              {!gyms.length && <option value="">เพิ่มยิมในหน้าตั้งค่าก่อน</option>}
              {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
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
        {suggestions.length > 0 && (
          <div className="notice">
            <p>ใช่ท่านี้ไหม</p>
            <div className="chips">
              {suggestions.map((suggestion) => (
                <button key={suggestion.id} type="button" aria-pressed={match?.id === suggestion.id}
                  onClick={() => { setMatch(suggestion); setDistinct(false); }}>
                  ใช้ท่า {suggestion.data.name}
                </button>
              ))}
              <button type="button" aria-pressed={distinct} onClick={() => { setMatch(null); setDistinct(true); }}>
                สร้างเป็นท่าใหม่
              </button>
            </div>
          </div>
        )}
        <Field label="ป้ายแยกเครื่อง (ถ้ามี)">
          <input name="label" defaultValue={m?.label} placeholder="เช่น เครื่องสีส้ม" />
        </Field>
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
          <button className="primary" disabled={!!suggestions.length && !match && !distinct}>บันทึกเครื่อง</button>
        </div>
      </form>
    </Modal>
  );
}
function StartSession({
  close,
  done,
  initial = [],
  initialTitle,
  initialNote,
  initialTargets,
}: {
  close: () => void;
  done: (id: string) => void;
  initial?: string[];
  initialTitle?: string;
  initialNote?: string;
  initialTargets?: Record<string, ExerciseTarget>;
}) {
  const { entries, run, refresh } = useData(),
    [selection, setSelection] = useState(initial),
    [title, setTitle] = useState(initialTitle ?? (initial.length ? "ฝึกเวท" : "Upper Body")),
    [routineNote, setRoutineNote] = useState(initialNote ?? ""),
    [targets, setTargets] = useState(initialTargets ?? {}),
    [query, setQuery] = useState(""),
    [create, setCreate] = useState(false),
    [date, setDate] = useState(today());
  const allMachines = entries.filter(
      (e) => e.kind === "machine" && !e.deleted && !e.data.archived,
    );
  const gyms = gymsFor(entries).filter((gym) => !gym.archived);
  const [gym, setGym] = useState(() => {
    const recent = entries.filter((e) => e.kind === "session" && !e.deleted && e.data.status !== "draft")
      .sort((a, b) => b.data.date.localeCompare(a.data.date) || b.updatedAt.localeCompare(a.updatedAt));
    return [...allMachines.filter((e) => initial.includes(e.id)).map((e) => e.data.gym),
      ...recent.flatMap((e) => sessionGyms(entries, e.data))]
      .find((id) => gyms.some((gym) => gym.id === id)) ?? gyms[0]?.id ?? "";
  });
  const machines = allMachines.filter((e) => e.data.gym === gym);
  const selectedMachines = selection.filter((id) => machines.some((m) => m.id === id));
  const routines = entries.filter((e) => e.kind === "routine" && !e.deleted && !isObsoleteHomeRoutine(e));
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
          <Field label="ยิมที่ฝึก">
            <select value={gym} onChange={(e) => {
              setGym(e.target.value);
              setSelection([]);
            }}>
              {!gyms.length && <option value="">เพิ่มยิมในหน้าตั้งค่าก่อน</option>}
              {gyms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="chips">
          {["Upper Body", "Lower Body", "Full Body"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTitle(t);
                setRoutineNote("");
                setTargets({});
                setSelection(
                  machines
                    .filter(
                      (e) =>
                        !isStretch(e.id) && (t === "Full Body" ||
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
                setRoutineNote(r.data.note ?? "");
                setTargets(r.data.targets ?? {});
                const routineMachines = allMachines.filter((machine) =>
                  r.data.machineIds.includes(machine.id) && gyms.some((item) => item.id === machine.data.gym));
                const routineGym = routineMachines.find((machine) => machine.data.gym === gym)?.data.gym ??
                  routineMachines[0]?.data.gym;
                if (routineGym) setGym(routineGym);
                setSelection(r.data.machineIds.filter((id: string) =>
                  routineMachines.some((machine) => machine.id === id && machine.data.gym === routineGym)));
              }}
            >
              {r.data.title}
            </button>
          ))}
        </div>
        {routineNote && <p className="notice preserve">{routineNote}</p>}
        <p>เลือกท่าตามลำดับที่จะเล่น</p>
        <input aria-label="ค้นหาท่าที่จะเลือก" placeholder="ค้นหาท่า" value={query} onChange={(e) => setQuery(e.target.value)} />
        {machines.filter((e) => selection.includes(e.id) ||
          `${e.data.name} ${e.data.thai}`.toLowerCase().includes(query.trim().toLowerCase())).map((e) => (
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
                {[gymName(entries, e.data.gym), e.data.label, e.data.thai,
                  targets[e.id] && targetText(targets[e.id])].filter(Boolean).join(" · ")}
              </small>
            </span>
            {selection.includes(e.id) && <b>{selection.indexOf(e.id) + 1}</b>}
          </label>
        ))}
        <MissingGymMachines key={gym} gym={gym} entries={entries} choose={(picked) =>
          setSelection((current) => current.includes(picked.id) ? current : [...current, picked.id])
        } />
        {gym && query.trim() && <button className="secondary" onClick={() => setCreate(true)}>+ สร้างท่าใหม่ «{query.trim()}»</button>}
        <button
          className="primary wide"
          disabled={!selectedMachines.length || !date || !title}
          onClick={() =>
            run(async () => {
              const e = await save(
                "session",
                newSession(title, selectedMachines, entries, date, gym, targets),
              );
              await refresh();
              done(e.id);
            })
          }
        >
          เริ่มบันทึก {selectedMachines.length} ท่า <ArrowUpRight size={18} />
        </button>
      </div>
      {create && <MachineForm initialName={query.trim()} fixedGym={gym} close={() => setCreate(false)}
        onSaved={(id) => setSelection((previous) => [...previous, id])} />}
    </Modal>
  );
}
const defaultShortcut = "LillyRest";

function launchRestShortcut(name: string, seconds: number) {
  const params = new URLSearchParams({ name, input: "text", text: String(seconds) });
  location.href = `shortcuts://run-shortcut?${params}`;
}

function RestShortcutSettings() {
  const [enabled, setEnabled] = useState(() => readRestPreference("rest-shortcuts-enabled") === "true");
  const [name, setName] = useState(() => readRestPreference("rest-shortcut-name") ?? defaultShortcut);
  return (
    <section className="panel">
      <h2>ตัวจับเวลาพักบน iPhone</h2>
      <label className="check-label">
        <input type="checkbox" checked={enabled} onChange={(e) => {
          setEnabled(e.target.checked);
          writeRestPreference("rest-shortcuts-enabled", String(e.target.checked));
        }} />
        ใช้ตัวจับเวลา iPhone (Shortcuts)
      </label>
      <Field label="ชื่อคำสั่งลัด">
        <input value={name} maxLength={80} onChange={(e) => {
          setName(e.target.value);
          writeRestPreference("rest-shortcut-name", e.target.value.trim() || defaultShortcut);
        }} />
      </Field>
      <ol>
        <li>ในแอปคำสั่งลัด สร้างคำสั่งลัดชื่อ {name.trim() || defaultShortcut}</li>
        <li>เพิ่มการทำงาน “เริ่มตัวจับเวลา” และใช้ “อินพุตคำสั่งลัด” เป็นระยะเวลา หน่วยวินาที</li>
        <li>กดทดสอบบน iPhone แล้วกลับมาที่ Lilly Training</li>
      </ol>
      <button type="button" className="secondary" onClick={() => launchRestShortcut(name.trim() || defaultShortcut, 5)}>
        ทดสอบ 5 วินาที
      </button>
    </section>
  );
}

function readRestPreference(name: string) {
  try { return localStorage.getItem(viewStorageKey(name)); } catch { return null; }
}

function writeRestPreference(name: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(viewStorageKey(name));
    else localStorage.setItem(viewStorageKey(name), value);
  } catch { /* The in-page timer still works. */ }
}

function RestTimer({ sessionId }: { sessionId: string }) {
  const key = `rest:${sessionId}`;
  const [end, setEnd] = useState(() => Number(readRestPreference(key)) || null);
  const [now, setNow] = useState(Date.now);
  const seconds = end === null ? 0 : Math.ceil((end - now) / 1000);
  const expired = end !== null && end <= now;
  function updateEnd(value: number | null) {
    writeRestPreference(key, value === null ? null : String(value));
    setNow(Date.now());
    setEnd(value);
  }
  useEffect(() => {
    if (!end) return;
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pageshow", tick);
    };
  }, [end]);
  return (
    <div className="rest-timer" data-state={!end ? "idle" : expired ? "expired" : seconds <= 10 ? "soon" : "running"}>
      <Timer size={17} />
      <span className="sr-only" role="status">{expired ? "หมดเวลาพัก เริ่มเซ็ตถัดไปได้" : ""}</span>
      <span>
        {expired
          ? `หมดเวลาพัก — เริ่มเซ็ตถัดไป +${Math.floor(Math.abs(seconds) / 60)}:${(Math.abs(seconds) % 60).toString().padStart(2, "0")}`
          : end
          ? `พัก ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`
          : "จับเวลาพัก"}
      </span>
      {[60, 90, 120].map((n) => (
        <button
          key={n}
          onClick={() => {
            updateEnd(Date.now() + n * 1000);
            if (readRestPreference("rest-shortcuts-enabled") === "true")
              launchRestShortcut(readRestPreference("rest-shortcut-name") || defaultShortcut, n);
          }}
        >
          {n}วิ
        </button>
      ))}
      {end && (
        <button onClick={() => updateEnd(null)} aria-label="ปิดตัวจับเวลา">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
function CardioPage({ openReport = false }: { openReport?: boolean }) {
  const { entries, notify, run } = useData(),
    [storedWeek, setWeek] = useRememberedView("cardio-week", weekOf(today())),
    [date, setDate] = useState(today()),
    [reportWeek, setReportWeek] = useState(weekOf(today())),
    [withWeights, setWithWeights] = useState(true),
    [editId, setEditId] = useRememberedView("cardio-edit"),
    [copy, setCopy] = useState(openReport);
  const week = storedWeek ?? weekOf(today());
  const edit = editId === "new" ? null :
    entries.find((e) => e.id === editId && e.kind === "cardio" && !e.deleted);
  const setEdit = (entry: Entry | null | undefined) =>
    setEditId(entry === undefined ? null : entry?.id ?? "new");
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
    goal = settings.cardioGoal ?? 150,
    totals = cardioTotals(entries, week);
  const logs = entries
    .filter(
      (e) =>
        e.kind === "cardio" &&
        !e.deleted &&
        e.data.week === week,
    )
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
  const message = coachMessage(
    entries,
    date,
    reportWeek,
    goal,
    false,
    withWeights,
  );
  const mix = cardioMix(logs, goal * 60);
  return (
    <>
      <Header title="Cardio" subtitle="รอบสัปดาห์อาทิตย์–เสาร์ · เวลาไทย">
        <button className="primary" onClick={() => setEdit(null)}>
          <Plus size={18} />
          บันทึกคาร์ดิโอ
        </button>
      </Header>
      <div className="toolbar">
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
            คาร์ดิโอสะสม ·{" "}
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
            <div className="ring cardio-mix-ring" style={{ background: mix.background }}>
              <div><strong>{mix.percent.toFixed(1)}<small>%</small></strong><span>ของเป้าหมาย</span></div>
            </div>
          </div>
          <dl className="cardio-mix-legend">
            {mix.groups.map(({ label, color, seconds }) => (
              <div key={label}>
                <dt><span style={{ background: color }} aria-hidden="true" />{label}</dt>
                <dd>{duration(seconds)}</dd>
              </div>
            ))}
          </dl>
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
              className={`activity-disc ${e.data.activity.includes("มวย") ? "boxing" : ""}`}
            >
              {activityEmoji(e.data.activity)}
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
        วงกลมและยอดรวมใช้เฉพาะรายการที่ยืนยันแล้วตามสัปดาห์ที่เลือกให้นับ
      </div>
      {edit !== undefined && (
        <CardioForm
          key={editId}
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
  const draft = useFormDraft("cardio", entry);
  const form = useRef<HTMLFormElement>(null);
  const [revision, setRevision] = useState(0);
  const { entries, run, notify, readOnly } = useData(),
    c = entry?.data as Cardio | undefined,
    [date, setDate] = useState(draft.initial.date ?? c?.date ?? today()),
    [weekOverride, setWeekOverride] = useState<string | null>(
      draft.initial.weekOverride === "auto" ? null :
        draft.initial.weekOverride ?? (c && c.date && c.week !== weekOf(c.date) ? c.week : null),
    ),
    [confirmed, setConfirmed] = useState(draft.initial.verified === undefined ? !c || c.status === "confirmed" : draft.initial.verified === "true"),
    [time, setTime] = useState(draft.initial.time ?? (c ? timeInput(c.seconds) : "")),
    [activity, setActivity] = useState(draft.initial.activity ?? c?.activity ?? "เดินลู่วิ่ง"),
    [walkGoal, setWalkGoal] = useState(draft.initial.walk === undefined ? c?.walkGoal ?? true : draft.initial.walk === "true"),
    [distance, setDistance] = useState(draft.initial.distance ?? c?.distance?.toString() ?? ""),
    [photoId, setPhotoId] = useState<string | undefined>(draft.initial.photoId ?? c?.photoId),
    [ocr, setOcr] = useState<Blob | null>(null),
    [saving, setSaving] = useState(false),
    [duplicateId, setDuplicateId] = useState(""),
    [allowDuplicate, setAllowDuplicate] = useState(false);
  const edited = useRef(false);
  function persist() {
    if (!form.current || !edited.current) return;
    draft.write({
      ...draft.read(form.current), date, time, activity, distance,
      verified: String(confirmed), walk: String(walkGoal),
      weekOverride: weekOverride ?? "auto",
      ...(photoId && { photoId }),
    });
  }
  useEffect(persist, [date, time, activity, distance, confirmed, walkGoal, weekOverride, photoId]);
  const actualWeek = date ? weekOf(date) : "";
  const week = weekOverride ?? actualWeek;
  const goal = entries.find((e) => e.id === "settings-main" && !e.deleted)?.data.cardioGoal ?? 150;
  let previewSeconds: number | null = null;
  if (week && date && weekOf(week) === week) {
    try {
      const seconds = parseTime(time);
      previewSeconds = cardioTotals(entries.filter((e) => e.id !== entry?.id), week).seconds +
        (confirmed ? seconds : 0);
    } catch {
      // An incomplete duration has no preview.
    }
  }
  useEffect(() => {
    setDuplicateId("");
    setAllowDuplicate(false);
  }, [date, time, distance, activity]);
  const upload = async (f?: File) => {
    if (!f) return;
    await run(async () => {
      const id = await addPhoto(f, `หลักฐาน ${date}`);
      edited.current = true;
      setPhotoId(id);
      setOcr(f);
    });
  };
  usePastedImage(form, upload);
  return (
    <Modal title={readOnly ? "ล็อกคาร์ดิโอ" : entry ? "แก้ไขล็อกคาร์ดิโอ" : "บันทึกคาร์ดิโอ"} close={close}>
      <form
        ref={form}
        key={revision}
        className="form"
        onChange={() => { edited.current = true; persist(); }}
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
              draft.clear();
              close();
              notify("บันทึกคาร์ดิโอแล้ว ยอดและข้อความโค้ชอัปเดตแล้ว");
            } finally {
              setSaving(false);
            }
          });
        }}
      >
        <fieldset className="form-lock" disabled={readOnly}>
        {Object.keys(draft.initial).length > 0 && (
          <div className="notice">
            เปิดแบบร่างที่กรอกค้างไว้แล้ว
            <button type="button" className="text-button" onClick={() => {
              edited.current = false;
              draft.discard();
              setDate(c?.date ?? today());
              setWeekOverride(c?.date && c.week !== weekOf(c.date) ? c.week : null);
              setTime(c ? timeInput(c.seconds) : "");
              setActivity(c?.activity ?? "เดินลู่วิ่ง");
              setWalkGoal(c?.walkGoal ?? true);
              setDistance(c?.distance?.toString() ?? "");
              setConfirmed(!c || c.status === "confirmed");
              setPhotoId(c?.photoId);
              setRevision((n) => n + 1);
            }}>ทิ้งแบบร่าง</button>
          </div>
        )}
        <div className="upload-drop edit-only">
          <ImagePlus size={26} />
          <h3>เริ่มจากรูปหน้าจอเครื่องได้เลย</h3>
          <p>อ่านตัวเลขในเครื่องนี้ แล้วตรวจให้ตรงก่อนยืนยัน · วางรูปที่คัดลอกไว้ได้เลย</p>
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
              className="text-button edit-only"
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
              onChange={(e) => setDate(e.target.value)}
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
              defaultValue={draft.initial.speed ?? c?.speed ?? ""}
            />
          </Field>
          <Field label="ความชัน (%)">
            <input
              name="incline"
              type="number"
              min="0"
              step="0.1"
              defaultValue={draft.initial.incline ?? c?.incline ?? ""}
            />
          </Field>
          <Field label="พลังงานตามเครื่อง (kcal)">
            <input
              name="kcal"
              type="number"
              min="0"
              step="1"
              defaultValue={draft.initial.kcal ?? c?.kcal ?? ""}
            />
          </Field>
          <Field label="นับให้รอบเริ่มวันอาทิตย์">
            <input
              type="date"
              required
              value={week}
              onChange={(e) => setWeekOverride(e.target.value === actualWeek ? null : e.target.value)}
            />
          </Field>
        </div>
        {date && week && week !== actualWeek && (
          <div className="notice">
            ชดเชยให้รอบ {dateLabel(week)} –{" "}
            {dateLabel(addDays(week, 6))}
            <button type="button" className="text-button" onClick={() => setWeekOverride(null)}>
              ใช้รอบตามวันที่จริง
            </button>
          </div>
        )}
        {previewSeconds !== null && (
          <p className="muted" aria-live="polite">
            {readOnly ? "ยอดรอบที่นับ" : "ยอดรอบนี้หลังบันทึก"} {minuteDuration(previewSeconds)} / {goal} นาที
            {!confirmed && " · รายการรอตรวจไม่นับยอด"}
          </p>
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
            defaultValue={draft.initial.note ?? c?.note}
            placeholder="เช่น ชดเชยสัปดาห์ก่อน / ปรับความเร็วระหว่างเดิน"
          />
        </Field>
        <label className="check-label confirm">
          <input
            name="confirmed"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
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
        </fieldset>
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
function useFormDraft(kind: "body" | "cardio", entry?: Entry) {
  const { entries, run } = useData();
  const recordId = `settings-form-draft-${kind}-${entry?.id ?? "new"}`;
  const version = entry?.updatedAt ?? "";
  const cloudEnabled = Boolean(config());
  const owner = config() ? localStorage.getItem("lilly-owner") ?? "owner" : "local";
  const key = `lilly-form:${sandbox ? "sandbox" : config()?.url ?? "local"}:${owner}:${kind}:${entry?.id ?? "new"}`;
  const [initial, setInitial] = useState<Record<string, string>>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(key) ?? "null");
      const remote = cloudEnabled ? entries.find((e) => e.id === recordId) : undefined;
      return recoverFormDraft(cached?.fields ? { ...cached, at: cached.at ?? 0 } : null, remote, version);
    } catch {
      return {};
    }
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<{ version: string; fields: Record<string, string>; at: number } | null>(null);
  const queue = useRef(Promise.resolve());
  function flush() {
    const data = pending.current;
    if (!cloudEnabled || !data) return;
    pending.current = null;
    queue.current = queue.current.then(() => run(() => save("settings", data, recordId)));
  }
  useEffect(() => {
    const hide = () => { if (document.hidden) flush(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", flush);
    return () => {
      clearTimeout(timer.current);
      flush();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", flush);
    };
  }, [recordId, cloudEnabled]);
  function clear() {
    clearTimeout(timer.current);
    pending.current = null;
    try { localStorage.removeItem(key); } catch { /* Storage is optional. */ }
    if (cloudEnabled) queue.current = queue.current.then(() => run(async () => {
      if ((await allEntries()).some((e) => e.id === recordId && !e.deleted)) await trash(recordId);
    }));
  }
  function write(fields: Record<string, string>) {
    const data = { version, fields, at: Date.now() };
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch { /* The form remains usable if storage is unavailable. */ }
    if (cloudEnabled) {
      pending.current = data;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 1200);
    }
  }
  function read(form: HTMLFormElement) {
    return Object.fromEntries(Array.from(new FormData(form), ([name, value]) =>
      [name, typeof value === "string" ? value : ""] as const,
    ));
  }
  return { initial, write, read, clear, discard: () => { clear(); setInitial({}); } };
}

export function BodyForm({
  entry,
  close,
}: {
  entry?: Entry;
  close: () => void;
}) {
  const { run, readOnly } = useData();
  const draft = useFormDraft("body", entry);
  const [revision, setRevision] = useState(0);
  const [photoId, setPhotoId] = useState<string | undefined>(draft.initial.photoId ?? entry?.data.photoId);
  const formRef = useRef<HTMLFormElement>(null);
  const attach = (file?: File) => {
    const form = formRef.current;
    if (file && form) void run(async () => {
      const id = await addPhoto(file, "ผลวัดร่างกาย");
      setPhotoId(id);
      draft.write({ ...draft.read(form), photoId: id });
    });
  };
  usePastedImage(formRef, attach);
  return (
    <Modal title={readOnly ? "ผลวัดร่างกาย" : "บันทึกผลวัดร่างกาย"} close={close}>
      <form
        ref={formRef}
        key={revision}
        className="form"
        onChange={(e) => draft.write({ ...draft.read(e.currentTarget), ...(photoId && { photoId }) })}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            const enteredUrl = String(f.get("reportUrl") ?? "").trim();
            const url = reportUrl(enteredUrl);
            if (enteredUrl && !url) throw Error("กรอกลิงก์เอกสารที่ขึ้นต้นด้วย HTTPS");
            const data: Body = {
              ...entry?.data,
              date: String(f.get("date")),
              weight: number(f.get("weight")),
              waist: number(f.get("waist")),
              fat: number(f.get("fat")),
              smm: number(f.get("smm")),
              note: String(f.get("note")),
              reportUrl: url,
              photoId,
            };
            if (
              [data.weight, data.waist, data.fat, data.smm].every(
                (v) => v === null,
              ) && !url && !photoId
            )
              throw Error("กรอกผลวัดอย่างน้อยหนึ่งค่า หรือแนบเอกสาร");
            await save("body", data, entry?.id);
            draft.clear();
            close();
          }, "บันทึกผลวัดแล้ว");
        }}
      >
        <fieldset className="form-lock" disabled={readOnly}>
        {Object.keys(draft.initial).length > 0 && (
          <div className="notice">
            เปิดแบบร่างที่กรอกค้างไว้แล้ว
            <button type="button" className="text-button" onClick={() => {
              draft.discard();
              setPhotoId(entry?.data.photoId);
              setRevision((value) => value + 1);
            }}>ทิ้งแบบร่าง</button>
          </div>
        )}
        <Field label="วันที่วัด">
          <input
            name="date"
            type="date"
            required
            defaultValue={draft.initial.date ?? entry?.data.date ?? today()}
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
                defaultValue={draft.initial[k] ?? entry?.data[k] ?? ""}
              />
            </Field>
          ))}
        </div>
        <Field label="วิธีวัด / หมายเหตุ">
          <textarea
            name="note"
            defaultValue={draft.initial.note ?? entry?.data.note}
            placeholder="เช่น InBody / ก่อนอาหารเช้า"
          />
        </Field>
        <Field label="ลิงก์ PDF หรือเอกสาร InBody">
          <input name="reportUrl" type="url" placeholder="https://…" maxLength={2000}
            defaultValue={draft.initial.reportUrl ?? entry?.data.reportUrl ?? ""} />
        </Field>
        <label className="secondary edit-only">
          <ImagePlus size={18} />
          แนบผล InBody (หรือวางรูปที่คัดลอกไว้)
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={(e) => attach(e.target.files?.[0])}
          />
        </label>
        {photoId && (
          <div className="evidence-preview">
            <Photo id={photoId} alt="ผลวัด" />
          </div>
        )}
        <button className="primary">บันทึกผลวัด</button>
        </fieldset>
      </form>
    </Modal>
  );
}
function HistoryPage() {
  const { entries, run } = useData(),
    [selectedId, setSelectedId] = useRememberedView("history-detail"),
    [filter, setFilter] = useState("all"),
    [gym, setGym] = useState("");
  const selected = entries.find((e) => e.id === selectedId && !e.deleted);
  const setSelected = (entry: Entry | null) => setSelectedId(entry?.id ?? null);
  const sessionSummary = (session: Session) => {
    const sets = session.exercises.flatMap((exercise) => {
      const done = exercise.sets.filter((set) => set.done);
      if (!done.length) return [];
      const name = entries.find((e) => e.id === exercise.machineId)?.data.name ?? exercise.originalName;
      const result = done.map((set) => formatSet(set, exercise.loadMode)).join(" / ");
      return [name && session.exercises.length > 1 ? `${name}: ${result}` : result];
    });
    const venues = sessionGyms(entries, session).map((id) => gymName(entries, id));
    return [...(venues.length ? venues : ["ไม่ระบุยิม"]), ...(sets.length ? sets : [session.summary])]
      .filter(Boolean).join(" · ");
  };
  const rows = entries
    .filter(
      (e) =>
        !e.deleted &&
        ["session", "cardio", "body"].includes(e.kind) &&
        (filter === "all" || e.kind === filter) &&
        (!gym || (e.kind === "session" && sessionGyms(entries, e.data).includes(gym))),
    )
    .sort((a, b) => (b.data.date || "").localeCompare(a.data.date || ""));
  return (
    <>
      <Header title="History" subtitle="เวท คาร์ดิโอ และผลวัด เรียงจากล่าสุด" />
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
            ...gymsFor(entries).map(({ id, name }) => [id, name]),
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
                activityEmoji(e.data.activity)
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
                  ? sessionSummary(e.data)
                  : e.kind === "cardio"
                    ? cardioSummary(e.data)
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
            className="icon edit-only"
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
    [busy, setBusy] = useState(false),
    [signup, setSignup] = useState(false);
  if (signup) return <SignupForm close={close} back={() => setSignup(false)} done={done} />;
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
                email: loginEmail(String(f.get("email"))),
                password: String(f.get("password")),
              });
              if (error)
                throw Error(
                  /invalid/i.test(error.message)
                    ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
                    : error.message,
                );
              done();
            } finally {
              setBusy(false);
            }
          });
        }}
      >
        <Field label="ชื่อผู้ใช้หรืออีเมล">
          <input
            name="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>
        <Field label="รหัสผ่าน">
          <PasswordInput
            name="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <button className="primary" disabled={busy}>
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
        <details className="muted">
          <summary>ลืมรหัสผ่าน?</summary>
          ติดต่อเจ้าของสมุดเพื่อตั้งรหัสใหม่
        </details>
        <button type="button" className="secondary" onClick={() => setSignup(true)}>
          สมัครสมาชิก
        </button>
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
function GymSettings() {
  const { entries, run } = useData();
  const gyms = gymsFor(entries);
  const [editing, setEditing] = useState<Gym | null>(null);
  const editNew = () => setEditing({ id: uid(), name: "", shortCode: "", archived: false });
  return (
    <section className="panel">
      <div className="section-title">
        <h2>ยิมของคุณ</h2>
        <button className="secondary" onClick={editNew}>เพิ่มยิม</button>
      </div>
      {gyms.map((gym) => (
        <button className="select-row" key={gym.id} onClick={() => setEditing(gym)}>
          {gym.name}{gym.shortCode ? ` · ${gym.shortCode}` : ""}
          {gym.archived && " · เก็บเข้าคลังแล้ว"}
        </button>
      ))}
      {editing && (
        <Modal title="รายละเอียดสถานที่ฝึก" close={() => setEditing(null)}>
          <form className="form" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const updated = {
              ...editing,
              name: String(form.get("name")).trim(),
              shortCode: String(form.get("shortCode")).trim(),
              archived: form.has("archived"),
            };
            void run(async () => {
              const latest = gymsFor(await allEntries());
              await save("settings", {
                gyms: [...latest.filter((gym) => gym.id !== updated.id), updated],
              }, gymCatalogId);
              setEditing(null);
            }, "บันทึกยิมแล้ว");
          }}>
            <Field label="ชื่อยิม"><input name="name" required maxLength={80} defaultValue={editing.name} /></Field>
            <Field label="ตัวย่อ"><input name="shortCode" maxLength={8} defaultValue={editing.shortCode} /></Field>
            <label className="check-label">
              <input name="archived" type="checkbox" defaultChecked={editing.archived} />
              เก็บเข้าคลัง
            </label>
            <button className="primary">บันทึกยิม</button>
          </form>
        </Modal>
      )}
    </section>
  );
}

function ReviewedSessionMigration() {
  const { entries, run } = useData();
  const [review, setReview] = useState<{ expected: Entry; gym: string; moves: MachineMove[] } | null>(null);
  const [applying, setApplying] = useState(false);
  return (
    <details className="panel">
      <summary>ย้ายครั้งฝึกไปเครื่องที่ตรวจแล้ว</summary>
      <label className="secondary">
        เปิดไฟล์รายการย้าย
        <input hidden type="file" accept=".json,application/json" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setReview(null);
          void run(async () => {
            const data = JSON.parse(await file.text());
            const current = entries.find((e) => e.id === data.expected?.id);
            if (!current || current.version !== data.expected.version ||
              JSON.stringify(current.data) !== JSON.stringify(data.expected.data))
              throw Error("ไฟล์รายการย้ายไม่ตรงกับครั้งฝึกล่าสุด");
            planSessionMove(entries, current.id, data.gym, data.moves);
            setReview({ expected: current, gym: data.gym, moves: data.moves });
          });
        }} />
      </label>
      {review && (
        <div className="notice">
          <p>{dateLabel(review.expected.data.date)} · {gymName(entries, review.gym)}</p>
          <ul>{review.moves.map((move) => <li key={move.from}>{move.machine.name}</li>)}</ul>
          <button className="primary" disabled={applying} onClick={() => {
            setApplying(true);
            void run(async () => {
              await moveReviewedSession(review.expected, review.gym, review.moves);
              setReview(null);
            }, "ย้ายครั้งฝึกแล้ว").finally(() => setApplying(false));
          }}>ยืนยันย้ายครั้งฝึก</button>
        </div>
      )}
    </details>
  );
}

function SettingsPage({
  synchronize,
  busy,
  openLogin,
  profile,
  viewJournal,
  clients,
}: {
  synchronize: () => void;
  busy: boolean;
  openLogin: () => void;
  profile: Profile | null;
  viewJournal: (client: Client) => void;
  clients: Client[];
}) {
  const { entries, run, notify, readOnly } = useData(),
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
  // These settings belong to the signed-in coach; while a client's journal is open only switching makes sense.
  if (readOnly) return (
    <>
      <Header title="Settings" subtitle="กลับไปข้อมูลของฉันเพื่อแก้การตั้งค่า" />
      <MyClients clients={clients} viewJournal={viewJournal} />
    </>
  );
  const showOwnerSettings = !cfg || profile?.role === "owner";
  const signOut = () => run(async () => {
    const result = await (await cloud())?.auth.signOut({ scope: "local" });
    if (result?.error) throw result.error;
    // Remove this account's copy from the browser so the next person can sign in cleanly.
    const cleared = await clearLocalAccount();
    if (!cleared) {
      localStorage.setItem("lilly-locked", "true");
      notify("รายการรอซิงก์ยังอยู่ในเครื่อง จะส่งเมื่อกลับเข้าบัญชีเดิม");
    }
    setUser("");
  }, "ออกจากระบบแล้ว");
  return (
    <>
      <Header
        title="Settings"
        subtitle={showOwnerSettings ? "การซิงก์ เป้าหมาย โปรแกรมฝึก และการสำรองข้อมูล" : undefined}
      />
      {profile && (
        <section className="panel account-panel">
          <div className="section-title">
            <div>
              <h2>บัญชีของฉัน</h2>
              <p>
                {profile.displayName} ·{" "}
                {profile.role === "owner" ? "เจ้าของสมุด" : profile.role === "trainer" ? "เทรนเนอร์" : "เพื่อน"}
              </p>
            </div>
          </div>
          <div className="upload-row">
            <EditDisplayName profile={profile} />
            <ChangePassword profile={profile} />
            <button className="danger sign-out" onClick={signOut}>
              ออกจากระบบ
            </button>
          </div>
        </section>
      )}
      {profile?.role === "trainer" && (
        <MyClients clients={clients} viewJournal={viewJournal} />
      )}
      {profile && profile.role !== "trainer" && <MyCoaches />}
      {profile?.role === "owner" && <SignupSettings />}
      {profile?.role === "owner" && <TrainerAccounts />}
      {!profile && user && (
        <section className="panel account-panel">
          <div className="upload-row">
            <button className="danger sign-out" onClick={signOut}>
              ออกจากระบบ
            </button>
          </div>
        </section>
      )}
      {showOwnerSettings && <section className="panel">
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
        </div>
        <p className="muted">
          ข้อมูลและรูปส่วนตัวอยู่ในฐานข้อมูล ไม่อยู่ในโค้ด GitHub · รอซิงก์{" "}
          {entries.filter((e) => e.dirty).length} รายการ
        </p>
      </section>}
      <RoutineSettings />
      {showOwnerSettings && <><GymSettings /><ReviewedSessionMigration /></>}
      {showOwnerSettings && <RestShortcutSettings />}
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
      {showOwnerSettings && <><section className="panel">
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
            <label className="secondary">
              เลือก ZIP ข้อมูลตั้งต้น (เฉพาะโหมดพัฒนา)
              <input hidden type="file" accept=".zip,application/zip" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void run(() => inspect(file));
              }} />
            </label>
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
                {e.data.name ?? e.data.title ?? e.data.activity ?? e.data.label ?? (e.kind === "photo" ? "รูปเครื่อง" : e.kind)}
                {e.data.date ? ` · ${dateLabel(e.data.date)}` : ""}
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
      </section></>}
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
function SessionView({ source, close }: { source: Entry; close: () => void }) {
  const { entries, run } = useData();
  const session = source.data as Session;
  const venues = sessionGyms(entries, session).map((gym) => gymName(entries, gym));
  return (
    <Modal title={session.title || "การฝึก"} close={close}>
      <div className="form">
        <p className="muted">
          {[dateLabel(session.date), ...venues, session.status === "draft" && "กำลังฝึก"].filter(Boolean).join(" · ")}
        </p>
        {session.summary && <div className="notice preserve">{session.summary}</div>}
        {session.source && <p className="muted">{session.source}</p>}
        <div className="exercise-list">
          {session.exercises.map((x, i) => {
            const m = entries.find((e) => e.id === x.machineId)?.data as Machine | undefined;
            const done = x.sets.filter((set) => set.done);
            return (
              <div className={`exercise-item ${done.length ? "done" : ""}`} key={x.machineId}>
                <div className="exercise-open">
                  <span className="exercise-thumb">
                    <MachinePhoto id={x.machineId} />
                    <b>{i + 1}</b>
                  </span>
                  <span className="exercise-text">
                    <strong>{m?.name ?? x.originalName ?? "ไม่ทราบเครื่อง"}</strong>
                    {done.length ? done.map((set) => (
                      <small className="ok" key={set.id}>{formatSet(set, x.loadMode)}{set.warmup && " (วอร์ม)"}</small>
                    )) : <small>ยังไม่มีเซตที่ยืนยัน</small>}
                    {x.setup && <small className="muted">{x.setup}</small>}
                    {x.note && <small className="muted">{x.note}</small>}
                    {m && x.originalName && x.originalName !== m.name && (
                      <small className="muted">บันทึกเดิม: {x.originalName}</small>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {session.note && <p className="preserve">{session.note}</p>}
        <button className="secondary" onClick={() =>
          run(() => navigator.clipboard.writeText(workoutMessage(session, entries)), "คัดลอกสรุปเวทแล้ว")}>
          <Copy size={16} />
          คัดลอกสรุปเวท
        </button>
      </div>
    </Modal>
  );
}
export function SessionEditor({
  id,
  close,
  focusMachine,
}: {
  id: string;
  close: () => void;
  focusMachine?: string;
}) {
  const { entries, readOnly } = useData();
  const source = entries.find((e) => e.id === id);
  if (source && readOnly) return <SessionView source={source} close={close} />;
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
  enteredAs: prev?.enteredAs,
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
    [stretchProgram, setStretchProgram] = useRememberedView(`stretch-program:${id}`),
    [saving, setSaving] = useState(false),
    [addMachine, setAddMachine] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [removeExercise, setRemoveExercise] = useState<number | null>(null),
    [focus, setFocus] = useState<number | null>(() => {
      const machine = focusMachine ?? (source.data.status === "draft" ? readView(`focus:${id}`) : null);
      const i = (source.data as Session).exercises.findIndex(
        (x) => x.machineId === machine,
      );
      return i >= 0 ? i : null;
    });
  const latest = useRef(s);
  latest.current = s;
  const savedText = useRef(JSON.stringify(source.data));
  const writeQueue = useRef(Promise.resolve());
  const finishing = useRef(false);
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
      if (!finishing.current) void run(() => saveDraft(s));
    }, 500);
    return () => clearTimeout(timeout);
  }, [s]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== savedText.current)
        e.preventDefault();
    };
    const flush = () => {
      if (!finishing.current && JSON.stringify(latest.current) !== savedText.current)
        void run(() => saveDraft(latest.current));
    };
    const visibility = () => { if (document.hidden) flush(); };
    window.addEventListener("beforeunload", prevent);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("beforeunload", prevent);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    const modal = scroller.current?.closest<HTMLElement>(".modal");
    if (modal) modal.scrollTop = 0;
    if (s.status === "draft") writeView(`focus:${id}`, focus === null ? null : s.exercises[focus]?.machineId ?? null);
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
  const loggedCount = s.exercises.filter((x) => x.sets.some((set) =>
    set.done || set.reps != null || set.load != null || !!set.loadText?.trim())).length;
  const progressCount = s.status === "draft" ? s.exercises.length : loggedCount;
  async function finish() {
    if (finishing.current) return;
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
    finishing.current = true;
    setSaving(true);
    let finished = false;
    await run(
      async () => {
        await saveDraft({
          ...s,
          status: s.status === "draft" ? "completed" : s.status,
        });
        finished = true;
        writeView(`focus:${id}`, null);
        close();
      },
      s.status === "draft" ? "บันทึกการฝึกแล้ว" : "บันทึกการแก้ไขแล้ว",
    );
    // After a successful finish this form still holds the draft copy, so it must never save again.
    if (finished) return;
    finishing.current = false;
    setSaving(false);
  }
  const keep = () => {
    if (finishing.current) return;
    return run(async () => {
      await saveDraft(latest.current);
      close();
    });
  };
  const x = focus !== null ? s.exercises[focus] : undefined;
  const m = x
    ? (entries.find((e) => e.id === x.machineId)?.data as Machine | undefined)
    : undefined;
  const stretchIds = s.exercises.filter(({ machineId }) => isStretch(machineId)).map(({ machineId }) => machineId);
  const stretchPhoto = (machineId: string) => {
    const machine = entries.find((entry) => entry.id === machineId && entry.kind === "machine");
    return machine && <MachineCover entry={machine} entries={entries} />;
  };
  const timerIds = stretchProgram && stretchIds.length ? stretchIds : x && isStretch(x.machineId) ? [x.machineId] : [];
  const leaveStretch = () => {
    setStretchProgram(null);
    setFocus(null);
  };
  const saveStretch = (results: Map<string, number>) => {
    setS((previous) => ({
      ...previous,
      exercises: previous.exercises.map((exercise) => {
        const reps = results.get(exercise.machineId);
        if (!reps) return exercise;
        const set: SetLog = { id: uid(), reps, holdSeconds: stretchTiming(exercise.machineId).hold, load: null, warmup: false, done: true };
        return { ...exercise, sets: [...exercise.sets, set] };
      }),
    }));
    leaveStretch();
  };
  return (
    <Modal title={x ? (m?.name ?? "เครื่อง") : s.title || "การฝึก"} close={keep}>
      <div className="form" ref={scroller}>
        {timerIds.length ? (
          <>
            {x && <div className="detail-photo">{stretchPhoto(x.machineId)}</div>}
            {x?.sets.some((set) => set.done) && (
              <p className="ok">{x.sets.filter((set) => set.done).map((set) => formatSet(set, x.loadMode)).join(" / ")}</p>
            )}
            {s.status === "draft"
              ? <Stretch key={timerIds.join(",")} ids={timerIds} sessionId={id} onSave={saveStretch} back={leaveStretch}
                  photo={(machineId) => <div className="detail-photo">{stretchPhoto(machineId)}</div>} />
              : <button className="secondary" onClick={leaveStretch}>กลับไปที่รายการฝึก</button>}
          </>
        ) : x && focus !== null ? (
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
            {progressCount > 0 && (
              <div className="progress-line">
                <div>
                  <span
                    style={{
                      width: `${(doneCount / progressCount) * 100}%`,
                    }}
                  />
                </div>
                <small>
                  เสร็จ {doneCount}/{progressCount} ท่า
                  {s.status === "draft" ? " · บันทึกร่างอัตโนมัติ" : ""}
                </small>
              </div>
            )}
            {s.summary && <div className="notice preserve">{s.summary}</div>}
            {s.status === "draft" && stretchIds.length > 1 && (
              <button className="primary" onClick={() => setStretchProgram("open")}>เปิดตัวจับเวลา Stretch · {stretchIds.length} ท่า</button>
            )}
            {s.source && <p className="muted">{s.source}</p>}
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
                        <MachinePhoto id={x.machineId} />
                        <b>{i + 1}</b>
                      </span>
                      <span className="exercise-text">
                        <strong>{m?.name ?? "ไม่ทราบเครื่อง"}</strong>
                        {x.target && <small>เป้า {targetText(x.target)} · เสร็จ {done.length}/{x.target.sets}</small>}
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
                        {m && x.originalName && x.originalName !== m.name && (
                          <small className="muted">บันทึกเดิม: {x.originalName}</small>
                        )}
                      </span>
                      {done.length ? (
                        <span className="state-badge">
                          <Check size={15} />
                        </span>
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </button>
                    {(
                      <button
                        className="icon remove"
                        aria-label={`เอา ${m?.name ?? "ท่านี้"} ออกจากการฝึก`}
                        onClick={() => setRemoveExercise(i)}
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
            gym={s.gym}
            excluded={s.exercises.map((x) => x.machineId)}
            close={() => setAddMachine(false)}
            choose={(picked) => {
              setS((v) => ({
                ...v,
                exercises: [...v.exercises, exerciseFor(picked, entries, v.date, id)],
              }));
              setAddMachine(false);
            }}
          />
        )}
        {removeExercise !== null && (
          <Modal title="เอาท่านี้ออกจากการฝึก" close={() => setRemoveExercise(null)}>
            <div className="form">
              <p>รายการนี้และเซตของท่านี้จะถูกเอาออกจากการฝึกครั้งนี้</p>
              <button className="danger" onClick={() => {
                const index = removeExercise;
                setS((previous) => ({ ...previous, exercises: previous.exercises.filter((_, i) => i !== index) }));
                setRemoveExercise(null);
              }}>ยืนยันเอาท่าออก</button>
            </div>
          </Modal>
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
  const [inputMode, setInputMode] = useState<"total" | "perSide">(
    x.loadMode === "per-side" ? "perSide" : "total",
  );
  const m = entries.find((e) => e.id === x.machineId)?.data as
    Machine | undefined;
  const last = latestExercise(entries, x.machineId, date || today(), sessionId),
    best = bestSet(
      entries.filter((e) => e.id !== sessionId),
      x.machineId,
    ),
    textLoad = isTextLoad(x);
  const configurableLoad = x.loadMode === "total" || x.loadMode === "per-side";
  const divisor = configurableLoad && inputMode === "perSide" ? 2 : 1;
  const unit = configurableLoad ? (divisor === 2 ? "กก./ข้าง" : "กก.") : loadLabel(x.loadMode);
  const reference = !last && m
    ? machineVariants(entries, m)
        .filter((variant) => variant.data.gym !== m.gym)
        .flatMap((variant) => {
          const result = latestExercise(entries, variant.id, date || today(), sessionId);
          return result ? [{ gym: gymName(entries, variant.data.gym), result }] : [];
        })
        .sort((a, b) => b.result.entry.data.date.localeCompare(a.result.entry.data.date))[0]
    : undefined;
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
        <MachinePhoto id={x.machineId} />
      </div>
      <div className="focus-title">
        <small>
          {m && gymName(entries, m.gym)} · {m?.group} · {loadLabel(x.loadMode)}
        </small>
        <h3>{m?.name ?? "ไม่ทราบเครื่อง"}</h3>
        {m?.thai && <p className="muted">{m.thai}</p>}
      </div>
      {x.target && (
        <div className="notice">
          <strong>เป้าวันนี้ {targetText(x.target)}</strong>
          {x.target.note && <p>{x.target.note}</p>}
        </div>
      )}
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
      {reference && (
        <p className="muted">
          อ้างอิง: {reference.gym} · {reference.result.exercise!.sets.filter((set) => set.done)
            .map((set) => formatSet(set, reference.result.exercise!.loadMode)).join(" / ")}
          {" "} (คนละเครื่อง น้ำหนักอาจไม่เท่ากัน)
        </p>
      )}
      <RestTimer key={sessionId} sessionId={sessionId} />
      {configurableLoad && !textLoad && (
        <Field label="หน่วยที่กรอก">
          <select value={inputMode} onChange={(e) => setInputMode(e.target.value === "perSide" ? "perSide" : "total")}>
            <option value="total">น้ำหนักรวม</option>
            <option value="perSide">น้ำหนักข้างละ</option>
          </select>
        </Field>
      )}
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
                value={a.load === null ? "" : totalLoad(a, x.loadMode)! / divisor}
                disabled={x.loadMode === "bodyweight"}
                onChange={(e) =>
                  patchSet(j, {
                    load: e.target.value === "" ? null : Number(e.target.value) * divisor,
                    enteredAs: configurableLoad ? inputMode : undefined,
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
                    if (a.load !== null) return a;
                    const n = Number(
                      a.loadText?.replace(/กก\.?|kg/gi, "").trim(),
                    );
                    if (a.loadText?.trim() && !Number.isFinite(n)) return a;
                    const { loadText: _drop, ...rest } = a;
                    return {
                      ...rest,
                      load: a.loadText?.trim() && Number.isFinite(n) ? n * divisor : null,
                      enteredAs: configurableLoad ? inputMode : undefined,
                    };
                  }
                  return {
                    ...a,
                    loadText:
                      a.load !== null ? `${totalLoad(a, x.loadMode)! / divisor} กก.` : (a.loadText ?? ""),
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
