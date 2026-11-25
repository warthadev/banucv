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
}

export const AGENT_PROCESS_STRINGS: Record<AgentLanguage, AgentProcessStrings> = {
  id: {
    working: "Bekerja…",
    process: "Proses",
    steps: "langkah",
    failed: "gagal",
    viewThought: "Lihat pikiran",
    viewResult: "Lihat hasil",
  },
  en: {
    working: "Working…",
    process: "Process",
    steps: "steps",
    failed: "failed",
    viewThought: "View thought",
    viewResult: "View result",
  },
};

export const getAgentProcessStrings = (lang: AgentLanguage): AgentProcessStrings =>
  AGENT_PROCESS_STRINGS[lang];
