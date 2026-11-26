// Blok UI kaya untuk jawaban AI: struktur, alur, dan bentuk lain yang tidak
// cukup dijelaskan dengan markdown biasa. AI mengirim blok ```ui berisi SATU
// objek JSON; komponen di sini me-render-nya dengan paket yang sudah ada di
// proyek (lucide-react untuk ikon, CSS proyek untuk gaya). Tidak ada eksekusi
// kode atau HTML dari AI: hanya tipe yang terdaftar di bawah yang dirender,
// semua teks ditampilkan sebagai teks biasa, dan JSON yang rusak/asing jatuh
// kembali ke tampilan kode mentah supaya tidak ada yang hilang.
import React from "react";
import {
  Info, CircleCheck, TriangleAlert, CircleAlert, Lightbulb, Rocket, Globe,
  Search, Calendar, Clock, Settings, Star, Zap, BookOpen, Database, Eye,
  ShieldCheck, ArrowDown, ArrowRight, Check, X, Minus, Circle, Flag, Heart,
  GraduationCap, Code, ListChecks, TrendingUp, Layers, Timer, GitBranch,
  Folder, FileText, MapPin, Brain, Sparkles, Wrench, User, Link, Download,
  Image as ImageIcon, Cpu, MemoryStick, Gauge, Activity, Terminal, Wifi,
  Battery, HardDrive, Server, type LucideIcon,
} from "lucide-react";

const MAX_ITEMS = 12;
const MAX_TEXT = 500;
const MAX_RAW = 20000;

const ICONS: Record<string, LucideIcon> = {
  info: Info, check: CircleCheck, success: CircleCheck, warning: TriangleAlert,
  alert: TriangleAlert, error: CircleAlert, tip: Lightbulb, lightbulb: Lightbulb,
  rocket: Rocket, globe: Globe, search: Search, calendar: Calendar, clock: Clock,
  settings: Settings, star: Star, zap: Zap, book: BookOpen, database: Database,
  eye: Eye, shield: ShieldCheck, arrow: ArrowRight, flag: Flag, heart: Heart,
  school: GraduationCap, code: Code, list: ListChecks, chart: TrendingUp,
  layers: Layers, timer: Timer, branch: GitBranch, folder: Folder, file: FileText,
  pin: MapPin, brain: Brain, sparkles: Sparkles, wrench: Wrench, user: User,
  link: Link, download: Download, image: ImageIcon, cpu: Cpu, memory: MemoryStick,
  gauge: Gauge, activity: Activity, terminal: Terminal, wifi: Wifi,
  battery: Battery, harddrive: HardDrive, server: Server,
};

const iconFor = (name: unknown, fallback: LucideIcon): LucideIcon =>
  (typeof name === "string" && ICONS[name.toLowerCase()]) || fallback;

// Teks di dalam blok UI adalah teks polos, bukan markdown: model kadang
// menulis **tebal**, __garis bawah__, `kode`, atau [tautan](url) di dalam
// JSON — tanpa strip ini bintang-bintangnya ikut tampil apa adanya.
const stripUiMarkdown = (s: string): string =>
  s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? stripUiMarkdown(v.slice(0, MAX_TEXT)) : fallback;

const strArr = (v: unknown, max = MAX_ITEMS): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").slice(0, max).map((s) => stripUiMarkdown(s.slice(0, MAX_TEXT)))
    : [];

const numArr = (v: unknown, max = MAX_ITEMS): number[] =>
  Array.isArray(v)
    ? v.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).slice(0, max)
    : [];

const objArr = (v: unknown, max = MAX_ITEMS): Record<string, unknown>[] =>
  Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)).slice(0, max)
    : [];

type UiData = { type: string; [key: string]: unknown };

// Tipe blok UI yang dikenal. Dipakai sebagai safety net di aiagent.tsx:
// JSON apa pun (pagar ```json, tanpa label, sebaris, bahkan tanpa pagar)
// yang isinya salah satu tipe ini langsung di-render sebagai UiBlock,
// bukan sebagai code block hitam.
export const UI_TYPES = new Set([
  "card", "steps", "flow", "timeline", "compare", "chart", "checklist", "stats",
]);

