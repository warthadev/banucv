// src/react/feature/aiagent.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Bot, Trash2, Volume2, VolumeX, Check,
  Image as ImageIcon, X, Loader2, Sparkles, RefreshCw, FileText, Copy, Download, Folder, MapPin, Plus, User, Globe, Wand2, Link, ChevronDown
} from "lucide-react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import useAgentModels, { ROUTER_CREDENTIAL_UPDATED_EVENT } from "@hook/useagentmodels";
import { AI_AGENT_API_BASE } from "@config/api";
import { saveRouterCredentials } from "@config/routerhelper";
import { shouldShowRouterAuthModal } from "@config/agentauthflow";
import { LOCAL_AGENT_MODEL, isRetryableAgentAvailabilityError, resolveAgentModelRoute, shouldRetryWithNextAgentModel } from "@config/agentrouting";
import { buildModelScopedHistory, formatAgentFileContext, getAgentModeForModelSelection, getAgentModelClassification, getAgentModelsForMode, getAgentRequestModels, getAgentMessagesStorageKey, getAgentPreferencesStorageKey, parseAgentModeSettings, type AgentMode } from "@config/agentmodes";
import { parseAgentFile } from "@config/agentfileparser";
import { useAudio } from "@hook/useaudio";
import Loading from "@control/loading";
import ReactMarkdown, { type Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { getAuth, getDb } from "@config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { RouterAuthModal } from "./routerauthmodal";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  model?: string;
  requestedModel?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  timestamp: Date;
  imageData?: string;
  imageMimeType?: string;
  images?: { data: string; mimeType: string }[];
  files?: { name: string; content: string }[];
  error?: boolean;
  errorDetails?: string;
  sources?: { title: string; url: string }[];
  searchImages?: string[];
}

interface UploadedFile {
  name: string;
  content: string;
  type: string;
}

