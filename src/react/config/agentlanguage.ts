// Tampilan AI Agent selalu berbahasa Inggris (permintaan user 2026-11-26):
// semua label Proses, tombol, dan info token pakai Inggris, apa pun bahasa
// browser. Bahasa JAWABAN AI tetap mengikuti bahasa yang dipakai user di
// chat (aturan "Reply in the user's language" di system prompt) — kalau
// jawaban juga mau dipaksa Inggris, itu perubahan terpisah di system prompt.
// Bahasa lain jatuh ke Inggris. Tambah bahasa baru = tambah satu entri di
// AGENT_PROCESS_STRINGS (dan AGENT_STRINGS di workerlocal.py untuk label tool).
export type AgentLanguage = "id" | "en";

export const detectAgentLanguage = (): AgentLanguage => {
  return "en";
};

export interface AgentProcessStrings {
  working: string;
  process: string;
  steps: string;
  failed: string;
  viewThought: string;
  viewResult: string;
  copy: string;
  copied: string;
  stop: string;
  tokensUsed: string;
  cancelled: string;
  understanding: string;
  usingTool: string;
  toolDone: string;
}

export const AGENT_PROCESS_STRINGS: Record<AgentLanguage, AgentProcessStrings> = {
  id: {
    working: "Bekerja…",
    process: "Proses",
    steps: "langkah",
    failed: "gagal",
    viewThought: "Lihat pikiran",
    viewResult: "Lihat hasil",
    copy: "Salin",
    copied: "Disalin",
    stop: "Berhenti",
    tokensUsed: "Token dipakai",
    cancelled: "Dibatalkan oleh user.",
    understanding: "Memahami permintaan…",
    usingTool: "Memakai tool",
    toolDone: "selesai",
  },
  en: {
    working: "Working…",
    process: "Process",
    steps: "steps",
    failed: "failed",
    viewThought: "View thought",
    viewResult: "View result",
    copy: "Copy",
    copied: "Copied",
    stop: "Stop",
    tokensUsed: "Tokens used",
    cancelled: "Cancelled by user.",
    understanding: "Understanding the request…",
    usingTool: "Using tool",
    toolDone: "done",
  },
};

export const getAgentProcessStrings = (lang: AgentLanguage): AgentProcessStrings =>
  AGENT_PROCESS_STRINGS[lang];

// Konteks waktu & wilayah user untuk AI Local: zona waktu browser, waktu lokal
// saat ini, dan locale. Dikirim di tiap chat supaya worker tahu waktu, tanggal,
// dan wilayah user — dan bisa membandingkannya dengan wilayahnya sendiri.
export interface AgentUserContext {
  timezone: string;
  local_time: string;
  locale: string;
}

export const detectUserContext = (): AgentUserContext => {
  const now = new Date();
  let timezone = "UTC";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    timezone = "UTC";
  }
  // Waktu lokal user dengan offset-nya (misal 2026-11-25T22:20:00+07:00),
  // bukan toISOString() yang selalu UTC dan bisa bikin AI salah baca jam user.
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -now.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const localISO =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return {
    timezone,
    local_time: localISO,
    locale: typeof navigator !== "undefined" ? (navigator.language || "") : "",
  };
};

// Label tampilan tool — sama dengan AGENT_STRINGS di workerlocal.py.
export const AGENT_TOOL_LABELS: Record<string, Record<AgentLanguage, string>> = {
  list_dir: { id: "Memeriksa isi folder…", en: "Checking folder contents…" },
  read_file: { id: "Membaca file…", en: "Reading file…" },
  patch_file: { id: "Mengedit file…", en: "Editing file…" },
  write_file: { id: "Menulis file…", en: "Writing file…" },
  run_bash: { id: "Menjalankan perintah…", en: "Running command…" },
  web_search: { id: "Mencari di web…", en: "Searching the web…" },
  web_fetch: { id: "Mengambil halaman web…", en: "Fetching web page…" },
  inspect_image: { id: "Menganalisis gambar…", en: "Analyzing image…" },
  read_document: { id: "Membaca dokumen…", en: "Reading document…" },
};

export const describeAgentTool = (name: string, lang: AgentLanguage): string | null => {
  const entry = AGENT_TOOL_LABELS[name];
  return entry ? entry[lang] : null;
};