const tryParseUi = (text: string): UiData | null => {
  const tryOnce = (candidate: string): UiData | null => {
    try {
      const data: unknown = JSON.parse(candidate);
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      if (typeof (data as UiData).type !== "string") return null;
      if (!UI_TYPES.has((data as UiData).type.toLowerCase())) return null;
      return data as UiData;
    } catch {
      return null;
    }
  };
  const trimmed = text.trim();
  return tryOnce(trimmed)
    // Model kadang menyisakan koma di akhir sebelum } atau ] — JSON strict
    // gagal, tapi isinya tetap bisa dibaca setelah koma itu dibuang.
    ?? tryOnce(trimmed.replace(/,\s*([}\]])/g, "$1"));
};

const parseUi = (raw: string): UiData | null => {
  if (!raw || raw.length > MAX_RAW) return null;
  return tryParseUi(raw);
};

export const isUiJson = (raw: string): boolean =>
  !!raw && raw.trim().length <= MAX_RAW && tryParseUi(raw) !== null;

// Cari SATU objek JSON Ui di dalam teks bebas (mis. model mengirim JSON
// tanpa pagar sama sekali). Scan diseimbangkan dengan kurung kurawal dan
// menghormati string ber-escape, supaya { di dalam teks biasa tidak salah
// potong. Kembalikan posisi + JSON-nya, atau null kalau tidak ada.
export const extractUiJson = (
  text: string,
): { json: string; start: number; end: number } | null => {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') {
        inStr = true;
      } else if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(i, j + 1);
          if (tryParseUi(candidate)) return { json: candidate, start: i, end: j + 1 };
          break;
        }
      }
    }
  }
  return null;
};

const UiTitle = ({ title }: { title: string }) =>
  title ? <div className="aiagent-ui-title">{title}</div> : null;

const TONE_ICON: Record<string, LucideIcon> = {
  info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert, tip: Lightbulb,
};

const UiCard = ({ data }: { data: UiData }) => {
  const tone = ["info", "success", "warning", "error", "tip"].includes(str(data.tone)) ? str(data.tone) : "info";
  const Icon = iconFor(data.icon, TONE_ICON[tone]);
  return (
    <div className={`aiagent-ui-card tone-${tone}`}>
      <span className="aiagent-ui-card-icon"><Icon size={20} /></span>
      <div className="aiagent-ui-card-body">
        {str(data.title) ? <div className="aiagent-ui-card-title">{str(data.title)}</div> : null}
        {str(data.body) ? <div className="aiagent-ui-card-text">{str(data.body)}</div> : null}
      </div>
    </div>
  );
};