interface UploadedImage {
  data: string;
  mimeType: string;
  preview: string;
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
  if (!hasImages) return models;
  const cloudModels = models.filter((model) => !isLocalAgentModel(model));
  const localModels = models.filter(isLocalAgentModel);
  return [
    ...cloudModels.filter(isLikelyVisionAgentModel),
    ...cloudModels.filter((model) => !isLikelyVisionAgentModel(model)),
    ...localModels,
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

const AIAGENT_POPOVER_TRIGGER_GAP = 8;

interface AIAgentPopoverPosition {
  bottom: number;
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
    style={{ position: "fixed", bottom: position.bottom, left: position.left, maxHeight: position.maxHeight }}
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
              <th key={idx}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyLines.map((line, rowIdx) => {
            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
            return (
              <tr key={rowIdx}>
                {cells.map((cell, cellIdx) => (
                  <td key={cellIdx}>{cell}</td>
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

const stripMarkdownForSpeech = (text: string) => text
  .replace(/```[\s\S]*?```/g, "code block")
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
  if (!error) return "This account's model catalog is empty. Check the 9Router key and available models in Settings.";
  const normalizedError = error.toLowerCase();
  if (normalizedError.includes("cooldown") || normalizedError.includes("machine_cooldown")) {
    return "The 9Router server is cooling down, so the model catalog cannot be loaded yet. Reload the page when the server is available again.";
  }
  if (normalizedError.includes("rejected the saved api key")) {
    return "This account's 9Router key was rejected. Update it in Settings.";
  }
  if (normalizedError.includes("9router model catalog")) {
    return "The 9Router server cannot provide the model catalog yet. Reload the page when the server is available again.";
  }
  return `Unable to load the 9Router catalog: ${error}`;
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
  if (message.includes("Pollinations") || message.includes("image failed")) {
    return "Error: Failed to generate image. Try a different prompt.";
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
  const { isConfigured, isLoading: authLoading, routerModels, catalogError } = useAgentModels();
  const { aiMode } = useAudio();
  const navigate = useNavigate();

  const loadMessages = (uid: string): Message[] => {
    try {
      const saved = localStorage.getItem(getAgentMessagesStorageKey(uid));
      if (saved) {
        const parsed = JSON.parse(saved) as Array<Omit<Message, "timestamp"> & { timestamp: string | number }>;
        return parsed.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
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
      delete textOnly.imageData;
      delete textOnly.imageMimeType;
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
  const isRouterAuthModalOpen = shouldShowRouterAuthModal({
    isLoading: authLoading,
    userUid: currentUserUid,
    isConfigured,
  });
  const handleRouterAuthSave = async (apiKey: string) => {
    await saveRouterCredentials(apiKey);
    window.dispatchEvent(new Event(ROUTER_CREDENTIAL_UPDATED_EVENT));
  };
  const handleRouterAuthClose = () => navigate("/dashboard", { replace: true });
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesOwnerUid, setMessagesOwnerUid] = useState<string | null>(null);
  const [preferencesOwnerUid, setPreferencesOwnerUid] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [preferredModel, setPreferredModel] = useState("");
  const [agentMode, setAgentMode] = useState<AgentMode>("auto");
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const modelOptions = getAgentModelsForMode(routerModels, agentMode);
  const selectedModel = modelOptions.includes(preferredModel) ? preferredModel : modelOptions[0] || "";
  const hasPreferredAutoModel = agentMode === "auto" && modelOptions.includes(preferredModel);
  const requestModelOptions = getAgentRequestModels(routerModels, agentMode, selectedModel, "", hasPreferredAutoModel);
  const autoRecommendedModel = agentMode === "auto" ? getAgentRequestModels(routerModels, "auto", "", input)[0] || "" : "";
  const selectAgentMode = (mode: AgentMode) => {
    const candidates = getAgentModelsForMode(routerModels, mode);
    setAgentMode(mode);
    setPreferredModel(mode === "auto" ? "" : candidates[0] || "");
  };
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
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploadDropdownOpen, setIsUploadDropdownOpen] = useState(false);
  const [imageGenEnabled, setImageGenEnabled] = useState(false);
  const [, setRetryingMessageId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("User");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<string>("Unknown");
  const [uploadDropdownPos, setUploadDropdownPos] = useState<{ bottom: number; left: number; maxHeight: number }>({ bottom: 0, left: 0, maxHeight: 0 });
  const [modelPickerPos, setModelPickerPos] = useState<{ bottom: number; left: number; maxHeight: number }>({ bottom: 0, left: 0, maxHeight: 0 });
  const [textareaOverflow, setTextareaOverflow] = useState<"hidden" | "auto">("hidden");
  const [sourcesVisibility, setSourcesVisibility] = useState<Record<string, boolean>>({});
  
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
  
  useEffect(() => {
    if (!currentUserUid) {
      setMessagesOwnerUid(null);
      setMessages([]);
      setPreferredModel("");
      setAgentMode("auto");
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
    setAgentMode(savedPreferences.mode);
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
        localStorage.setItem(getAgentPreferencesStorageKey(currentUserUid), JSON.stringify({ mode: agentMode, model: preferredModel }));
      } catch (error) {
        console.warn("Failed to save this account's AI preferences:", error);
      }
    }
  }, [currentUserUid, preferencesOwnerUid, agentMode, preferredModel]);
  
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
          setCurrentUserUid(nextUid);
          setMessagesOwnerUid(null);
          setMessages([]);
          setPreferencesOwnerUid(null);
          setPreferredModel("");
          setAgentMode("auto");
          setUploadedImages([]);
          setUploadedFiles([]);
          setUploadNotice(null);
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
    const cleanText = stripMarkdownForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const lang = detectLanguage(cleanText);
    utterance.lang = lang === "id" ? "id-ID" : "en-US";
    const voices = speechSynthRef.current.getVoices();
    if (voices.length > 0) {
      const matchingVoice = voices.find(v => v.lang.startsWith(lang === "id" ? "id" : "en"));
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
          newImages.push(await prepareUploadedImage(file));
        } catch (error) {
          setUploadNotice(getErrorText(error) || `Unable to process ${file.name}`);
        }
        if (currentUserUidRef.current !== uploadOwnerUid) return;
        continue;
      }
      try {
        newFiles.push(await parseAgentFile(file));
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
          newImages.push(await prepareUploadedImage(file));
        } catch (error) {
          skippedCount += 1;
          if (!readError) readError = getErrorText(error) || `Unable to process ${name}`;
        }
        if (currentUserUidRef.current !== uploadOwnerUid) return;
        continue;
      }
      try {
        newFiles.push(await parseAgentFile(file, name));
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
  ): Promise<{ text: string; model: string; requestedModel: string; usage?: Message["usage"]; sources?: { title: string; url: string }[]; searchImages?: string[] }> => {
    const modelName = modelSequence[modelIndex];
    if (!modelName) throw new Error("Model not found");
    const originallyRequestedModel = modelSequence[0] || modelName;
    const priorMessages = currentMessages.filter(m => !m.error && !(isRetry && m.role === "user" && m.content === originalUserMessage));
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
    const response = await fetch(`${route.apiBase}/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        provider: "9router",
        model: route.model,
        prompt,
        history,
        images: images.map((image) => ({ mime_type: image.mimeType, data: image.data })),
      }),
    });
    const data = await response.json().catch(() => null);
    if (currentUserUidRef.current !== requestOwnerUid || activeRequestIdRef.current !== requestId) {
      throw new Error("The signed-in account changed while this AI request was running");
    }
    if (!response.ok) throw parseAgentErrorPayload(data, response.status);
    const result = data?.data?.result || {};
    const text = cleanMarkdown(result.content || "");
    if (!text) throw new Error("AI Agent returned an empty response");
    return { text, model: result.model || modelName, requestedModel: originallyRequestedModel, usage: normalizeTokenUsage(result.usage || data?.data?.usage), sources: [], searchImages: [] };
  };

  const generateImage = async (prompt: string): Promise<string> => {
    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true&seed=${Date.now()}`;
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new window.Image();
        const timeout = setTimeout(() => {
          reject(new Error("Pollinations image generation timed out"));
        }, 30000);
        img.onload = () => { clearTimeout(timeout); resolve(); };
        img.onerror = () => { clearTimeout(timeout); reject(new Error("Pollinations image failed to load")); };
        img.src = url;
      });
      return url;
    } catch (error) {
      console.error("Image generation error:", error);
      throw error;
    }
  };

  const sendMessage = async (messageText: string, images: UploadedImage[], files: UploadedFile[], retryModelIndex = 0, isRetry = false, modelSequence: string[] = requestModelOptions, requestOwnerUid: string | null = currentUserUid, suppliedRequestId?: number) => {
    if (!requestOwnerUid || currentUserUidRef.current !== requestOwnerUid || messagesOwnerUid !== requestOwnerUid) return;
    const requestId = suppliedRequestId ?? ++requestSequenceRef.current;
    activeRequestIdRef.current = requestId;
    const isCurrentRequest = () => currentUserUidRef.current === requestOwnerUid && activeRequestIdRef.current === requestId && messagesOwnerUid === requestOwnerUid;
    setIsLoading(true);

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

    if (imageGenEnabled && messageText.trim() && !images.length) {
      try {
        const imgDataUrl = await generateImage(messageText);
        if (!isCurrentRequest()) return;
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "bot",
          content: "",
          model: "pollinations",
          timestamp: new Date(),
          imageData: imgDataUrl,
          imageMimeType: "image/png",
        }]);
      } catch (error: unknown) {
        if (!isCurrentRequest()) return;
        const friendlyError = getErrorMessage(error);
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: "bot", 
          content: friendlyError, 
          model: "pollinations", 
          timestamp: new Date(), 
          error: true,
          errorDetails: getErrorText(error)
        }]);
      } finally {
        if (activeRequestIdRef.current === requestId) {
          activeRequestIdRef.current = null;
          setIsLoading(false);
          setRetryingMessageId(null);
        }
      }
      return;
    }
    
    try {
      const response = await callAI(messageText, images, files, retryModelIndex, messagesRef.current, isRetry, messageText, modelSequence, requestOwnerUid, requestId);
      if (!isCurrentRequest()) return;
      const newMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: response.text,
        model: response.model,
        requestedModel: response.requestedModel,
        usage: response.usage,
        timestamp: new Date(),
        sources: response.sources && response.sources.length > 0 ? response.sources : undefined,
        searchImages: response.searchImages && response.searchImages.length > 0 ? response.searchImages : undefined,
      };
      setMessages(prev => [...prev, newMsg]);

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
        activeRequestIdRef.current = null;
        setIsLoading(false);
        setRetryingMessageId(null);
      }
    }
  };

  const handleSendMessage = async () => {
    const requestOwnerUid = currentUserUidRef.current;
    if (!requestOwnerUid || requestOwnerUid !== currentUserUid || messagesOwnerUid !== requestOwnerUid || (!input.trim() && !uploadedImages.length && !uploadedFiles.length) || isLoading || !isConfigured || !selectedModel || !modelOptions.includes(selectedModel) || !requestModelOptions.length) return;
    const currentInput = input, currentImages = [...uploadedImages], currentFiles = [...uploadedFiles];
    const modelSequence = prioritizeVisionAgentModels(
      getAgentRequestModels(routerModels, agentMode, selectedModel, currentInput, hasPreferredAutoModel),
      currentImages.length > 0,
    );
    if (!modelSequence.length) return;
    setInput("");
    clearAllUploads();
    await sendMessage(currentInput, currentImages, currentFiles, 0, false, modelSequence, requestOwnerUid);
  };

  const retryMessage = async (messageId: string) => {
    const requestOwnerUid = currentUserUidRef.current;
    if (!requestOwnerUid || requestOwnerUid !== currentUserUid || messagesOwnerUid !== requestOwnerUid || isLoading || !selectedModel || !modelOptions.includes(selectedModel) || !requestModelOptions.length) return;
    const errorIndex = messages.findIndex(m => m.id === messageId);
    if (errorIndex <= 0) return;
    const userMsg = messages[errorIndex - 1];
    if (userMsg.role !== "user") return;
    setRetryingMessageId(messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
    const recoveredImages: UploadedImage[] = userMsg.images?.map(img => ({ data: img.data, mimeType: img.mimeType, preview: `data:${img.mimeType};base64,${img.data}` })) || [];
    const recoveredFiles: UploadedFile[] = userMsg.files?.map(f => ({ name: f.name, content: f.content, type: "" })) || [];
    const modelSequence = prioritizeVisionAgentModels(
      getAgentRequestModels(routerModels, agentMode, selectedModel, userMsg.content, hasPreferredAutoModel),
      (userMsg.images?.length || 0) > 0,
    );
    await sendMessage(userMsg.content, recoveredImages, recoveredFiles, 0, true, modelSequence, requestOwnerUid);
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

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (date: Date) => date.toLocaleDateString([], { month: "short", day: "numeric" });
  const isToday = (date: Date) => formatDate(date) === formatDate(new Date());

  const totalUploads = uploadedImages.length + uploadedFiles.length;

  if (authLoading || !currentUserUid) return <Loading />;
  if (isRouterAuthModalOpen) {
    return (
      <RouterAuthModal
        isOpen
        onSave={handleRouterAuthSave}
        onClose={handleRouterAuthClose}
      />
    );
  }

  return (
    <>
      {isConfigured && (
        <div className="aiagent-container">
          {!modelOptions.length && (
            <div className="aiagent-catalog-status" role={catalogError ? "alert" : "status"}>
              <p>{routerModels.length ? `No model is classified for ${agentMode} mode. Open the AI Agent menu to choose another available mode.` : getCatalogStatusMessage(catalogError)}</p>
              {!routerModels.length && <RouterLink className="aiagent-settings-link" to="/setting">Manage the 9Router key in Settings</RouterLink>}
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
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`aiagent-message ${msg.role === "user" ? "user" : "bot"}`}>
                  {msg.role === "user" && <div className="aiagent-user-avatar">{userAvatar ? <img src={userAvatar} alt="Avatar" /> : <User size={24} />}</div>}
                  <div className="aiagent-message-content">
                    {msg.role === "user" && <div className="aiagent-username">{userDisplayName}</div>}
                    {msg.role === "bot" && (
                      <div className="aiagent-bot-header">
                        <div className="aiagent-bot-header-left">
                          <span className="aiagent-model-name">
                            {msg.model === 'pollinations' ? 'Pollinations' : (msg.model || selectedModel)}
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
                        {!msg.imageData && (
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
                        )}
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
                    {msg.role === "user" && msg.images && msg.images.length > 0 && (
                      <div className="aiagent-message-images">
                        {msg.images.map((img, idx) => (
                          <div key={idx} className="aiagent-message-image">
                            <img src={`data:${img.mimeType};base64,${img.data}`} alt={`Uploaded ${idx + 1}`} />
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.role === "bot" && msg.imageData && msg.model?.startsWith("pollinations") && (
                      <img
                        src={msg.imageData}
                        alt="Generated"
                        className="aiagent-generated-image"
                        onClick={() => window.open(msg.imageData, "_blank")}
                      />
                    )}
                    {msg.files && msg.files.length > 0 && (
                      <div className="aiagent-message-files">
                        {msg.files.map((f, idx) => (
                          <div key={idx} className="file-chip"><FileText size={14} /> {f.name}</div>
                        ))}
                      </div>
                    )}
                    {!(msg.role === "bot" && msg.model?.startsWith("pollinations") && msg.imageData) && (
                      <>
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
                          <div className="aiagent-message-bubble aiagent-user-bubble">
                            <p className="aiagent-user-text">{msg.content}</p>
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
                    {msg.role === "bot" && msg.sources && msg.sources.length > 0 && (
                      <div className="aiagent-sources">
                        <button 
                          className="aiagent-sources-toggle"
                          style={{ color: 'var(--text)' }}
                          onClick={() => {
                            const key = `sources_${msg.id}`;
                            setSourcesVisibility(prev => ({ ...prev, [key]: !prev[key] }));
                          }}
                        >
                          <Link size={14} style={{ color: 'var(--text)', stroke: 'var(--text)' }} />
                          <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                            {sourcesVisibility[`sources_${msg.id}`] ? 'Hide' : 'Show'} Sources ({msg.sources.length})
                          </span>
                          <ChevronDown 
                            size={14} 
                            style={{ color: 'var(--text)', stroke: 'var(--text)' }} 
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
            {isLoading && (
              <div className="aiagent-typing">
                <div className="aiagent-typing-content">
                  <div className="aiagent-typing-header"><span>{selectedModel}</span><div className="aiagent-typing-dots"><span></span><span></span><span></span></div></div>
                </div>
              </div>
            )}
          </div>

          {(uploadedImages.length > 0 || uploadedFiles.length > 0) && (
            <div className="aiagent-previews">
              {uploadedImages.map((img, idx) => (
                <div key={`img-${idx}`} className="aiagent-image-preview">
                  <img src={img.preview} alt={`Preview ${idx + 1}`} />
                  <button onClick={() => removeImage(idx)} className="aiagent-image-remove"><X size={16} /></button>
                </div>
              ))}
              {uploadedFiles.map((file, idx) => (
                <div key={`file-${idx}`} className="aiagent-file-preview">
                  <FileText size={14} />
                  <span>{file.name.length > 30 ? file.name.substring(0,27)+"..." : file.name}</span>
                  <button onClick={() => removeFile(idx)}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
          {uploadNotice && <div role="status" style={{ fontSize: 12, padding: "0 12px 8px", color: "var(--text-muted, #666)" }}>{uploadNotice}</div>}

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
              <div className="aiagent-input-buttons-left">
                <div className="aiagent-upload-wrapper" ref={uploadDropdownRef}>
                  <button className="aiagent-icon-btn" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setUploadDropdownPos(calcDropdownPos(r, Math.min(220, window.innerWidth - 24), 180)); setIsUploadDropdownOpen(!isUploadDropdownOpen); }}><Plus size={24} /></button>
                  <AnimatePresence>
                    {isUploadDropdownOpen && (
                      <AIAgentPopover className="aiagent-popover aiagent-upload-popover" position={uploadDropdownPos}>
                        <button onClick={() => imageInputRef.current?.click()}><span className="aiagent-upload-option-icon"><ImageIcon size={18} /></span><span>Photos (multi)</span></button>
                        <button onClick={() => multiFileInputRef.current?.click()}><span className="aiagent-upload-option-icon"><FileText size={18} /></span><span>Files (multi)</span></button>
                        <button onClick={() => folderInputRef.current?.click()}><span className="aiagent-upload-option-icon"><Folder size={18} /></span><span>Folder</span></button>
                      </AIAgentPopover>
                    )}
                  </AnimatePresence>
                </div>
                <div className="aiagent-model-wrapper" ref={modelPickerRef}>
                  <button
                    type="button"
                    className="aiagent-icon-btn aiagent-model-picker-trigger"
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
                      setModelPickerPos(calcDropdownPos(
                        triggerRect,
                        pickerWidth,
                        pickerHeight,
                      ));
                      setIsModelPickerOpen((open) => !open);
                    }}
                    title={`Choose AI mode: ${agentMode}`}
                    aria-label={`AI Agent mode: ${agentMode}`}
                    aria-haspopup="dialog"
                    aria-expanded={isModelPickerOpen}
                    aria-controls="aiagent-model-picker"
                    disabled={!routerModels.length}
                  >
                    <Bot size={22} aria-hidden="true" />
                  </button>
                  <AnimatePresence>
                    {isModelPickerOpen && (
                      <AIAgentPopover
                        id="aiagent-model-picker"
                        className="aiagent-popover aiagent-model-picker-popover"
                        position={modelPickerPos}
                        role="dialog"
                        ariaModal={false}
                        ariaLabelledBy="aiagent-model-picker-title"
                      >
                        <div className="aiagent-model-picker-header">
                          <div className="aiagent-model-picker-icon"><Bot size={19} /></div>
                          <div className="aiagent-model-picker-heading aiagent-popover">
                            <h3 id="aiagent-model-picker-title">AI Agent</h3>
                            <p>
                              {agentMode === "auto"
                                ? "Auto picks supported Thinking/Fast models for this account, then tries its exact Local model after capacity failures. Cloud usage may incur charges."
                                : agentMode === "thinking"
                                  ? "Reasoning-capable model families from this account's catalog are available in this mode."
                                  : agentMode === "fast"
                                    ? "Direct-response and speed-optimized models from this account's catalog. Response times vary by provider."
                                    : "Use this account's configured Local Mimo inference route without model fallback. Its full authenticated 9Router catalog ID is preserved."}
                            </p>
                          </div>
                        </div>
                        <div className="aiagent-mode-options" role="group" aria-label="AI modes">
                          {(["auto", "thinking", "fast", "local"] as AgentMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              className={`aiagent-mode-option aiagent-popover${agentMode === mode ? " selected" : ""}`}
                              aria-pressed={agentMode === mode}
                              onClick={() => selectAgentMode(mode)}
                            >
                              {mode[0].toUpperCase() + mode.slice(1)}
                            </button>
                          ))}
                        </div>
                        <div className="aiagent-model-option-list" role="list" aria-label={`${agentMode} models available to this account`}>
                          {modelOptions.length ? modelOptions.map((model) => {
                            const classification = getAgentModelClassification(model);
                            const isLocalModel = classification === "Local";
                            const isSelected = agentMode === "auto"
                              ? hasPreferredAutoModel ? model === selectedModel : model === autoRecommendedModel
                              : model === selectedModel;
                            const modelDescription = agentMode === "auto"
                              ? isLocalModel
                                ? "Local Mimo inference via this catalog route. Auto tries it only after eligible Thinking/Fast models hit capacity limits."
                                : `${classification} candidate in this account's Auto pool; eligible cloud models remain available as fallbacks.`
                              : agentMode === "local"
                                ? "Local Mimo inference using the full catalog ID and this account's 9Router key; no model fallback."
                                : `${classification} model; capacity fallback stays within the ${agentMode} category.`;
                            return (
                              <button
                                type="button"
                                key={model}
                                className={`aiagent-model-option${isSelected ? " selected" : ""}`}
                                aria-pressed={isSelected}
                                onClick={() => {
                                  setAgentMode(getAgentModeForModelSelection(agentMode, model));
                                  setPreferredModel(model);
                                  setIsModelPickerOpen(false);
                                }}
                              >
                                <span className="aiagent-model-option-copy aiagent-popover">
                                  <strong>{model}</strong>
                                  <small>{modelDescription}</small>
                                </span>
                                {isSelected && <Check size={17} aria-hidden="true" />}
                              </button>
                            );
                          }) : (
                            <p className="aiagent-model-empty aiagent-popover" role="status">
                              {agentMode === "auto"
                                ? "No supported Thinking or Fast cloud model is available in this account's catalog. Choose Local explicitly if it is authorized."
                                : agentMode === "thinking"
                                  ? "No supported reasoning-capable model is available in this account's catalog."
                                  : agentMode === "fast"
                                    ? "No supported direct-response or speed-optimized model is available in this account's catalog."
                                    : `No authorized catalog route matches the configured Local Mimo identity (${LOCAL_AGENT_MODEL}).`}
                            </p>
                          )}
                        </div>
                      </AIAgentPopover>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  className="aiagent-icon-btn globe-btn"
                  type="button"
                  disabled
                  aria-label="Web Search unavailable"
                  title="Web Search needs an approved search provider before it can send queries."
                >
                  <Globe size={22} />
                </button>
                <button 
                  className={`aiagent-icon-btn wand2-btn${imageGenEnabled ? " image-gen-active" : ""}`} 
                  onClick={() => setImageGenEnabled(v => !v)} 
                  title={imageGenEnabled ? "Image Gen ON" : "Image Gen OFF"}
                >
                  <Wand2 size={22} />
                </button>
                <button onClick={clearChat} className="aiagent-clear-btn"><Trash2 size={22} /></button>
              </div>
              <button onClick={handleSendMessage} disabled={isLoading || !selectedModel || !modelOptions.includes(selectedModel) || !requestModelOptions.length || (!input.trim() && !uploadedImages.length && !uploadedFiles.length)} className="aiagent-send-btn">
                {isLoading ? <Loader2 size={24} className="spin" /> : <Send size={24} />}
              </button>
            </div>
          </div>

          <input type="file" ref={imageInputRef} accept="image/*" multiple style={{ display: "none" }} onChange={handleImageUpload} />
          <input type="file" ref={multiFileInputRef} multiple style={{ display: "none" }} onChange={handleMultiFilesUpload} />
          <input type="file" ref={folderInputRef} style={{ display: "none" }} {...{ webkitdirectory: "true", directory: "true" }} onChange={handleFolderUpload} />
        </div>
      )}
    </>
  );
};

export default AIAgent;
