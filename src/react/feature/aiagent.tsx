// src/react/feature/aiagent.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Bot, Trash2, Volume2, VolumeX, Check,
  Image as ImageIcon, X, Loader2, Sparkles, RefreshCw, FileText, Copy, Download, Folder, Home, MapPin, Plus, User, Link, ChevronDown, Wrench, Brain, Crop
} from "lucide-react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import useAgentModels, { ROUTER_CREDENTIAL_UPDATED_EVENT } from "@hook/useagentmodels";
import useAgentLocal, { type AgentLocalCheck, type AgentLocalStep, type AgentProcessStep } from "@hook/useagentlocal";
import { AI_AGENT_API_BASE } from "@config/api";
import { saveOpenRouterCredentials } from "@config/routerhelper";
import { saveKaggleCredentials } from "@config/kagglecredentials";
import { detectAgentLanguage, detectUserContext, describeAgentTool, getAgentProcessStrings } from "@config/agentlanguage";
import { canSendAgentModel, shouldShowRouterAuthModal } from "@config/agentauthflow";
import { isLocalAgentModel, isRetryableAgentAvailabilityError, resolveAgentModelRoute, shouldRetryWithNextAgentModel } from "@config/agentrouting";
import { CloudModalKaggle } from "./cloudmodalkaggle";
import { buildModelScopedHistory, formatAgentFileContext, getAgentRequestModels, getAgentMessagesStorageKey, getAgentPreferencesStorageKey, parseAgentModeSettings, type AgentMode } from "@config/agentmodes";
import { parseAgentFile, shouldStageFileOnKaggle } from "@config/agentfileparser";
import { useAudio } from "@hook/useaudio";
import Loading from "@control/loading";
import ReactMarkdown, { type Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { getAuth, getDb } from "@config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { confirmHostAction, type HostActionPreview } from "@config/agentworkspace";
import { UiBlock } from "./agentuiblocks";
import { ImageCropper, type CroppedImage } from "./agentimagecropper";
import { RouterAuthModal } from "./routerauthmodal";

const STREAM_MESSAGE_ID = "streaming";
const PROCESS_OUTPUT_KEEP = 400;
const PROCESS_STEPS_KEEP = 60;

type ProcessStep = AgentProcessStep;
type ProcessStepPatch = Partial<ProcessStep> & { id: string };

// Blok proses: pesan berjalan (berpikir / tool) yang terpisah dari jawaban akhir dan bisa dibuka-tutup.
const ProcessBlock: React.FC<{ steps: ProcessStep[]; live: boolean; open: boolean; onToggle: () => void; onStop?: () => void }> = ({ steps, live, open, onToggle, onStop }) => {
  const lang = detectAgentLanguage();
  const strings = getAgentProcessStrings(lang);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyStepOutput = async (step: ProcessStep) => {
    const text = step.output || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); } catch { /* abaikan */ }
      document.body.removeChild(area);
    }
    setCopiedId(step.id);
    window.setTimeout(() => setCopiedId((current) => (current === step.id ? null : current)), 1500);
  };
  const running = steps.filter((step) => step.status === "running");
  const failed = steps.filter((step) => step.status === "error").length;
  const toolCount = steps.filter((step) => step.kind === "tool").length;
  const title = live
    ? (running[running.length - 1]?.title || strings.working)
    : `${strings.process} · ${toolCount > 0 ? `${toolCount} tool${lang === "en" && toolCount > 1 ? "s" : ""}` : `${steps.length} ${strings.steps}`}${failed ? ` · ${failed} ${strings.failed}` : ""}`;
  return (
    <div className={`aiagent-process${live ? " live" : ""}`}>
      <div className="aiagent-process-header">
        <button type="button" className="aiagent-process-toggle" onClick={onToggle} aria-expanded={open}>
          {live ? <Loader2 size={14} className="aiagent-process-spin" /> : failed ? <X size={14} /> : <Check size={14} />}
          <span className="aiagent-process-title">{title}</span>
          <ChevronDown size={14} className={`aiagent-process-chevron${open ? " open" : ""}`} />
        </button>
        {live && onStop ? (
          <button type="button" className="aiagent-process-stop" onClick={onStop}>
            {strings.stop}
          </button>
        ) : null}
      </div>
      {open && (
        <ol className="aiagent-process-list">
          {steps.map((step) => (
            <li key={step.id} className={`aiagent-process-step ${step.status}`}>
              <span className="aiagent-process-icon">
                {step.status === "running" ? <Loader2 size={13} className="aiagent-process-spin" />
                  : step.status === "error" ? <X size={13} />
                  : step.kind === "tool" ? <Wrench size={13} /> : <Brain size={13} />}
              </span>
              <div className="aiagent-process-body">
                <div className="aiagent-process-step-title">
                  {step.title}
                  {step.detail ? <span className="aiagent-process-detail"> {step.detail}</span> : null}
                </div>
                {step.output ? (
                  <details className="aiagent-process-output">
                    <summary>{step.kind === "thinking" ? strings.viewThought : strings.viewResult}</summary>
                    <button type="button" className="aiagent-process-copy" onClick={() => void copyStepOutput(step)}>
                      {copiedId === step.id ? strings.copied : strings.copy}
                    </button>
                    <pre>{step.output}</pre>
                  </details>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

const ROOT_CONFIRM_LABELS = {
  A: "Setujui aksi ini",
  B: "Jalankan aksi persis ini",
  C: "Saya memahami dampaknya, lanjutkan",
} as const;

const summarizeHostAction = (action: Record<string, string>) => {
  const type = action.type || "unknown";
  if (type === "write") return { title: "Tulis file host", path: action.path || "(path tidak tersedia)", impact: "Membuat atau mengganti isi file pada disk Sandbox. Isi persis terlihat di rincian aksi." };
  if (type === "move") return { title: "Pindahkan file host", path: `${action.source || "?"} → ${action.destination || "?"}`, impact: "Memindahkan file atau direktori pada disk Sandbox." };
  if (type === "delete") return { title: "Hapus dari disk host", path: action.path || "(path tidak tersedia)", impact: "Menghapus permanen file atau seluruh isi direktori pada disk Sandbox." };
  if (type === "command") return { title: "Jalankan perintah sebagai root", path: "/ (seluruh root Sandbox)", impact: "Perintah shell ini berjalan dengan hak root dan dapat mengubah file sistem maupun konfigurasi host." };
  return { title: "Aksi host", path: action.path || "(path tidak tersedia)", impact: "Periksa rincian aksi lengkap sebelum menyetujui." };
};

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  model?: string;
  requestedModel?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  timestamp: Date;
  images?: { data: string; mimeType: string }[];
  files?: { name: string; content: string }[];
  error?: boolean;
  errorDetails?: string;
  sources?: { title: string; url: string }[];
  searchImages?: string[];
  attachments?: { name: string; path: string; mimeType: string; size?: number; dataUrl?: string; url?: string }[];
  // Pesan proses (berpikir / tool) yang terpisah dari jawaban akhir.
  process?: ProcessStep[];
  processLive?: boolean;
}

interface UploadedFile {
  name: string;
  content: string;
  type: string;
  blob?: File;
  stageOnKaggle?: boolean;
  kagglePath?: string;
}

interface UploadedImage {
  data: string;
  mimeType: string;
  preview: string;
  name?: string;
  blob?: File;
  kagglePath?: string;
}

const readBlobAsDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("Unable to read the selected image"));
  reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read the selected image"));
  reader.readAsDataURL(blob);
});

const prepareUploadedImage = async (file: File): Promise<UploadedImage> => {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
  const dataUrl = await readBlobAsDataUrl(file);
  return { data: dataUrl.split(",", 2)[1] || "", mimeType: file.type.toLowerCase(), preview: dataUrl };
};

const isLikelyVisionAgentModel = (model: string): boolean => {
  const id = model.trim().toLowerCase();
  return /gemini|claude|pixtral|llava/.test(id) ||
    /(^|[/-])gpt-(?:4o|4\.1|5)(?:[-/.:]|$)/.test(id) ||
    /(^|[/_.:-])(?:vl|vision|omni)(?:[/_.:-]|$)/.test(id);
};

const prioritizeVisionAgentModels = (models: string[], hasImages: boolean): string[] => {
  if (!hasImages) return models.filter((model) => !isLocalAgentModel(model));
  const cloudModels = models.filter((model) => !isLocalAgentModel(model));
  return [
    ...cloudModels.filter(isLikelyVisionAgentModel),
    ...cloudModels.filter((model) => !isLikelyVisionAgentModel(model)),
  ];
};

class AgentRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AgentRequestError";
    this.status = status;
    this.code = code;
  }
}

const parseAgentErrorPayload = (payload: unknown, status: number): AgentRequestError => {
  const payloadRecord = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : undefined;
  const detail = payloadRecord && "detail" in payloadRecord ? payloadRecord.detail : payload;
  if (typeof detail === "string") return new AgentRequestError(detail, status);
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (typeof item !== "object" || item === null || !("msg" in item)) return "";
      return typeof item.msg === "string" ? item.msg : "";
    }).filter(Boolean);
    return new AgentRequestError(messages.join("; ") || `AI Agent request failed: ${status}`, status);
  }
  const detailRecord = typeof detail === "object" && detail !== null ? detail as Record<string, unknown> : undefined;
  const message = detailRecord && typeof detailRecord.message === "string" ? detailRecord.message : `AI Agent request failed: ${status}`;
  const code = detailRecord && typeof detailRecord.code === "string" ? detailRecord.code : undefined;
  return new AgentRequestError(message, status, code);
};

const normalizeAgentSources = (value: unknown): { title: string; url: string }[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((source: unknown) => {
    if (typeof source !== "object" || source === null) return [];
    const record = source as Record<string, unknown>;
    if (typeof record.url !== "string") return [];
    try {
      const url = new URL(record.url);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return [];
      const title = typeof record.title === "string" && record.title.trim() ? record.title.trim().slice(0, 240) : url.hostname;
      return [{ title, url: url.href }];
    } catch {
      return [];
    }
  }).slice(0, 8);
};

interface AgentStreamFinal {
  text: string;
  model?: string;
  requestedModel: string;
  usage?: Message["usage"];
  sources?: { title: string; url: string }[];
  attachments?: { name: string; path: string; mimeType: string; size?: number; dataUrl?: string; url?: string }[];
  pendingHostAction?: HostActionPreview;
}

const AIAGENT_POPOVER_TRIGGER_GAP = 8;

interface AIAgentPopoverPosition {
  bottom?: number;
  top?: number;
  left: number;
  maxHeight: number;
}

interface AIAgentPopoverProps {
  children: React.ReactNode;
  className: string;
  position: AIAgentPopoverPosition;
  id?: string;
  role?: React.AriaRole;
  ariaModal?: boolean;
  ariaLabelledBy?: string;
}

const AIAgentPopover: React.FC<AIAgentPopoverProps> = ({
  children,
  className,
  position,
  id,
  role,
  ariaModal,
  ariaLabelledBy,
}) => (
  <motion.div
    id={id}
    className={`aiagent-popover-panel ${className}`}
    style={{ position: "fixed", ...(position.top !== undefined ? { top: position.top } : { bottom: position.bottom }), left: position.left, maxHeight: position.maxHeight }}
    initial={{ opacity: 0, y: 6, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 6, scale: 0.98 }}
    transition={{ duration: 0.16, ease: "easeOut" }}
    role={role}
    aria-modal={ariaModal}
    aria-labelledby={ariaLabelledBy}
  >
    {children}
  </motion.div>
);