const UiSteps = ({ data }: { data: UiData }) => {
  const items = objArr(data.items).filter((it) => str(it.title) || str(it.text));
  if (!items.length) return null;
  return (
    <div className="aiagent-ui-block">
      <UiTitle title={str(data.title)} />
      <ol className="aiagent-ui-steps">
        {items.map((it, i) => (
          <li key={i} className="aiagent-ui-step">
            <span className="aiagent-ui-step-num">{i + 1}</span>
            <div>
              {str(it.title) ? <div className="aiagent-ui-step-title">{str(it.title)}</div> : null}
              {str(it.text) ? <div className="aiagent-ui-step-text">{str(it.text)}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

const UiFlow = ({ data }: { data: UiData }) => {
  const items = objArr(data.items).filter((it) => str(it.label) || str(it.text));
  if (!items.length) return null;
  return (
    <div className="aiagent-ui-block">
      <UiTitle title={str(data.title)} />
      <div className="aiagent-ui-flow">
        {items.map((it, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <ArrowDown size={16} className="aiagent-ui-flow-arrow" /> : null}
            <div className="aiagent-ui-flow-node">
              {str(it.label) ? <div className="aiagent-ui-flow-label">{str(it.label)}</div> : null}
              {str(it.text) ? <div className="aiagent-ui-flow-text">{str(it.text)}</div> : null}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const UiTimeline = ({ data }: { data: UiData }) => {
  const items = objArr(data.items).filter((it) => str(it.title) || str(it.text) || str(it.date));
  if (!items.length) return null;
  return (
    <div className="aiagent-ui-block">
      <UiTitle title={str(data.title)} />
      <ol className="aiagent-ui-timeline">
        {items.map((it, i) => (
          <li key={i} className="aiagent-ui-timeline-item">
            <span className="aiagent-ui-timeline-dot" />
            <div>
              {str(it.date) ? <div className="aiagent-ui-timeline-date">{str(it.date)}</div> : null}
              {str(it.title) ? <div className="aiagent-ui-timeline-title">{str(it.title)}</div> : null}
              {str(it.text) ? <div className="aiagent-ui-timeline-text">{str(it.text)}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

const UiCompare = ({ data }: { data: UiData }) => {
  const columns = objArr(data.columns, 4).filter((c) => str(c.title) || strArr(c.items).length > 0);
  if (!columns.length) return null;
  return (
    <div className="aiagent-ui-block">
      <UiTitle title={str(data.title)} />
      <div className="aiagent-ui-compare">
        {columns.map((col, i) => {
          const tone = str(col.tone);
          const ToneIcon = tone === "good" ? Check : tone === "bad" ? X : Minus;
          return (
            <div key={i} className={`aiagent-ui-compare-col tone-${tone === "good" || tone === "bad" ? tone : "neutral"}`}>
              {str(col.title) ? <div className="aiagent-ui-compare-title">{str(col.title)}</div> : null}
              <ul>
                {strArr(col.items).map((item, j) => (
                  <li key={j}><ToneIcon size={13} className="aiagent-ui-compare-icon" /><span>{item}</span></li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const UiChart = ({ data }: { data: UiData }) => {
  const labels = strArr(data.labels);
  const values = numArr(data.values);
  const rows = labels.slice(0, values.length).map((label, i) => ({ label, value: values[i] }));
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="aiagent-ui-block">
      <UiTitle title={str(data.title)} />
      <div className="aiagent-ui-chart">
        {rows.map((row, i) => (
          <div key={i} className="aiagent-ui-chart-row">
            <span className="aiagent-ui-chart-label">{row.label}</span>
            <span className="aiagent-ui-chart-track">
              <span className="aiagent-ui-chart-fill" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
            </span>
            <span className="aiagent-ui-chart-value">{row.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const UiChecklist = ({ data }: { data: UiData }) => {
  const items = objArr(data.items).filter((it) => str(it.text));
  if (!items.length) return null;
  return (
    <div className="aiagent-ui-block">
      <UiTitle title={str(data.title)} />
      <ul className="aiagent-ui-checklist">
        {items.map((it, i) => (
          <li key={i} className={it.done === true ? "done" : ""}>
            {it.done === true ? <CircleCheck size={15} /> : <Circle size={15} />}
            <span>{str(it.text)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const UiStats = ({ data }: { data: UiData }) => {
  const items = objArr(data.items, 6).filter((it) => str(it.label) || str(it.value));
  if (!items.length) return null;
  return (
    <div className="aiagent-ui-block">
      <UiTitle title={str(data.title)} />
      <div className="aiagent-ui-stats">
        {items.map((it, i) => (
          <div key={i} className="aiagent-ui-stat">
            {str(it.value) ? <div className="aiagent-ui-stat-value">{str(it.value)}</div> : null}
            {str(it.label) ? <div className="aiagent-ui-stat-label">{str(it.label)}</div> : null}
            {str(it.note) ? <div className="aiagent-ui-stat-note">{str(it.note)}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

// Satu blok ```ui = satu objek JSON. Tipe yang tidak dikenal atau JSON yang
// rusak tidak pernah merusak chat: tampil sebagai kode mentah.
export const UiBlock: React.FC<{ raw: string }> = ({ raw }) => {
  const data = parseUi(raw);
  if (!data) {
    return (
      <div className="aiagent-code-block-wrapper">
        <pre className="aiagent-ui-fallback">{raw.slice(0, MAX_RAW)}</pre>
      </div>
    );
  }
  switch (data.type) {
    case "card": return <UiCard data={data} />;
    case "steps": return <UiSteps data={data} />;
    case "flow": return <UiFlow data={data} />;
    case "timeline": return <UiTimeline data={data} />;
    case "compare": return <UiCompare data={data} />;
    case "chart": return <UiChart data={data} />;
    case "checklist": return <UiChecklist data={data} />;
    case "stats": return <UiStats data={data} />;
    default:
      return (
        <div className="aiagent-code-block-wrapper">
          <pre className="aiagent-ui-fallback">{raw.slice(0, MAX_RAW)}</pre>
        </div>
      );
  }
};
