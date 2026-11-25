// Bahasa tampilan AI Local mengikuti bahasa yang dipakai user, diambil dari
// bahasa browser (navigator.language). Didukung: Indonesia (id) dan Inggris (en).
// Bahasa lain jatuh ke Inggris. Tambah bahasa baru = tambah satu entri di
// AGENT_PROCESS_STRINGS (dan AGENT_STRINGS di workerlocal.py untuk label tool).

export type AgentLanguage = "id" | "en";

export const detectAgentLanguage = (): AgentLanguage => {
  const raw = typeof navigator !== "undefined" ? (navigator.language || "") : "";
  const lang = raw.trim().toLowerCase();
  if (lang.startsWith("id")) return "id";
  if (lang.startsWith("en")) return "en";
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