// Render inline markdown (bold, italic, inline code, links) inside table cells.
// ReactMarkdown wraps everything in a <p>, which breaks <td>/<th> layout, so
// table cells use this small, self-contained inline parser instead.
const renderInlineMarkdown = (text: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[2] !== undefined || match[3] !== undefined) {
      nodes.push(<strong key={key++}>{match[2] ?? match[3]}</strong>);
    } else if (match[4] !== undefined) {
      nodes.push(<code key={key++}>{match[4]}</code>);
    } else if (match[5] !== undefined || match[6] !== undefined) {
      nodes.push(<em key={key++}>{match[5] ?? match[6]}</em>);
    } else if (match[7] !== undefined && match[8] !== undefined) {
      nodes.push(<a key={key++} href={match[8]} target="_blank" rel="noopener noreferrer">{match[7]}</a>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
};

const TableBlock = ({ content }: { content: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const lines = content.split('\n').filter(line => line.trim());
    const csvLines: string[] = [];
    let headerRow: string[] | null = null;
    const dataRows: string[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^\s*\|[\s\-:|]+\|\s*$/)) continue;
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      if (cells.length === 0) continue;

      if (headerRow === null) {
        headerRow = cells;
      } else {
        dataRows.push(cells);
      }
    }

    if (headerRow) {
      csvLines.push(headerRow.join(','));
      for (const row of dataRows) {
        csvLines.push(row.join(','));
      }
    }

    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = 'table.csv';
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseTable = (markdown: string) => {
    const lines = markdown.split('\n').filter(line => line.trim());
    if (lines.length < 2) return null;

    const separatorIndex = lines.findIndex(line => line.match(/^\s*\|[\s\-:|]+\|\s*$/));
    if (separatorIndex === -1) return null;

    const headerCells = lines[0].split('|').map(cell => cell.trim()).filter(cell => cell);
    const bodyLines = lines.slice(separatorIndex + 1);

    return (
      <>
        <thead>
          <tr>
            {headerCells.map((cell, idx) => (
              <th key={idx}>{renderInlineMarkdown(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyLines.map((line, rowIdx) => {
            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
            return (
              <tr key={rowIdx}>
                {cells.map((cell, cellIdx) => (
                  <td key={cellIdx}>{renderInlineMarkdown(cell)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </>
    );
  };

  const tableContent = parseTable(content);
  if (!tableContent) return null;

  return (
    <div className="aiagent-table-block-wrapper">
      <div className="aiagent-table-header">
        <span className="aiagent-table-label">Table</span>
        <div className="aiagent-table-actions">
          <button onClick={handleCopy} className="aiagent-table-btn">
            {copied ? 'Copied!' : <Copy size={14} />}
            <span>Copy</span>
          </button>
          <button onClick={handleDownload} className="aiagent-table-btn">
            <Download size={14} />
            <span>CSV</span>
          </button>
        </div>
      </div>
      <div className="aiagent-table-scroll">
        <table className="aiagent-table-content">
          {tableContent}
        </table>
      </div>
    </div>
  );
};

const CodeBlock = ({ language, code }: { language: string; code: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = `code.${language || "txt"}`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="aiagent-code-block-wrapper">
      <div className="aiagent-code-block-actions">
        <button onClick={handleCopy} className="code-copy-btn">{copied ? "Copied!" : <Copy size={14} />}</button>
        <button onClick={handleDownload} className="code-download-btn"><Download size={14} /></button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        PreTag="div"
        customStyle={{
          background: 'transparent',
          padding: '16px',
          margin: 0,
          border: 'none',
          outline: 'none',
          borderRadius: 0,
        }}
        codeTagProps={{
          style: {
            border: 'none',
            outline: 'none',
            background: 'transparent',
            textDecoration: 'none',
          }
        }}
        lineProps={{
          style: {
            border: 'none',
            outline: 'none',
            textDecoration: 'none',
          }
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownComponents: Components = {
  code({ node, className, children, ...props }) {
    void node;
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children).replace(/\n$/, "");
    return className && match ? <CodeBlock language={match[1]} code={code} /> : <code className={className} {...props}>{children}</code>;
  },
  a({ href, children }) { return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>; },
  img({ src, alt }) { return <img src={src} alt={alt} className="aiagent-markdown-img" />; },
  table({ children }) {
    return <div className="aiagent-markdown-table-wrapper">{children}</div>;
  },
  thead({ children }) {
    return <thead className="aiagent-markdown-thead">{children}</thead>;
  },
  th({ children }) {
    return <th className="aiagent-markdown-th">{children}</th>;
  },
  td({ children }) {
    return <td className="aiagent-markdown-td">{children}</td>;
  },
  tr({ children }) {
    return <tr className="aiagent-markdown-tr">{children}</tr>;
  },
};

const cleanMarkdown = (text: string) => text.split("\u0000").join("").replace(/\r\n/g, "\n").trim();

const formatElapsed = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const LocalBootProgress = ({ steps, connecting }: { steps: AgentLocalStep[]; connecting: boolean }) => {
  // Before the first status response arrives, show the first step as in progress.
  const visible: AgentLocalStep[] = steps.length
    ? steps
    : [{ id: "push", label: "Sending the worker to Kaggle", state: connecting ? "active" : "pending" }];
  return (
    <ol className="aiagent-local-steps" aria-label="Kaggle startup progress">
      {visible.map((step) => (
        <li key={step.id} className={`aiagent-local-step aiagent-local-step-${step.state}`}>
          <span className="aiagent-local-step-mark" aria-hidden="true">
            {step.state === "done" ? "✓" : step.state === "error" ? "!" : step.state === "active" ? "…" : "·"}
          </span>
          <span className="aiagent-local-step-copy">
            <span>{step.label}</span>
            {step.detail && <small>{step.detail}</small>}
          </span>
        </li>
      ))}
    </ol>
  );
};

const LocalChecklist = ({ checks }: { checks: AgentLocalCheck[] }) => (
  <ul className="aiagent-local-steps" aria-label="Requirements">
    {checks.map((check) => (
      <li key={check.id} className={`aiagent-local-step aiagent-local-step-${check.ok ? "done" : "error"}`}>
        <span className="aiagent-local-step-mark" aria-hidden="true">{check.ok ? "✓" : "!"}</span>
        <span className="aiagent-local-step-copy">
          <span>{check.label}</span>
          {check.detail && check.id === "kernel" && <small>{check.detail}</small>}
        </span>
      </li>
    ))}
  </ul>
);

// Satu-satunya tombol perintah AI Local: Run (mulai worker baru kalau belum
// ada, muat ulang model kalau worker sudah ready) dan Stop. Ditulis sekali
// di sini supaya tidak ada JSX tombol yang ganda di tiap status.
const LocalRunButton = ({ label, onRun }: { label: string; onRun: () => void }) => (
  <button type="button" className="aiagent-model-option aiagent-local-connect-btn" onClick={() => void onRun()}>
    {label}
  </button>
);

const LocalStopButton = ({ onStop }: { onStop: () => void }) => (
  <button type="button" className="aiagent-model-option aiagent-local-connect-btn aiagent-local-danger-btn" onClick={() => void onStop()}>
    Stop Worker
  </button>
);

const stripMarkdownForSpeech = (text: string, codeBlockLabel = "code block") => text
  .replace(/```[\s\S]*?```/g, codeBlockLabel)
  .replace(/`[^`]+`/g, "")
  .replace(/#{1,6}\s+/g, "")
  .replace(/\*\*(.+?)\*\*/g, "$1")
  .replace(/\*(.+?)\*/g, "$1")
  .replace(/__(.+?)__/g, "$1")
  .replace(/_(.+?)_/g, "$1")
  .replace(/~~(.+?)~~/g, "$1")
  .replace(/\[(.+?)\]\(.+?\)/g, "$1")
  .replace(/!\[.*?\]\(.+?\)/g, "")
  .replace(/^\s*[-*+]\s+/gm, "")
  .replace(/^\s*\d+\.\s+/gm, "")
  .replace(/^\s*>\s+/gm, "")
  .replace(/[-]{3,}/g, "")
  .replace(/\|/g, " ")
  .split("\u0000").join("")
  .replace(/\r\n/g, "\n")
  .trim();

const detectLanguage = (text: string): "id" | "en" => {
  const cleanText = text
    .replace(/[^a-zA-Z ]/g, " ")
    .toLowerCase()
    .trim();

  if (!cleanText) return "en";

  const idWords = [
    "yang", "dan", "atau", "ini", "itu", "saya", "kamu", "kita", "mereka", "dia",
    "aku", "anda", "kami", "kalian", "adalah", "untuk", "dari", "dengan", "pada",
    "ke", "di", "sebagai", "oleh", "karena", "jika", "maka", "tetapi", "namun",
    "sangat", "bisa", "akan", "telah", "sudah", "belum", "masih", "lagi", "juga",
    "bukan", "tidak", "ada", "banyak", "sedikit", "semua", "sendiri", "sekali",
    "atau", "seperti", "begitu", "begini", "begitu", "sehingga", "karena", "agar",
    "supaya", "tanpa", "per", "terlalu", "apa", "siapa", "mana", "bagaimana", "kenapa"
  ];

  const enWords = [
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
    "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
    "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
    "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
    "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
    "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
    "even", "new", "want", "because", "any", "these", "give", "day", "most", "us"
  ];

  const words = cleanText.split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return "en";

  let idScore = 0;
  let enScore = 0;

  for (const word of words) {
    if (idWords.includes(word)) idScore++;
    if (enWords.includes(word)) enScore++;
  }

  const idPercentage = idScore / words.length;
  const enPercentage = enScore / words.length;

  if (idPercentage > 0.12 && idPercentage > enPercentage * 1.5) {
    return "id";
  }

  return "en";
};

const getErrorText = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  return error == null ? "" : String(error);
};

const isCurrentBackendCapacityFailure = (error: unknown): boolean => isRetryableAgentAvailabilityError(error);

const isRetryableAgentFailure = (error: unknown, hasImages: boolean): boolean =>
  isCurrentBackendCapacityFailure(error) ||
  (hasImages && error instanceof AgentRequestError && error.code === "vision_unsupported");

const getCatalogStatusMessage = (error: string | null): string => {
  if (!error) return "No free models are currently available for this OpenRouter key. Check its access and try refreshing the catalog.";
  const normalizedError = error.toLowerCase();
  if (normalizedError.includes("rejected the saved api key")) {
    return "OpenRouter rejected this account's API key. Update the OpenRouter key in Settings.";
  }
  return `Unable to load this account's OpenRouter free-model catalog: ${error}`;
};

const getErrorMessage = (error: unknown): string => {
  if (!error) return "Unknown error occurred";

  const message = getErrorText(error);

  if (message.includes("503") || message.includes("high demand") || message.includes("service unavailable")) {
    return "Error: This model is currently experiencing high demand. Please try again later or switch to another model.";
  }

  if (message.includes("API key")) {
    return "Error: Invalid or expired API key. Please update your API Key in settings.";
  }
  if (message.includes("permission") || message.includes("PERMISSION_DENIED")) {
    return "Error: Access denied. Check your API Key permissions.";
  }
  if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) {
    return "Error: Rate limit exceeded. Please wait or try another model.";
  }
  if (message.includes("401") || message.includes("UNAUTHENTICATED")) {
    return "Error: Authentication failed. Check your API Key.";
  }
  if (message.includes("404") || message.includes("NOT_FOUND")) {
    return "Error: Model not found. Please select another model.";
  }
  if (message.includes("413") || message.includes("too large") || message.includes("PAYLOAD_TOO_LARGE")) {
    return "Error: Content too large. Reduce file size or message length.";
  }
  if (message.includes("network") || message.includes("fetch") || message.includes("Failed to fetch")) {
    return "Error: Failed to connect to server. Check your internet connection.";
  }
  if (message.includes("CORS")) {
    return "Error: CORS security issue. Try using VPN or different browser.";
  }
  if (message.includes("timeout") || message.includes("TIMEOUT")) {
    return "Error: Request timed out. Try again with shorter message.";
  }
  if (message.includes("safety") || message.includes("blocked") || message.includes("BLOCKED")) {
    return "Error: Content blocked by AI safety policy. Try different wording.";
  }
  if (message.length > 5 && message.length < 200) {
    return `Error: ${message}`;
  }
  return "Error: An error occurred. Please try another model or wait a moment.";
};

const getErrorType = (error: unknown): string => {
  const message = getErrorText(error);
  if (message.includes("503") || message.includes("high demand") || message.includes("service unavailable")) return "SERVICE_UNAVAILABLE";
  if (message.includes("API key")) return "API_KEY";
  if (message.includes("429") || message.includes("rate limit")) return "RATE_LIMIT";
  if (message.includes("401")) return "AUTH";
  if (message.includes("404")) return "NOT_FOUND";
  if (message.includes("413")) return "PAYLOAD_TOO_LARGE";
  if (message.includes("network") || message.includes("fetch")) return "NETWORK";
  if (message.includes("CORS")) return "CORS";
  if (message.includes("timeout")) return "TIMEOUT";
  if (message.includes("safety") || message.includes("blocked")) return "SAFETY";
  return "UNKNOWN";
};

const getFullErrorText = (msg: Message): string => {
  let text = msg.content || "";
  if (msg.errorDetails) {
    text += "\n\nError Details: " + msg.errorDetails;
  }
  return text;
};

const normalizeTokenUsage = (value: unknown): Message["usage"] => {
  if (typeof value !== "object" || value === null) return undefined;
  const usage = value as Record<string, unknown>;
  const read = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const candidate = usage[key];
      if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) return candidate;
    }
    return undefined;
  };
  const normalized = {
    inputTokens: read("input_tokens", "prompt_tokens", "inputTokens", "promptTokens"),
    outputTokens: read("output_tokens", "completion_tokens", "outputTokens", "completionTokens"),
    totalTokens: read("total_tokens", "totalTokens"),
  };
  return Object.values(normalized).some((tokenCount) => tokenCount !== undefined) ? normalized : undefined;
};

const splitTextAndTables = (text: string) => {
  const parts: { type: 'text' | 'table'; content: string }[] = [];
  const tableRegex = /((?:^\|.*\|$\n?)+)/gm;
  let lastIndex = 0;
  let match;

  while ((match = tableRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    parts.push({
      type: 'table',
      content: match[1].trim()
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  return parts;
};

const splitMarkdown = (content: string) => {
  const parts: { type: 'text' | 'code' | 'table'; content: string; language?: string }[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textContent = content.substring(lastIndex, match.index);
      const tableParts = splitTextAndTables(textContent);
      parts.push(...tableParts);
    }
    parts.push({
      type: 'code',
      language: match[1] || '',
      content: match[2].trim()
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const textContent = content.substring(lastIndex);
    const tableParts = splitTextAndTables(textContent);
    parts.push(...tableParts);
  }

  return parts;
};

const AIAgent: React.FC = () => {
  const { isConfigured, hasSavedKey, provider: connectedProvider, isLoading: authLoading, routerModels: routerModelCatalog, routerModelIds: routerModels, catalogError, configurationError } = useAgentModels();
  const { aiMode } = useAudio();
  const navigate = useNavigate();

  const loadMessages = (uid: string): Message[] => {
    try {
      const saved = localStorage.getItem(getAgentMessagesStorageKey(uid));
      if (saved) {
        const parsed = JSON.parse(saved) as Array<Omit<Message, "timestamp"> & { timestamp: string | number }>;
        return parsed.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          // Proses yang dulu belum selesai saat halaman ditutup jangan tampil berputar selamanya.
          ...(msg.process ? { processLive: false, process: msg.process.map((step) => step.status === "running" ? { ...step, status: "done" as const } : step) } : {}),
        }));
      }
    } catch (e) {
      console.warn('Failed to load messages:', e);
    }
    return [];
  };

  const saveMessages = (uid: string, msgs: Message[]) => {
    const key = getAgentMessagesStorageKey(uid);
    const stripAttachments = (message: Message): Message => {
      const textOnly = { ...message };
      delete textOnly.images;
      delete textOnly.files;
      return textOnly;
    };
    try {
      localStorage.setItem(key, JSON.stringify(msgs));
      return;
    } catch {
      const recentStart = Math.max(0, msgs.length - 6);
      const compacted = msgs.map((message, index) => index < recentStart ? stripAttachments(message) : message);
      try {
        localStorage.setItem(key, JSON.stringify(compacted));
        return;
      } catch {
        const withoutAttachments = msgs.map(stripAttachments);
        try {
          localStorage.setItem(key, JSON.stringify(withoutAttachments));
          return;
        } catch {
          const recent = withoutAttachments.slice(-6);
          for (let start = 0; start < recent.length; start += 1) {
            try {
              localStorage.setItem(key, JSON.stringify(recent.slice(start)));
              return;
            } catch {
              continue;
            }
          }
          console.warn("Failed to save this account's AI history after compacting attachments");
        }
      }
    }
  };

  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const handleRouterAuthSave = async (apiKey: string) => {
    await saveOpenRouterCredentials(apiKey);
    window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
  };
  const handleRouterAuthClose = () => navigate("/dashboard", { replace: true });
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesOwnerUid, setMessagesOwnerUid] = useState<string | null>(null);
  const [preferencesOwnerUid, setPreferencesOwnerUid] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamActivity, setStreamActivity] = useState<string | null>(null);
  const [preferredModel, setPreferredModel] = useState("");
  const [modelSource, setModelSource] = useState<"cloud" | "local">("cloud");
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const effectiveAgentMode: AgentMode = "auto";
  const cloudModelOptions = routerModels.filter((model) => !isLocalAgentModel(model));
  const agentLocal = useAgentLocal();
  const localModelOptions = agentLocal.modelId ? [agentLocal.modelId] : [];
  const modelOptions = modelSource === "cloud" ? cloudModelOptions : localModelOptions;
  const selectedModel = modelOptions.includes(preferredModel) ? preferredModel : modelOptions[0] || "";
  const hasPreferredAutoModel = modelOptions.includes(preferredModel);
  const requestModelOptions = modelSource === "cloud"
    ? getAgentRequestModels(cloudModelOptions, effectiveAgentMode, selectedModel, "", hasPreferredAutoModel, routerModelCatalog)
    : [];
  const autoRecommendedModel = getAgentRequestModels(cloudModelOptions, "auto", "", input, false, routerModelCatalog)[0] || "";
  const isLocalSourceReady = modelSource === "local" && agentLocal.status === "ready" && Boolean(agentLocal.modelId);
  const canSendCurrentSource = modelSource === "cloud"
    ? canSendAgentModel(isConfigured, isLocalAgentModel(selectedModel)) && Boolean(selectedModel) && modelOptions.includes(selectedModel) && requestModelOptions.length > 0
    : isLocalSourceReady;
  // Membuka tab Local (atau F5) hanya MEMERIKSA status worker. Tidak pernah menyalakan Kaggle otomatis:
  // user harus menekan Run. Worker yang sedang boot/siap di Kaggle langsung terbaca dan dipakai lagi.
  useEffect(() => {
    if (modelSource !== "local") return;
    if (["ready", "booting", "stopping", "offline", "disconnected", "blocked"].includes(agentLocal.status)) void agentLocal.refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelSource]);
  const [isKaggleModalOpen, setIsKaggleModalOpen] = useState(false);
  const [isSavingKaggleCredentials, setIsSavingKaggleCredentials] = useState(false);
  const handleSaveKaggleCredentials = async (username: string, apiToken: string) => {
    setIsSavingKaggleCredentials(true);
    try {
      await saveKaggleCredentials(username, apiToken);
      await agentLocal.checkCredentials();
    } finally {
      setIsSavingKaggleCredentials(false);
    }
  };
  const isRouterAuthModalOpen = shouldShowRouterAuthModal({
    isLoading: authLoading,
    userUid: currentUserUid,
    isConfigured,
    configurationError,
  });
  useEffect(() => {
    if (!isModelPickerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsModelPickerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModelPickerOpen]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [cropTarget, setCropTarget] = useState<{ index: number; src: string; name?: string } | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploadDropdownOpen, setIsUploadDropdownOpen] = useState(false);
  const [, setRetryingMessageId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("User");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<string>("Unknown");
  const [uploadDropdownPos, setUploadDropdownPos] = useState<{ bottom: number; left: number; maxHeight: number }>({ bottom: 0, left: 0, maxHeight: 0 });
  const [modelPickerPos, setModelPickerPos] = useState<{ bottom: number; left: number; maxHeight: number }>({ bottom: 0, left: 0, maxHeight: 0 });
  const [textareaOverflow, setTextareaOverflow] = useState<"hidden" | "auto">("hidden");
  const [sourcesVisibility, setSourcesVisibility] = useState<Record<string, boolean>>({});
  const [pendingHostAction, setPendingHostAction] = useState<HostActionPreview | null>(null);
  const [confirmingHostAction, setConfirmingHostAction] = useState(false);
  const [hostActionError, setHostActionError] = useState("");
  const [confirmLabelChoice, setConfirmLabelChoice] = useState<"A" | "B" | "C" | "custom">("A");
  const [customConfirmLabel, setCustomConfirmLabel] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const uploadDropdownRef = useRef<HTMLDivElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const currentUserUidRef = useRef<string | null>(null);
  const requestSequenceRef = useRef(0);
  const activeRequestIdRef = useRef<number | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const processIdRef = useRef<string | null>(null);
  // AbortController untuk request cloud yang sedang streaming, supaya tombol
  // Berhenti di blok Proses bisa menghentikan cloud sama seperti lokal.
  const cloudAbortRef = useRef<AbortController | null>(null);
  // Batching update stream: banyak token per detik digabung jadi satu render
  // per frame (requestAnimationFrame) supaya teks dan bubble muncul mulus,
  // bukan berkedip tiap token. Dipakai streaming cloud dan lokal.
  const streamRafRef = useRef<number | null>(null);
  const streamPendingRef = useRef<(() => void) | null>(null);
  const scheduleStreamUpdate = (apply: () => void) => {
    streamPendingRef.current = apply;
    if (streamRafRef.current === null) {
      streamRafRef.current = requestAnimationFrame(() => {
        streamRafRef.current = null;
        const fn = streamPendingRef.current;
        streamPendingRef.current = null;
        fn?.();
      });
    }
  };
  const [processOpen, setProcessOpen] = useState<Record<string, boolean>>({});

  // Tambah / perbarui langkah pada pesan proses milik request yang sedang berjalan (dibuat saat langkah pertama datang).
  const mergeProcessSteps = (incoming: ProcessStepPatch[]) => {
    const pid = processIdRef.current;
    if (!pid || incoming.length === 0) return;
    setMessages(prev => {
      const index = prev.findIndex(m => m.id === pid);
      const merged = new Map<string, ProcessStep>((index >= 0 ? prev[index].process || [] : []).map(step => [step.id, step]));
      for (const patch of incoming) {
        const current = merged.get(patch.id) || { id: patch.id, kind: "info" as const, title: "", status: "running" as const };
        merged.set(patch.id, { ...current, ...patch });
      }
      const process = Array.from(merged.values());
      if (index >= 0) {
        const next = prev.slice();
        next[index] = { ...prev[index], process, processLive: true };
        return next;
      }
      const created: Message = { id: pid, role: "bot", content: "", model: getAgentProcessStrings(detectAgentLanguage()).process, timestamp: new Date(), process, processLive: true };
      const streamIndex = prev.findIndex(m => m.id === STREAM_MESSAGE_ID);
      if (streamIndex >= 0) return [...prev.slice(0, streamIndex), created, ...prev.slice(streamIndex)];
      return [...prev, created];
    });
  };

  // Request selesai: hentikan animasi, rapikan langkah yang masih "running", pangkas output agar riwayat tetap kecil.
  const finishProcess = (outcome: "done" | "error") => {
    const pid = processIdRef.current;
    processIdRef.current = null;
    if (!pid) return;
    setMessages(prev => prev.flatMap(m => {
      if (m.id !== pid) return [m];
      const steps = (m.process || [])
        .slice(-PROCESS_STEPS_KEEP)
        .map(step => ({
          ...step,
          status: step.status === "running" ? outcome : step.status,
          output: step.output && step.output.length > PROCESS_OUTPUT_KEEP ? `${step.output.slice(0, PROCESS_OUTPUT_KEEP)}…` : step.output,
        }));
      return steps.length ? [{ ...m, process: steps, processLive: false }] : [];
    }));
  };

  useEffect(() => {
    if (!currentUserUid) {
      setMessagesOwnerUid(null);
      setMessages([]);
      setPreferredModel("");
      setModelSource("cloud");
      setPreferencesOwnerUid(null);
      return;
    }
    const uid = currentUserUid;
    setMessagesOwnerUid(null);
    setPreferencesOwnerUid(null);
    setMessages(loadMessages(uid));
    let savedPreferences = parseAgentModeSettings(null);
    try {
      savedPreferences = parseAgentModeSettings(localStorage.getItem(getAgentPreferencesStorageKey(uid)));
    } catch (error) {
      console.warn("Failed to load this account's AI preferences:", error);
    }
    setModelSource("cloud");
    setPreferredModel(savedPreferences.model);
    setMessagesOwnerUid(uid);
    setPreferencesOwnerUid(uid);
  }, [currentUserUid]);

  useEffect(() => {
    if (currentUserUid && messagesOwnerUid === currentUserUid) saveMessages(currentUserUid, messages);
  }, [currentUserUid, messagesOwnerUid, messages]);

  useEffect(() => {
    if (currentUserUid && preferencesOwnerUid === currentUserUid) {
      try {
        localStorage.setItem(getAgentPreferencesStorageKey(currentUserUid), JSON.stringify({ mode: "auto", model: preferredModel }));
      } catch (error) {
        console.warn("Failed to save this account's AI preferences:", error);
      }
    }
  }, [currentUserUid, preferencesOwnerUid, preferredModel]);

  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    const initAuth = async () => {
      try {
        const auth = await getAuth();
        if (disposed) return;
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          const nextUid = user?.uid || null;
          currentUserUidRef.current = nextUid;
          activeRequestIdRef.current = null;
          setIsLoading(false);
          setRetryingMessageId(null);
          setStreamActivity(null);
          setCurrentUserUid(nextUid);
          setMessagesOwnerUid(null);
          setMessages([]);
          setPreferencesOwnerUid(null);
          setPreferredModel("");
          setModelSource("cloud");
          setUploadedImages([]);
          setUploadedFiles([]);
          setUploadNotice(null);
      setPendingHostAction(null);
      setConfirmingHostAction(false);
      setHostActionError("");
      setConfirmLabelChoice("A");
      setCustomConfirmLabel("");
          if (!user) {
            setUserDisplayName("User");
            setUserAvatar(null);
            setUserLocation("Unknown");
            return;
          }
          if (user) {
            const db = await getDb();
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (disposed || auth.currentUser?.uid !== user.uid) return;
            if (userSnap.exists()) {
              const data = userSnap.data();
              setUserDisplayName(data.displayName || user.displayName || user.email?.split('@')[0] || "User");
              setUserAvatar(data.photoURL || user.photoURL || null);
              if (data.lastLocation) setUserLocation(`${data.lastLocation.city}, ${data.lastLocation.country}`);
            } else {
              setUserDisplayName(user.displayName || user.email?.split('@')[0] || "User");
              setUserAvatar(user.photoURL || null);
            }
          }
        });
      } catch (error) {
        console.error("Failed to initialize auth in AIAgent:", error);
      }
    };

    initAuth();
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = newHeight + "px";
      if (textareaRef.current.scrollHeight > 120) {
        setTextareaOverflow("auto");
      } else {
        setTextareaOverflow("hidden");
      }
    }
  }, [input]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
  useEffect(() => { speechSynthRef.current = window.speechSynthesis; return () => speechSynthRef.current?.cancel(); }, []);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uploadDropdownRef.current && !uploadDropdownRef.current.contains(event.target as Node)) setIsUploadDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(event.target as Node)) setIsModelPickerOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const speakText = (text: string, messageId: string) => {
    if (!speechSynthRef.current) return;
    if (isSpeaking && currentSpeakingId === messageId) { speechSynthRef.current.cancel(); setIsSpeaking(false); setCurrentSpeakingId(null); return; }
    if (isSpeaking) speechSynthRef.current.cancel();
    // The narrator follows the language of the text: Indonesian output gets an Indonesian voice and accent,
    // English output gets an English one. Detect on the text without code so code never skews the result.
    const lang = detectLanguage(stripMarkdownForSpeech(text, ""));
    const cleanText = stripMarkdownForSpeech(text, lang === "id" ? "blok kode" : "code block");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const targetLang = lang === "id" ? "id-ID" : "en-US";
    utterance.lang = targetLang;
    const voices = speechSynthRef.current.getVoices();
    if (voices.length > 0) {
      const prefix = lang === "id" ? "id" : "en";
      const normalize = (value: string) => value.replace("_", "-").toLowerCase();
      const matchingVoice = voices.find(v => normalize(v.lang) === targetLang.toLowerCase())
        ?? voices.find(v => normalize(v.lang).startsWith(prefix));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }
    }
    utterance.rate = 0.9;
    utterance.onstart = () => { setIsSpeaking(true); setCurrentSpeakingId(messageId); };
    utterance.onend = () => { setIsSpeaking(false); setCurrentSpeakingId(null); };
    utterance.onerror = () => { setIsSpeaking(false); setCurrentSpeakingId(null); };
    speechSynthRef.current.speak(utterance);
  };

  const localSandboxReady = modelSource === "local" && agentLocal.status === "ready";

  const adoptAgentFile = async (file: File, name = file.name): Promise<UploadedFile> => {
    const stage = shouldStageFileOnKaggle(file, name);
    if (stage && file.size > 20 * 1024 * 1024) throw new Error(`${name} melebihi batas 20 MB`);
    if (stage && localSandboxReady) {
      return { name, content: "", type: file.type || "application/octet-stream", blob: file, stageOnKaggle: true };
    }
    try {
      const parsed = await parseAgentFile(file, name);
      return stage ? { ...parsed, blob: file, stageOnKaggle: true } : parsed;
    } catch (error) {
      if (!stage) throw error;
      setUploadNotice(`${name} tidak bisa dibaca di browser. Start AI Local, then send — the file will be processed on Kaggle.`);
      return { name, content: "", type: file.type || "application/octet-stream", blob: file, stageOnKaggle: true };
    }
  };

  const stageLocalAttachments = async (files: UploadedFile[], images: UploadedImage[]) => {
    if (!(modelSource === "local" && agentLocal.status === "ready")) {
      const blocked = files.filter((file) => file.stageOnKaggle && !file.content.trim() && !file.kagglePath);
      if (blocked.length) {
        throw new Error(`These files need AI Local to be ready: ${blocked.map((file) => file.name).join(", ")}`);
      }
      return { files, images };
    }
    const nextFiles: UploadedFile[] = [];
    for (const file of files) {
      if (file.stageOnKaggle && file.blob) {
        const path = await agentLocal.uploadLocalFile(file.blob, file.name);
        nextFiles.push({
          name: file.name,
          type: file.type,
          kagglePath: path,
          content: `Path di Kaggle: ${path}\nFile asli ada di disk worker. Gunakan tool read_document pada path ini.`,
        });
      } else {
        nextFiles.push(file);
      }
    }
    const nextImages: UploadedImage[] = [];
    for (const image of images) {
      if (!image.blob) {
        nextImages.push(image);
        continue;
      }
      const path = await agentLocal.uploadLocalFile(image.blob, image.name || image.blob.name || "image");
      nextImages.push({ ...image, blob: undefined, kagglePath: path });
    }
    return { files: nextFiles, images: nextImages };
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const uploadOwnerUid = currentUserUidRef.current;
    if (!uploadOwnerUid) return;

    const selectedImages = Array.from(files).filter((file) => file.type.startsWith("image/"));
    setUploadNotice(null);

    const processedImages: UploadedImage[] = [];
    for (const file of selectedImages) {
      try {
        const processedImage = await prepareUploadedImage(file);
        processedImage.name = file.name;
        processedImage.blob = file;
        if (currentUserUidRef.current !== uploadOwnerUid) return;
        processedImages.push(processedImage);
      } catch (error) {
        if (currentUserUidRef.current !== uploadOwnerUid) return;
        setUploadNotice(getErrorText(error) || `Unable to process ${file.name}`);
      }
    }
    if (currentUserUidRef.current !== uploadOwnerUid) return;
    if (processedImages.length) setUploadedImages((previous) => [...previous, ...processedImages]);
    setIsUploadDropdownOpen(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleMultiFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const uploadOwnerUid = currentUserUidRef.current;
    if (!uploadOwnerUid) return;
    const newFiles: UploadedFile[] = [];
    const newImages: UploadedImage[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        try {
          const processedImage = await prepareUploadedImage(file);
          processedImage.name = file.name;
          processedImage.blob = file;
          newImages.push(processedImage);
        } catch (error) {
          setUploadNotice(getErrorText(error) || `Unable to process ${file.name}`);
        }
        if (currentUserUidRef.current !== uploadOwnerUid) return;
        continue;
      }
      try {
        newFiles.push(await adoptAgentFile(file, file.name));
      } catch (error) {
        setUploadNotice(getErrorText(error) || `Unable to read ${file.name}`);
      }
      if (currentUserUidRef.current !== uploadOwnerUid) return;
    }
    if (currentUserUidRef.current !== uploadOwnerUid) return;
    if (newFiles.length) { setUploadedFiles(prev => [...prev, ...newFiles]); }
    if (newImages.length) setUploadedImages((previous) => [...previous, ...newImages]);
    if (multiFileInputRef.current) multiFileInputRef.current.value = "";
    setIsUploadDropdownOpen(false);
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const uploadOwnerUid = currentUserUidRef.current;
    if (!uploadOwnerUid) return;
    const newFiles: UploadedFile[] = [];
    const newImages: UploadedImage[] = [];
    const ignoredDirectories = new Set([".git", ".next", ".firebase", "__pycache__", "build", "dist", "node_modules", "venv", ".venv"]);
    const ignoredFiles = new Set([".ds_store", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
    let skippedCount = 0;
    let readError = "";
    for (const file of Array.from(files)) {
      const name = file.webkitRelativePath || file.name;
      const pathParts = name.split("/").map((part) => part.toLowerCase());
      if (pathParts.some((part) => ignoredDirectories.has(part)) || ignoredFiles.has(file.name.toLowerCase())) {
        skippedCount += 1;
        continue;
      }
      if (file.type.startsWith("image/")) {
        try {
          const processedImage = await prepareUploadedImage(file);
          processedImage.name = name;
          processedImage.blob = file;
          newImages.push(processedImage);
        } catch (error) {
          skippedCount += 1;
          if (!readError) readError = getErrorText(error) || `Unable to process ${name}`;
        }
        if (currentUserUidRef.current !== uploadOwnerUid) return;
        continue;
      }
      try {
        newFiles.push(await adoptAgentFile(file, name));
        if (currentUserUidRef.current !== uploadOwnerUid) return;
      } catch (error) {
        skippedCount += 1;
        if (!readError) readError = getErrorText(error) || `Unable to read ${name}`;
      }
      if (currentUserUidRef.current !== uploadOwnerUid) return;
    }
    if (currentUserUidRef.current !== uploadOwnerUid) return;
    if (newFiles.length) { setUploadedFiles(prev => [...prev, ...newFiles]); }
    if (newImages.length) setUploadedImages((previous) => [...previous, ...newImages]);
    const readCount = newFiles.length + newImages.length;
    setUploadNotice(`${readCount} read, ${skippedCount} skipped${readError ? `. ${readError}` : ""}`);
    if (folderInputRef.current) folderInputRef.current.value = "";
    setIsUploadDropdownOpen(false);
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
    setUploadNotice(null);
  };
  // Hasil crop 1:1 menggantikan gambar yang di-staging (file asli tidak diubah).
  const handleCropDone = (result: CroppedImage) => {
    if (!cropTarget) return;
    const { index, name } = cropTarget;
    const fileName = name || "cropped.jpg";
    setUploadedImages((prev) => prev.map((img, i) => i === index
      ? { data: result.dataUrl.split(",", 2)[1] || "", mimeType: "image/jpeg", preview: result.dataUrl, name: fileName, blob: new File([result.blob], fileName, { type: "image/jpeg" }) }
      : img));
    setCropTarget(null);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllUploads = () => {
    setUploadedImages([]);
    setUploadedFiles([]);
    setUploadNotice(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (multiFileInputRef.current) multiFileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const buildContextFromFiles = (files: UploadedFile[]): string => {
    return formatAgentFileContext(files);
  };

  const callAI = async (
    messageText: string,
    images: UploadedImage[],
    files: UploadedFile[],
    modelIndex: number,
    currentMessages: Message[],
    isRetry: boolean,
    originalUserMessage: string | undefined,
    modelSequence: string[],
    requestOwnerUid: string,
    requestId: number,
  ): Promise<{ text: string; model: string; requestedModel: string; usage?: Message["usage"]; sources?: { title: string; url: string }[]; searchImages?: string[]; pendingHostAction?: HostActionPreview; attachments?: Message["attachments"] }> => {
    const modelName = modelSequence[modelIndex];
    if (!modelName) throw new Error("Model not found");
    const originallyRequestedModel = modelSequence[0] || modelName;
    const cloudStrings = getAgentProcessStrings(detectAgentLanguage());
    const controller = new AbortController();
    cloudAbortRef.current = controller;
    const cancelledResult = (text: string) => ({
      text,
      model: modelName,
      requestedModel: originallyRequestedModel,
      usage: undefined,
      sources: [] as { title: string; url: string }[],
      searchImages: [] as string[],
    });
    const isAbortError = (err: unknown) => err instanceof DOMException && err.name === "AbortError";
    const priorMessages = currentMessages.filter(m => !m.error && !m.process && !(isRetry && m.role === "user" && m.content === originalUserMessage));
    const history = buildModelScopedHistory(priorMessages, modelName);
    const textContext = messageText + buildContextFromFiles(files);
    const firebaseAuth = await getAuth();
    const user = firebaseAuth.currentUser;
    if (!user || user.uid !== requestOwnerUid || currentUserUidRef.current !== requestOwnerUid || activeRequestIdRef.current !== requestId) {
      throw new Error("The signed-in account changed before this AI request could continue");
    }
    const idToken = await user.getIdToken(true);
    if (firebaseAuth.currentUser?.uid !== requestOwnerUid || currentUserUidRef.current !== requestOwnerUid || activeRequestIdRef.current !== requestId) {
      throw new Error("The signed-in account changed before this AI request could continue");
    }
    const prompt = textContext || (images.length ? "Describe these images" : "");
    const route = resolveAgentModelRoute(modelName, AI_AGENT_API_BASE);
    let response: Response;
    try {
      response = await fetch(`${route.apiBase}/agent/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        signal: controller.signal,
        body: JSON.stringify({
          provider: connectedProvider || "",
          model: route.model,
          prompt,
          web_search: false,
          search_query: "",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta",
          context: detectUserContext(),
          history,
          images: images.map((image) => ({ mime_type: image.mimeType, data: image.data })),
        }),
      });
    } catch (err) {
      if (isAbortError(err)) return cancelledResult(cloudStrings.cancelled);
      throw err;
    }
    if (response.status === 404 || response.status === 503) {
      // 404: backend lama belum punya /agent/chat/stream.
      // 503: AGENT_RUNTIME_URL/Kaggle belum/tidak tersambung -> tetap jalan sebagai chat biasa (tanpa tool agent) lewat /agent/chat.
      let fallback: Response;
      try {
        fallback = await fetch(`${route.apiBase}/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
          body: JSON.stringify({
            provider: connectedProvider || "",
            model: route.model,
            prompt,
            web_search: false,
            search_query: "",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta",
            context: detectUserContext(),
            history,
            images: images.map((image) => ({ mime_type: image.mimeType, data: image.data })),
          }),
        });
      } catch (err) {
        if (isAbortError(err)) return cancelledResult(cloudStrings.cancelled);
        throw err;
      }
      const fallbackData = await fallback.json().catch(() => null);
      if (!fallback.ok) throw parseAgentErrorPayload(fallbackData, fallback.status);
      const result = (fallbackData?.data?.result ?? {}) as Record<string, unknown>;
      const text = typeof result.content === "string" ? cleanMarkdown(result.content) : "";
      if (!text.trim()) throw new Error("AI Agent returned an empty response");
      if (currentUserUidRef.current !== requestOwnerUid || activeRequestIdRef.current !== requestId) {
        throw new Error("The signed-in account changed while this AI request was running");
      }
      return {
        text,
        model: typeof result.model === "string" && result.model ? result.model : modelName,
        requestedModel: originallyRequestedModel,
        usage: normalizeTokenUsage(result.usage),
        sources: normalizeAgentSources(result.sources),
        searchImages: [],
      };
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw parseAgentErrorPayload(data, response.status);
    }
    if (!response.body) throw new Error("Streaming is not supported by this browser");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let final: AgentStreamFinal = { text: "", model: modelName, requestedModel: originallyRequestedModel };
    let toolStepCounter = 0;
    let sawToolActivity = false;
    const openToolSteps: { name: string; id: string }[] = [];
    const appendToken = (delta: string) => {
      if (!delta) return;
      final.text += delta;
      if (currentUserUidRef.current !== requestOwnerUid || activeRequestIdRef.current !== requestId) return;
      scheduleStreamUpdate(() => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.id === STREAM_MESSAGE_ID && last.role === "bot") {
            const updated = { ...last, content: cleanMarkdown(final.text) };
            return [...prev.slice(0, -1), updated];
          }
          return [...prev, {
            id: STREAM_MESSAGE_ID,
            role: "bot",
            content: cleanMarkdown(final.text),
            model: final.model || modelName,
            requestedModel: originallyRequestedModel,
            timestamp: new Date(),
          }];
        });
      });
    };
    const readChunk = async (): Promise<ReadableStreamReadResult<Uint8Array> | null> => {
      try {
        return await reader.read();
      } catch (err) {
        if (isAbortError(err)) return null;
        throw err;
      }
    };
    while (true) {
      const chunk = await readChunk();
      if (!chunk) return cancelledResult(final.text.trim() ? final.text : cloudStrings.cancelled);
      const { done, value } = chunk;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (currentUserUidRef.current !== requestOwnerUid || activeRequestIdRef.current !== requestId) {
          throw new Error("The signed-in account changed while this AI request was running");
        }
        if (event.type === "token" && typeof event.delta === "string") {
          appendToken(event.delta);
        } else if (event.type === "tool_call" && typeof event.name === "string") {
          const toolTitle = describeAgentTool(event.name, detectAgentLanguage()) ?? `${cloudStrings.usingTool}: ${event.name}`;
          sawToolActivity = true;
          setStreamActivity(toolTitle);
          const toolStepId = `t${++toolStepCounter}`;
          openToolSteps.push({ name: event.name, id: toolStepId });
          mergeProcessSteps([{ id: toolStepId, kind: "tool", tool: event.name, title: toolTitle, status: "running" }]);
        } else if (event.type === "tool_result" && typeof event.name === "string") {
          const toolLabel = describeAgentTool(event.name, detectAgentLanguage()) ?? `Tool ${event.name}`;
          setStreamActivity(`${toolLabel} ${cloudStrings.toolDone}`);
          const openIndex = openToolSteps.findIndex(item => item.name === event.name);
          if (openIndex >= 0) {
            const [finished] = openToolSteps.splice(openIndex, 1);
            mergeProcessSteps([{ id: finished.id, status: "done" }]);
          }
        } else if (event.type === "status" && typeof event.status === "string") {
          setStreamActivity(event.status === "thinking" ? cloudStrings.working : event.status);
        } else if (event.type === "final" && typeof event.result === "object" && event.result !== null) {
          const result = event.result as Record<string, unknown>;
          const pending = result.confirmation_required as HostActionPreview | undefined;
          const attachments = Array.isArray(result.attachments)
            ? (result.attachments as AgentStreamFinal["attachments"])
            : undefined;
          final = {
            ...final,
            text: typeof result.content === "string" && result.content.trim() ? cleanMarkdown(result.content) : final.text,
            model: typeof result.model === "string" && result.model ? result.model : final.model,
            usage: normalizeTokenUsage(result.usage),
            sources: normalizeAgentSources(result.sources),
            attachments,
            pendingHostAction: pending && pending.confirmationRequired === true && typeof pending.actionId === "string" && pending.action ? pending : undefined,
          };
          if (final.usage?.totalTokens !== undefined && sawToolActivity) {
            const formatted = final.usage.totalTokens.toLocaleString(detectAgentLanguage() === "id" ? "id-ID" : "en-US");
            mergeProcessSteps([{ id: "tokens", kind: "info", title: `${cloudStrings.tokensUsed}: ${formatted}`, status: "done" }]);
          }
        } else if (event.type === "error") {
          const detail = typeof event.message === "string" ? event.message : `AI Agent request failed: ${event.status ?? ""}`;
          throw new AgentRequestError(detail, typeof event.status === "number" ? event.status : 502, typeof event.code === "string" ? event.code : undefined);
        }
      }
    }
    if (currentUserUidRef.current !== requestOwnerUid || activeRequestIdRef.current !== requestId) {
      throw new Error("The signed-in account changed while this AI request was running");
    }
    if (final.pendingHostAction) {
      return { text: "", model: final.model || modelName, requestedModel: originallyRequestedModel, usage: final.usage, sources: final.sources, searchImages: [], pendingHostAction: final.pendingHostAction };
    }
    if (!final.text.trim()) throw new Error("AI Agent returned an empty response");
    return { text: final.text, model: final.model || modelName, requestedModel: originallyRequestedModel, usage: final.usage, sources: final.sources, searchImages: [], attachments: final.attachments };
  };

  const callLocalAI = async (
    messageText: string,
    images: UploadedImage[],
    files: UploadedFile[],
    requestOwnerUid: string,
    requestId: number,
    history: Array<{ role: string; content: string }> = [],
  ): Promise<{ text: string; model: string; requestedModel: string; usage?: Message["usage"]; sources?: { title: string; url: string }[]; searchImages?: string[]; pendingHostAction?: HostActionPreview; attachments?: Message["attachments"] }> => {
    const imagePaths = images.filter((image) => image.kagglePath).map((image) => `- ${image.kagglePath} (${image.name || "image"})`);
    const imageNote = imagePaths.length
      ? `\n\nGambar juga disimpan di disk Kaggle. Untuk OCR gunakan read_document. Untuk melihat gambar gunakan inspect_image.\n${imagePaths.join("\n")}\n`
      : "";
    const textContext = messageText + imageNote + buildContextFromFiles(files);
    const prompt = textContext || (images.length ? "Describe these images" : "");
    const visionImages = images.filter((image) => image.data.length > 0 && image.data.length <= 9_000_000);
    setStreamActivity("Memahami permintaan…");
    // Pesan proses langsung muncul, lalu diisi langkah asli dari worker (berpikir / tool) lewat polling.
    mergeProcessSteps([{ id: "c0", kind: "thinking", title: getAgentProcessStrings(detectAgentLanguage()).understanding, status: "running" }]);
    let sinceSeq = 0;
    let syncing = false;
    // Sapaan pembuka dari worker: tampil sekali sebagai pesan chat, sebelum blok Proses.
    let openingShown = false;
    const showOpening = (opening: string) => {
      if (openingShown) return;
      openingShown = true;
      const openingMessage: Message = { id: `opening-${requestId}`, role: "bot", content: cleanMarkdown(opening), model: agentLocal.modelId || "ai-local", timestamp: new Date() };
      setMessages(prev => {
        if (prev.some(m => m.id === openingMessage.id)) return prev;
        const pid = processIdRef.current;
        const anchorIndex = pid ? prev.findIndex(m => m.id === pid) : prev.findIndex(m => m.id === STREAM_MESSAGE_ID);
        if (anchorIndex >= 0) return [...prev.slice(0, anchorIndex), openingMessage, ...prev.slice(anchorIndex)];
        return [...prev, openingMessage];
      });
    };
    const syncProcess = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const data = await agentLocal.pollProcess(sinceSeq);
        if (!data) return;
        sinceSeq = data.seq;
        if (data.activity) setStreamActivity(data.activity);
        if (data.opening) showOpening(data.opening);
        if (data.steps.length > 0) mergeProcessSteps([{ id: "c0", status: "done" }, ...data.steps]);
      } finally {
        syncing = false;
      }
    };
    const activityTimer = window.setInterval(() => { void syncProcess(); }, 1000);
    let content: string;
    let localAttachments: Message["attachments"] = undefined;
    // Teks jawaban mengalir live (SSE): segmen baru (sapaan -> jawaban akhir)
    // mengganti isi bubble streaming; event final menggantinya dengan jawaban lengkap.
    let streamText = "";
    let streamSegment = -1;
    const applyStreamText = () => {
      const text = cleanMarkdown(streamText);
      scheduleStreamUpdate(() => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.id === STREAM_MESSAGE_ID && last.role === "bot") {
            return [...prev.slice(0, -1), { ...last, content: text }];
          }
          return [...prev, {
            id: STREAM_MESSAGE_ID,
            role: "bot",
            content: text,
            model: agentLocal.modelId || "ai-local",
            requestedModel: agentLocal.modelId || "ai-local",
            timestamp: new Date(),
          }];
        });
      });
    };
    try {
      const result = await agentLocal.sendLocalChatStream(
        prompt,
        visionImages.map((image) => ({ mimeType: image.mimeType, data: image.data })),
        (delta, segment) => {
          if (segment !== streamSegment) { streamSegment = segment; streamText = ""; }
          streamText += delta;
          applyStreamText();
        },
        history,
      );
      content = result.content;
      localAttachments = result.attachments && result.attachments.length > 0 ? result.attachments : undefined;
    } finally {
      window.clearInterval(activityTimer);
      syncing = false;
      await syncProcess().catch(() => undefined);
    }
    if (currentUserUidRef.current !== requestOwnerUid || activeRequestIdRef.current !== requestId) {
      throw new Error("The signed-in account changed while this AI request was running");
    }
    const text = cleanMarkdown(content);
    if (!text) throw new Error("AI Local returned an empty response");
    return { text, model: agentLocal.modelId || "ai-local", requestedModel: agentLocal.modelId || "ai-local", attachments: localAttachments };
  };


  const sendMessage = async (messageText: string, images: UploadedImage[], files: UploadedFile[], retryModelIndex = 0, isRetry = false, modelSequence: string[] = requestModelOptions, requestOwnerUid: string | null = currentUserUid, suppliedRequestId?: number) => {
    if (!requestOwnerUid || currentUserUidRef.current !== requestOwnerUid || messagesOwnerUid !== requestOwnerUid) return;
    const requestId = suppliedRequestId ?? ++requestSequenceRef.current;
    activeRequestIdRef.current = requestId;
    const isCurrentRequest = () => currentUserUidRef.current === requestOwnerUid && activeRequestIdRef.current === requestId && messagesOwnerUid === requestOwnerUid;
    setIsLoading(true);
    processIdRef.current = `process-${requestId}`;

    if (!isRetry) {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: messageText || (images.length ? `[${images.length} image(s)]` : files.length ? `[${files.length} file(s)]` : ""),
        timestamp: new Date(),
        images: images.map(img => ({ data: img.data, mimeType: img.mimeType })),
        files: files.map(f => ({ name: f.name, content: f.content }))
      };
      setMessages(prev => [...prev, userMsg]);
    }


    try {
      // Riwayat bersama (cloud + lokal) — sumber kebenaran yang sama dengan
      // yang dipakai cloud, supaya worker lokal paham pembahasan di luar gilirannya.
      const sharedHistory = buildModelScopedHistory(messagesRef.current.filter(m => !m.error && !m.process && !(isRetry && m.role === "user" && m.content === messageText)), selectedModel);
      const response = modelSource === "local"
        ? await callLocalAI(messageText, images, files, requestOwnerUid, requestId, sharedHistory)
        : await callAI(messageText, images, files, retryModelIndex, messagesRef.current, isRetry, messageText, modelSequence, requestOwnerUid, requestId);
      if (!isCurrentRequest()) return;
      if (response.pendingHostAction) {
        setPendingHostAction(response.pendingHostAction);
        setHostActionError("");
        setConfirmLabelChoice("A");
        setCustomConfirmLabel("");
        setMessages(prev => prev.filter(m => m.id !== STREAM_MESSAGE_ID));
        return;
      }
      const finalizeMessage = (msg: Message): Message => ({ ...msg, content: response.text, model: response.model, requestedModel: response.requestedModel, usage: response.usage, sources: response.sources && response.sources.length > 0 ? response.sources : undefined, attachments: response.attachments && response.attachments.length > 0 ? response.attachments : undefined });
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.id === STREAM_MESSAGE_ID && last.role === "bot") {
          return [...prev.slice(0, -1), finalizeMessage({ ...last, id: (Date.now() + 1).toString() })];
        }
        return [...prev, finalizeMessage({
          id: (Date.now() + 1).toString(),
          role: "bot",
          content: response.text,
          model: response.model,
          requestedModel: response.requestedModel,
          usage: response.usage,
          timestamp: new Date(),
        })];
      });
      setStreamActivity(null);

      if (aiMode === 'auto') {
        speakText(response.text, (Date.now() + 1).toString());
      }
    } catch (error: unknown) {
      if (!isCurrentRequest()) return;
      const errorType = getErrorType(error);
      const friendlyError = getErrorMessage(error);
      const errorMessage = getErrorText(error);
      const errorObject = error instanceof Error ? error : new Error(errorMessage);
      const isRetryableFailure = isRetryableAgentFailure(error, images.length > 0);

      const attemptedModel = modelSequence[retryModelIndex] || selectedModel;
      if (shouldRetryWithNextAgentModel(attemptedModel, isRetryableFailure, retryModelIndex, modelSequence.length)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!isCurrentRequest()) return;
        await sendMessage(messageText, images, files, retryModelIndex + 1, true, modelSequence, requestOwnerUid, requestId);
        return;
      }

      finishProcess("error");
      setMessages(prev => prev.filter(m => !(m.id === STREAM_MESSAGE_ID && !m.content.trim())) );
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: friendlyError,
        model: "Error",
        requestedModel: modelSequence[0] || attemptedModel,
        timestamp: new Date(),
        error: true,
        errorDetails: errorObject.message
      }]);

      console.error("API Error Details:", {
        type: errorType,
        message: errorObject.message,
        stack: errorObject.stack,
        model: attemptedModel,
        retryCount: retryModelIndex
      });
    } finally {
      if (activeRequestIdRef.current === requestId) {
        cloudAbortRef.current = null;
        finishProcess("done");
        activeRequestIdRef.current = null;
        setIsLoading(false);
        setRetryingMessageId(null);
        setStreamActivity(null);
      }
    }
  };

  const handleSendMessage = async () => {
    const requestOwnerUid = currentUserUidRef.current;
    if (!requestOwnerUid || requestOwnerUid !== currentUserUid || messagesOwnerUid !== requestOwnerUid || pendingHostAction || (!input.trim() && !uploadedImages.length && !uploadedFiles.length) || isLoading || !canSendCurrentSource) return;
    const currentInput = input, currentImages = [...uploadedImages], currentFiles = [...uploadedFiles];
    let filesToSend = currentFiles;
    let imagesToSend = currentImages;
    if (modelSource === "local" || currentFiles.some((file) => file.stageOnKaggle && !file.content.trim())) {
      setIsLoading(true);
      setStreamActivity(modelSource === "local" && agentLocal.status === "ready" ? "Uploading to Kaggle..." : null);
      try {
        const staged = await stageLocalAttachments(currentFiles, currentImages);
        filesToSend = staged.files;
        imagesToSend = staged.images;
      } catch (error) {
        setIsLoading(false);
        setStreamActivity(null);
        setUploadNotice(getErrorText(error) || "Failed to upload the file to Kaggle");
        return;
      }
    }
    setStreamActivity(null);
    const modelSequence = modelSource === "local"
      ? [selectedModel]
      : prioritizeVisionAgentModels(
          getAgentRequestModels(routerModels, effectiveAgentMode, selectedModel, currentInput, hasPreferredAutoModel, routerModelCatalog),
          imagesToSend.length > 0,
        );
    if (!modelSequence.length) {
      setIsLoading(false);
      setStreamActivity(null);
      return;
    }
    setInput("");
    clearAllUploads();
    await sendMessage(currentInput, imagesToSend, filesToSend, 0, false, modelSequence, requestOwnerUid);
  };

  const retryMessage = async (messageId: string) => {
    const requestOwnerUid = currentUserUidRef.current;
    if (!requestOwnerUid || requestOwnerUid !== currentUserUid || messagesOwnerUid !== requestOwnerUid || isLoading || !canSendCurrentSource) return;
    const errorIndex = messages.findIndex(m => m.id === messageId);
    if (errorIndex <= 0) return;
    let userIndex = errorIndex - 1;
    while (userIndex > 0 && messages[userIndex].process) userIndex -= 1;
    const userMsg = messages[userIndex];
    if (userMsg.role !== "user") return;
    setRetryingMessageId(messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
    const recoveredImages: UploadedImage[] = userMsg.images?.map(img => ({ data: img.data, mimeType: img.mimeType, preview: `data:${img.mimeType};base64,${img.data}` })) || [];
    const recoveredFiles: UploadedFile[] = userMsg.files?.map(f => ({ name: f.name, content: f.content, type: "" })) || [];
    const modelSequence = modelSource === "local"
      ? [selectedModel]
      : prioritizeVisionAgentModels(
          getAgentRequestModels(routerModels, effectiveAgentMode, selectedModel, userMsg.content, hasPreferredAutoModel, routerModelCatalog),
          (userMsg.images?.length || 0) > 0,
        );
    await sendMessage(userMsg.content, recoveredImages, recoveredFiles, 0, true, modelSequence, requestOwnerUid);
  };

  const confirmPendingHostAction = async () => {
    const pending = pendingHostAction;
    const requestOwnerUid = currentUserUidRef.current;
    if (!pending || !requestOwnerUid || requestOwnerUid !== currentUserUid || requestOwnerUid !== messagesOwnerUid || confirmingHostAction) return;
    setConfirmingHostAction(true);
    setHostActionError("");
    try {
      const result = await confirmHostAction(pending.actionId, requestOwnerUid);
      if (currentUserUidRef.current !== requestOwnerUid) return;
      const output = typeof result.output === "string" ? result.output.trim() : "";
      const summary = result.message || (result.success ? "Host action completed." : `Host command exited with code ${result.exitCode ?? "unknown"}.`);
      const content = output ? `${summary}\n\n\`\`\`text\n${output}\n\`\`\`` : summary;
      setMessages((previous) => [...previous, {
        id: (Date.now() + 2).toString(),
        role: "bot",
        content,
        model: "Owner host action",
        timestamp: new Date(),
        error: result.success === false,
      }]);
      setPendingHostAction(null);
    } catch (error) {
      setHostActionError(getErrorText(error) || "Host action could not be confirmed");
    } finally {
      setConfirmingHostAction(false);
    }
  };

  const dismissPendingHostAction = () => {
    setPendingHostAction(null);
    setHostActionError("");
  };

  const copyMessage = (content: string) => navigator.clipboard.writeText(content);

  const clearChat = () => {
    setMessages([]);
    if (currentUserUid) {
      try {
        localStorage.removeItem(getAgentMessagesStorageKey(currentUserUid));
      } catch (error) {
        console.warn("Failed to clear this account's chat history:", error);
      }
    }
  };

  const calcDropdownPos = (
    btnRect: DOMRect,
    menuWidth: number,
    menuHeight: number
  ): { bottom: number; left: number; maxHeight: number } => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const gap = AIAGENT_POPOVER_TRIGGER_GAP;
    const bottom = vh - btnRect.top + gap;
    const maxHeight = Math.min(menuHeight, Math.max(btnRect.top - gap * 2, 140));

    let left = btnRect.right - menuWidth;
    const minLeft = 12;
    const maxLeft = vw - menuWidth - 12;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    return { bottom, left, maxHeight };
  };

  const calcDropdownPosBelow = (
    btnRect: DOMRect,
    menuWidth: number,
    menuHeight: number
  ): { top: number; left: number; maxHeight: number } => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const gap = AIAGENT_POPOVER_TRIGGER_GAP;
    const top = btnRect.bottom + gap;
    const maxHeight = Math.min(menuHeight, Math.max(vh - btnRect.bottom - gap * 2, 140));

    let left = btnRect.right - menuWidth;
    const minLeft = 12;
    const maxLeft = vw - menuWidth - 12;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    return { top, left, maxHeight };
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (date: Date) => date.toLocaleDateString([], { month: "short", day: "numeric" });
  const isToday = (date: Date) => formatDate(date) === formatDate(new Date());

  const totalUploads = uploadedImages.length + uploadedFiles.length;

  // Top bar "now playing": nama model + status sumber saat ini.
  const playerModelName = modelSource === "local"
    ? (agentLocal.modelId || selectedModel || "AI Local")
    : (selectedModel || "AI Agent");
  const playerStatusText = modelSource === "local"
    ? agentLocal.status === "ready" ? "Local · Ready"
    : agentLocal.status === "connecting" || agentLocal.status === "booting" ? "Local · Starting…"
    : agentLocal.status === "stopping" ? "Local · Stopping…"
    : "Local · Offline"
    : "Cloud · Online";
  const playerStatusTone = modelSource === "local"
    ? agentLocal.status === "ready" ? "ready"
    : agentLocal.status === "connecting" || agentLocal.status === "booting" ? "busy"
    : "off"
    : "ready";

  if (authLoading || !currentUserUid) return <Loading />;
  if (configurationError) {
    return (
      <div className="aiagent-container global-page">
        <div className="aiagent-catalog-status" role="alert">
          <p>Unable to check this account&apos;s OpenRouter key: {configurationError}</p>
          <button type="button" className="aiagent-icon-btn" onClick={() => window.location.reload()}>Retry</button>
          <RouterLink className="aiagent-settings-link" to="/dashboard">Cancel and return to Dashboard</RouterLink>
        </div>
      </div>
    );
  }
  if (isRouterAuthModalOpen) {
    return (
      <RouterAuthModal
        isOpen
        onSave={handleRouterAuthSave}
        onClose={handleRouterAuthClose}
        hasSavedKey={hasSavedKey}
      />
    );
  }

  return (
    <>
      {isConfigured && (
        <div className="aiagent-container global-page">
          <header className="aiagent-player-bar">
            <div className="aiagent-model-wrapper" ref={modelPickerRef}>
              <button
                type="button"
                className="aiagent-player-trigger"
                onClick={(event) => {
                  const triggerRect = event.currentTarget.getBoundingClientRect();
                  const isNarrowViewport = window.innerWidth <= 639;
                  const pickerWidth = isNarrowViewport
                    ? Math.min(360, window.innerWidth - 60)
                    : Math.min(380, window.innerWidth - 48);
                  const pickerHeight = Math.min(
                    isNarrowViewport ? 520 : 620,
                    Math.round(window.innerHeight * (isNarrowViewport ? 0.68 : 0.72)),
                  );
                  setModelPickerPos(calcDropdownPosBelow(
                    triggerRect,
                    pickerWidth,
                    pickerHeight,
                  ));
                  setIsModelPickerOpen((open) => !open);
                }}
                title="Choose AI model"
                aria-label="Choose AI model"
                aria-haspopup="dialog"
                aria-expanded={isModelPickerOpen}
                aria-controls="aiagent-model-picker"
              >
                <span className="aiagent-player-avatar">
                  {modelSource === "local" ? <Bot size={20} aria-hidden="true" /> : <Sparkles size={20} aria-hidden="true" />}
                  <span className={`aiagent-player-dot aiagent-player-dot--${playerStatusTone}`} />
                </span>
                <span className="aiagent-player-meta">
                  <span className="aiagent-player-name">{playerModelName}</span>
                  <span className="aiagent-player-sub">{playerStatusText}</span>
                </span>
                <ChevronDown size={16} aria-hidden="true" className="aiagent-player-chevron" />
              </button>
              <AnimatePresence>
                {isModelPickerOpen && (
                  <AIAgentPopover
                    id="aiagent-model-picker"
                    className="aiagent-popover aiagent-model-picker-popover global-popover"
                    position={modelPickerPos}
                    role="dialog"
                    ariaModal={false}
                    ariaLabelledBy="aiagent-model-picker-title"
                  >
                    <div className="aiagent-model-picker-header">
                      <div className="aiagent-model-picker-icon"><Bot size={19} /></div>
                      <div className="aiagent-model-picker-heading aiagent-popover">
                        <h3 id="aiagent-model-picker-title">AI Agent</h3>
                        <p>Cloud uses this account&apos;s free-model catalog. Local runs on your own Kaggle GPU.</p>
                      </div>
                    </div>
                    <div className="aiagent-model-source-options" role="group" aria-label="AI model source">
                      <button
                        type="button"
                        className={`aiagent-model-source-option aiagent-popover${modelSource === "cloud" ? " selected" : ""}`}
                        aria-pressed={modelSource === "cloud"}
                        onClick={() => setModelSource("cloud")}
                      >Cloud</button>
                      <button
                        type="button"
                        className={`aiagent-model-source-option aiagent-popover${modelSource === "local" ? " selected" : ""}`}
                        aria-pressed={modelSource === "local"}
                        onClick={() => setModelSource("local")}
                      >Local</button>
                    </div>
                    <div className="aiagent-model-option-list" role="list" aria-label={modelSource === "cloud" ? "Cloud models available to this account" : "AI Local status"}>
                      {modelSource === "cloud" ? modelOptions.length ? modelOptions.map((model) => {
                        const isSelected = hasPreferredAutoModel ? model === selectedModel : model === autoRecommendedModel;
                        return (
                          <button
                            type="button"
                            key={model}
                            className={`aiagent-model-option${isSelected ? " selected" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() => {
                              setPreferredModel(model);
                              setIsModelPickerOpen(false);
                            }}
                          >
                            <span className="aiagent-model-option-copy aiagent-popover">
                              <strong>{model}</strong>
                              <small>Free cloud model</small>
                            </span>
                            {isSelected && <Check size={17} aria-hidden="true" />}
                          </button>
                        );
                      }) : (
                        <p className="aiagent-model-empty aiagent-popover" role="status">
                          No free Cloud models are available in this account&apos;s catalog.
                        </p>
                      ) : (
                        <div className="aiagent-local-status aiagent-popover" role="status" aria-live="polite">
                          {agentLocal.status === "checking-credentials" && <p>Checking your Kaggle account…</p>}
                          {agentLocal.status === "needs-credentials" && (
                            <>
                              <p>Connect your Kaggle account first to run the local model on Kaggle&apos;s free GPU.</p>
                              <button type="button" className="aiagent-model-option aiagent-local-connect-btn" onClick={() => setIsKaggleModalOpen(true)}>
                                Connect Kaggle
                              </button>
                            </>
                          )}
                          {agentLocal.status === "blocked" && (
                            <>
                              <p className="aiagent-local-error">{agentLocal.error || "AI Local cannot start yet."}</p>
                              {agentLocal.checks.length > 0 && <LocalChecklist checks={agentLocal.checks} />}
                              <button type="button" className="aiagent-model-option aiagent-local-connect-btn" onClick={() => void agentLocal.refreshStatus()}>
                                Check Again
                              </button>
                              <button type="button" className="aiagent-model-option aiagent-local-connect-btn" onClick={() => setIsKaggleModalOpen(true)}>
                                Change Kaggle Account
                              </button>
                            </>
                          )}
                          {agentLocal.status === "disconnected" && (
                            <>
                              <p>
                                {agentLocal.kernelExists === false
                                  ? "No worker notebook exists on your Kaggle account yet. Run will create it automatically — the first run takes a few minutes."
                                  : "AI Local is not running. Nothing starts until you press Run."}
                              </p>
                              {agentLocal.checks.length > 0 && <LocalChecklist checks={agentLocal.checks} />}
                              <LocalRunButton label={agentLocal.kernelExists === false ? "Create & Run On Kaggle" : "Run On Kaggle"} onRun={agentLocal.run} />
                            </>
                          )}
                          {(agentLocal.status === "connecting" || agentLocal.status === "booting") && (
                            <>
                              <p>
                                {agentLocal.status === "connecting"
                                  ? "Checking Kaggle for an existing worker…"
                                  : "Starting your Kaggle GPU worker. This usually takes 1–3 minutes, longer on the first run or when Kaggle is busy."}
                              </p>
                              <LocalBootProgress steps={agentLocal.steps} connecting={agentLocal.status === "connecting"} />
                              <small>
                                Elapsed {formatElapsed(agentLocal.elapsedSeconds)}
                                {agentLocal.kaggleState ? ` · Kaggle kernel: ${agentLocal.kaggleState.replace("_", " ")}` : ""}
                              </small>
                              <small>Refreshing this page will not restart the worker.</small>
                              {agentLocal.status === "booting" && (
                                <LocalStopButton onStop={agentLocal.stop} />
                              )}
                            </>
                          )}
                          {agentLocal.status === "stopping" && (
                            <>
                              <p>Stopping the Kaggle worker and releasing the GPU…</p>
                              <small>This takes a few seconds. You can run it again afterwards.</small>
                            </>
                          )}
                          {agentLocal.status === "offline" && (
                            <>
                              <p>The Kaggle worker is not running (it was stopped, or Kaggle ended the session).</p>
                              {agentLocal.error && <small>{agentLocal.error}</small>}
                              <LocalRunButton label="Run On Kaggle" onRun={agentLocal.run} />
                            </>
                          )}
                          {agentLocal.status === "error" && (
                            <>
                              <p className="aiagent-local-error">{agentLocal.error || "AI Local failed to connect."}</p>
                              <LocalRunButton label="Run On Kaggle" onRun={agentLocal.run} />
                              <LocalStopButton onStop={agentLocal.stop} />
                            </>
                          )}
                          {agentLocal.status === "ready" && localModelOptions.map((model) => (
                            <button
                              type="button"
                              key={model}
                              className={`aiagent-model-option${model === selectedModel ? " selected" : ""}`}
                              aria-pressed={model === selectedModel}
                              onClick={() => {
                                setPreferredModel(model);
                                setIsModelPickerOpen(false);
                              }}
                            >
                              <span className="aiagent-model-option-copy aiagent-popover">
                                <strong>{model}</strong>
                                <small>Local · Kaggle GPU</small>
                              </span>
                              {model === selectedModel && <Check size={17} aria-hidden="true" />}
                            </button>
                          ))}
                          {agentLocal.status === "ready" && (
                            <>
                              <small>
                                Stays on until you press Stop, or Kaggle ends the session.
                              </small>
                              <LocalRunButton label="Run On Kaggle" onRun={agentLocal.run} />
                              <LocalStopButton onStop={agentLocal.stop} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </AIAgentPopover>
                )}
              </AnimatePresence>
            </div>
            <button type="button" onClick={() => navigate("/dashboard")} className="aiagent-player-home" title="Back to dashboard" aria-label="Back to dashboard"><Home size={22} /></button>
            <button type="button" onClick={clearChat} className="aiagent-player-clear" title="Clear chat" aria-label="Clear chat"><Trash2 size={22} /></button>
          </header>
          {modelSource === "cloud" && !cloudModelOptions.length && (
            <div className="aiagent-catalog-status" role={catalogError ? "alert" : "status"}>
              <p>{getCatalogStatusMessage(catalogError)}</p>
              <RouterLink className="aiagent-settings-link" to="/setting">Manage this account&apos;s OpenRouter key in Settings</RouterLink>
            </div>
          )}
          <div className="aiagent-messages" ref={scrollRef}>
            {!messages.length && (
              <div className="aiagent-welcome">
                <div className="aiagent-welcome-icon"><Sparkles size={56} /></div>
                <h3>Hello, {userDisplayName}!</h3>
                <p>Ask me anything or upload files</p>
              </div>
            )}
            <AnimatePresence>
              {messages.map((msg) => msg.process ? (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="aiagent-message bot">
                  <div className="aiagent-message-content">
                    <ProcessBlock
                      steps={msg.process}
                      live={msg.processLive === true}
                      open={processOpen[msg.id] ?? (msg.processLive === true)}
                      onToggle={() => setProcessOpen(prev => ({ ...prev, [msg.id]: !(prev[msg.id] ?? (msg.processLive === true)) }))}
                      onStop={msg.processLive === true ? () => { if (cloudAbortRef.current) cloudAbortRef.current.abort(); else void agentLocal.cancelLocalChat(); } : undefined}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`aiagent-message ${msg.role === "user" ? "user" : "bot"}${msg.id === STREAM_MESSAGE_ID ? " streaming" : ""}`}>
                  {msg.role === "user" && <div className="aiagent-user-avatar">{userAvatar ? <img src={userAvatar} alt="Avatar" /> : <User size={24} />}</div>}
                  <div className="aiagent-message-content">
                    {msg.role === "user" && <div className="aiagent-username">{userDisplayName}</div>}
                    {msg.role === "bot" && (
                      <div className="aiagent-bot-header">
                        <div className="aiagent-bot-header-left">
                          <span className="aiagent-model-name">
                            {msg.model || selectedModel}
                          </span>
                          {msg.error && (
                            <button
                              onClick={() => retryMessage(msg.id)}
                              className="aiagent-retry-btn-header"
                              title="Retry from the current selection, using this account's fallback models on 429/503"
                            >
                              <RefreshCw size={12} /> Retry
                            </button>
                          )}
                        </div>
                        <div className="aiagent-bot-actions">
                          <button
                            onClick={() => {
                              const textToSpeak = msg.error ? getFullErrorText(msg) : msg.content;
                              speakText(textToSpeak, msg.id);
                            }}
                            className="aiagent-speak-btn"
                            title={msg.error ? "Audio error message" : "Audio"}
                          >
                            {isSpeaking && currentSpeakingId === msg.id ? <VolumeX size={14} /> : <Volume2 size={14} />}
                            <span>Audio</span>
                          </button>
                          <button
                            onClick={() => {
                              const textToCopy = msg.error ? getFullErrorText(msg) : msg.content;
                              copyMessage(textToCopy);
                            }}
                            className="aiagent-copy-btn"
                            title={msg.error ? "Copy error message" : "Copy"}
                          >
                            <Copy size={14} /> Copy
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.role === "bot" && ((msg.requestedModel && msg.requestedModel !== msg.model) || (!msg.error && msg.usage)) && (
                      <div className="aiagent-message-metadata">
                        {msg.requestedModel && msg.requestedModel !== msg.model && <span>{msg.error ? "Started with" : "Requested"}: {msg.requestedModel}</span>}
                        {!msg.error && msg.usage && (
                          <span>
                            Usage: {[
                              msg.usage.inputTokens !== undefined ? `${msg.usage.inputTokens.toLocaleString()} input` : "",
                              msg.usage.outputTokens !== undefined ? `${msg.usage.outputTokens.toLocaleString()} output` : "",
                              msg.usage.totalTokens !== undefined ? `${msg.usage.totalTokens.toLocaleString()} total tokens` : "",
                            ].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    )}
                    {msg.role === "bot" && msg.files && msg.files.length > 0 && (
                      <div className="aiagent-message-bubble">
                        <div className="aiagent-message-files">
                          {msg.files.map((f, idx) => (
                            <div key={idx} className="file-chip"><FileText size={14} /> {f.name}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.role === "bot" ? (
                      msg.error ? (
                        <div className="aiagent-message-bubble error-bubble">
                          <div className="aiagent-error-content">
                            {msg.content}
                            {msg.errorDetails && (
                              <div className="aiagent-error-details">
                                Detail: {msg.errorDetails}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {(() => {
                            const parts = splitMarkdown(msg.content);
                            return parts.map((part, index) => {
                              if (part.type === 'code') {
                                // Blok ```ui berisi JSON struktur -> render sebagai komponen
                                // React (kartu, alur, grafik, dsb), bukan sebagai kode.
                                if ((part.language || '').toLowerCase() === 'ui') {
                                  return <UiBlock key={index} raw={part.content} />;
                                }
                                return (
                                  <div key={index} className="aiagent-code-block-wrapper">
                                    <CodeBlock language={part.language || ''} code={part.content} />
                                  </div>
                                );
                              } else if (part.type === 'table') {
                                return <TableBlock key={index} content={part.content} />;
                              } else {
                                return (
                                  <div key={index} className="aiagent-message-bubble">
                                    <ReactMarkdown components={MarkdownComponents}>
                                      {part.content}
                                    </ReactMarkdown>
                                  </div>
                                );
                              }
                            });
                          })()}
                        </>
                      )
                    ) : (
                      <>
                        {msg.images && msg.images.length > 0 && (
                          <div className="aiagent-message-images">
                            {msg.images.map((img, idx) => (
                              <div key={idx} className="aiagent-message-image">
                                <img src={`data:${img.mimeType};base64,${img.data}`} alt={`Uploaded ${idx + 1}`} />
                              </div>
                            ))}
                          </div>
                        )}
                        {(msg.content || (msg.files && msg.files.length > 0)) && (
                          <div className="aiagent-message-bubble aiagent-user-bubble">
                            {msg.files && msg.files.length > 0 && (
                              <div className="aiagent-message-files">
                                {msg.files.map((f, idx) => (
                                  <div key={idx} className="file-chip"><FileText size={14} /> {f.name}</div>
                                ))}
                              </div>
                            )}
                            {msg.content ? <p className="aiagent-user-text">{msg.content}</p> : null}
                          </div>
                        )}
                      </>
                        )}
                    {msg.role === "bot" && msg.searchImages && msg.searchImages.length > 0 && (
                      <div className="aiagent-search-images">
                        {msg.searchImages.map((url, idx) => (
                          <img key={idx} src={url} alt={`Search result ${idx+1}`} className="aiagent-search-image" />
                        ))}
                      </div>
                    )}
                    {msg.role === "bot" && msg.attachments && msg.attachments.some(a => a.dataUrl && a.mimeType.startsWith("image/")) && (
                      <div className="aiagent-attachments aiagent-attachments--images">
                        {msg.attachments.filter(a => a.dataUrl && a.mimeType.startsWith("image/")).map((a, idx) => (
                          <img key={`att-img-${idx}`} src={a.dataUrl} alt={a.name} className="aiagent-attachment-image" onClick={() => window.open(a.dataUrl, "_blank")} />
                        ))}
                      </div>
                    )}
                    {msg.role === "bot" && msg.attachments && msg.attachments.some(a => !(a.dataUrl && a.mimeType.startsWith("image/"))) && (
                      <div className="aiagent-message-bubble">
                        <div className="aiagent-attachments">
                        {msg.attachments.filter(a => !(a.dataUrl && a.mimeType.startsWith("image/"))).map((a, idx) => (
                          (a.url || a.dataUrl) ? (
                            <a key={`att-file-${idx}`} className="file-chip file-chip-download" href={a.url || a.dataUrl} download={a.name} target={a.url ? "_blank" : undefined} rel={a.url ? "noopener noreferrer" : undefined} title="Download">
                              <FileText size={14} /> {a.name}{a.size ? ` (${(a.size / 1024).toFixed(1)} kB)` : ""} <Download size={12} />
                            </a>
                          ) : (
                            <div key={`att-file-${idx}`} className="file-chip"><FileText size={14} /> {a.name}{a.size ? ` (${(a.size / 1024).toFixed(1)} kB)` : ""}</div>
                          )
                        ))}
                        </div>
                      </div>
                    )}
                    {msg.role === "bot" && msg.sources && msg.sources.length > 0 && (
                      <div className="aiagent-sources">
                        <button
                          className="aiagent-sources-toggle"
                          style={{ color: 'var(--global-color-text)' }}
                          onClick={() => {
                            const key = `sources_${msg.id}`;
                            setSourcesVisibility(prev => ({ ...prev, [key]: !prev[key] }));
                          }}
                        >
                          <Link size={14} style={{ color: 'var(--global-color-text)', stroke: 'var(--global-color-text)' }} />
                          <span style={{ color: 'var(--global-color-text)', fontWeight: 600 }}>
                            {sourcesVisibility[`sources_${msg.id}`] ? 'Hide' : 'Show'} Sources ({msg.sources.length})
                          </span>
                          <ChevronDown
                            size={14}
                            style={{ color: 'var(--global-color-text)', stroke: 'var(--global-color-text)' }}
                            className={sourcesVisibility[`sources_${msg.id}`] ? 'rotate-180' : ''}
                          />
                        </button>
                        <ul className={`aiagent-sources-list ${sourcesVisibility[`sources_${msg.id}`] ? 'open' : ''}`}>
                          {msg.sources.map((src, idx) => (
                            <li key={idx}>
                              <a href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="aiagent-message-footer">
                      {msg.role === "user" && <><span className="aiagent-location"><MapPin size={12} /> {userLocation}</span><span className="aiagent-time">{formatTime(msg.timestamp)}{!isToday(msg.timestamp) && ` • ${formatDate(msg.timestamp)}`}</span></>}
                      {msg.role === "bot" && <span className="aiagent-time">{formatTime(msg.timestamp)}{!isToday(msg.timestamp) && ` • ${formatDate(msg.timestamp)}`}</span>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && !messages.some(m => m.processLive) && (
              <div className="aiagent-typing">
                <div className="aiagent-typing-content">
                  <div className="aiagent-typing-header"><span>{streamActivity || selectedModel}</span><div className="aiagent-typing-dots"><span></span><span></span><span></span></div></div>
                </div>
              </div>
            )}
          </div>

          {cropTarget && (
            <ImageCropper src={cropTarget.src} fileName={cropTarget.name} onDone={handleCropDone} onCancel={() => setCropTarget(null)} />
          )}

          {(uploadedImages.length > 0 || uploadedFiles.length > 0) && (
            <div className="aiagent-previews">
              {uploadedImages.map((img, idx) => (
                <div key={`img-${idx}`} className="aiagent-image-preview">
                  <img src={img.preview} alt={`Preview ${idx + 1}`} />
                  <button type="button" onClick={() => setCropTarget({ index: idx, src: img.preview, name: img.name })} className="aiagent-image-crop" aria-label={`Crop image ${idx + 1}`} title="Potong 1:1"><Crop size={22} /></button>
                  <button type="button" onClick={() => removeImage(idx)} className="aiagent-image-remove" aria-label={`Remove image ${idx + 1}`}><X size={22} /></button>
                </div>
              ))}
              {uploadedFiles.map((file, idx) => (
                <div key={`file-${idx}`} className="aiagent-file-preview">
                  <FileText size={14} />
                  <span>{file.kagglePath || file.stageOnKaggle ? `${file.name.length > 24 ? file.name.slice(0, 21) + "..." : file.name} · Kaggle` : (file.name.length > 30 ? file.name.substring(0, 27) + "..." : file.name)}</span>
                  <button type="button" onClick={() => removeFile(idx)} aria-label={`Remove ${file.name}`}><X size={22} /></button>
                </div>
              ))}
            </div>
          )}
          {uploadNotice && <div role="status" style={{ fontSize: "var(--global-font-size-12px)", padding: "4px 16px 8px", color: "var(--global-color-text-muted, #666)" }}>{uploadNotice}</div>}

          <div className="aiagent-input-container">
            <textarea
              ref={textareaRef}
              className="aiagent-input-textarea"
              placeholder={totalUploads > 0 ? `Message with ${totalUploads} attachment(s)...` : "Type a message..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={1}
              style={{ overflowY: textareaOverflow }}
            />
            <div className="aiagent-input-buttons">
              <div className="aiagent-input-buttons-left global-inline-row global-inline-row--gap-6">
                <div className="aiagent-upload-wrapper" ref={uploadDropdownRef}>
                  <button type="button" className="aiagent-add-btn" aria-label="Add attachments" title="Add attachments" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setUploadDropdownPos(calcDropdownPos(r, Math.min(220, window.innerWidth - 24), 180)); setIsUploadDropdownOpen(!isUploadDropdownOpen); }}><Plus size={22} aria-hidden="true" /></button>
                  <AnimatePresence>
                    {isUploadDropdownOpen && (
                      <AIAgentPopover className="aiagent-popover aiagent-upload-popover global-popover" position={uploadDropdownPos}>
                        <button onClick={() => imageInputRef.current?.click()}><span className="aiagent-upload-option-icon"><ImageIcon size={18} /></span><span>Photos (multi)</span></button>
                        <button onClick={() => multiFileInputRef.current?.click()}><span className="aiagent-upload-option-icon"><FileText size={18} /></span><span>Files (multi)</span></button>
                        <button onClick={() => folderInputRef.current?.click()}><span className="aiagent-upload-option-icon"><Folder size={18} /></span><span>Folder</span></button>
                      </AIAgentPopover>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <button onClick={handleSendMessage} disabled={isLoading || Boolean(pendingHostAction) || !canSendCurrentSource || (!input.trim() && !uploadedImages.length && !uploadedFiles.length)} className="aiagent-send-btn">
                {isLoading ? <Loader2 size={24} className="spin" /> : <Send size={24} />}
              </button>
            </div>
          </div>

          <input type="file" ref={imageInputRef} accept="image/*" multiple style={{ display: "none" }} onChange={handleImageUpload} />
          <input type="file" ref={multiFileInputRef} multiple style={{ display: "none" }} onChange={handleMultiFilesUpload} />
          <input type="file" ref={folderInputRef} style={{ display: "none" }} {...{ webkitdirectory: "true", directory: "true" }} onChange={handleFolderUpload} />
          {pendingHostAction && (
            <div className="aiagent-host-action-overlay global-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="host-action-confirm-title">
              <section className="aiagent-host-action-dialog global-modal">
                <h3 id="host-action-confirm-title">Konfirmasi aksi owner pada Sandbox</h3>
                <div className="aiagent-host-action-summary">
                  <strong>{summarizeHostAction(pendingHostAction.action).title}</strong>
                  <div className="aiagent-host-action-path">{summarizeHostAction(pendingHostAction.action).path}</div>
                  <p className="aiagent-host-action-impact">{summarizeHostAction(pendingHostAction.action).impact}</p>
                </div>
                <pre className="aiagent-host-action-json">{JSON.stringify(pendingHostAction.action, null, 2)}</pre>
                <small className="aiagent-host-action-expiry">Konfirmasi kedaluwarsa {new Date(pendingHostAction.expiresAt * 1000).toLocaleTimeString()}.</small>
                <label className="aiagent-host-action-label">
                  Teks tombol persetujuan
                  <select className="aiagent-host-action-input" value={confirmLabelChoice} onChange={(event) => setConfirmLabelChoice(event.target.value as "A" | "B" | "C" | "custom")}>
                    <option value="A">A — {ROOT_CONFIRM_LABELS.A}</option>
                    <option value="B">B — {ROOT_CONFIRM_LABELS.B}</option>
                    <option value="C">C — {ROOT_CONFIRM_LABELS.C}</option>
                    <option value="custom">Tulis teks sendiri</option>
                  </select>
                </label>
                {confirmLabelChoice === "custom" && <input className="aiagent-host-action-input" value={customConfirmLabel} onChange={(event) => setCustomConfirmLabel(event.target.value)} maxLength={80} placeholder="Tulis label tombol (maks. 80 karakter)" aria-label="Teks tombol konfirmasi custom" />}
                {hostActionError && <div className="aiagent-host-action-error" role="alert">{hostActionError}</div>}
                <div className="aiagent-host-action-actions">
                  <button type="button" className="aiagent-icon-btn" onClick={dismissPendingHostAction} disabled={confirmingHostAction}>Batalkan</button>
                  <button type="button" className="aiagent-send-btn" onClick={() => void confirmPendingHostAction()} disabled={confirmingHostAction || (confirmLabelChoice === "custom" && !customConfirmLabel.trim())}>{confirmingHostAction ? "Menjalankan…" : confirmLabelChoice === "custom" ? customConfirmLabel.trim() : ROOT_CONFIRM_LABELS[confirmLabelChoice]}</button>
                </div>
              </section>
            </div>
          )}
          <CloudModalKaggle
            isOpen={isKaggleModalOpen}
            isLoading={isSavingKaggleCredentials}
            onSave={handleSaveKaggleCredentials}
            onClose={() => setIsKaggleModalOpen(false)}
          />
        </div>
      )}
    </>
  );
};

export default AIAgent;