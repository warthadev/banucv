// src/react/feature/aiagent.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Bot, Trash2, Volume2, VolumeX, Check,
  Image as ImageIcon, X, Loader2, Sparkles, RefreshCw, FileText, Copy, Download, Folder, MapPin, Plus, User, Globe, Wand2, Link, ChevronDown
} from "lucide-react";
import useAgentModels, { AUTOMATIC_AGENT_MODEL } from "@hook/useagentmodels";
import { AGENT_API_BASE, LOCAL_AGENT_API_BASE } from "@config/api";
import { resolveAgentModelRoute } from "@config/agentrouting";
import { useAudio } from "@hook/useaudio";
import { RouterAuthModal } from "./routerauthmodal";
import { modalVariants, overlayVariants } from "@animation/githubeditor";
import Loading from "@control/loading";
import ReactMarkdown, { type Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { getAuth, getDb } from "@config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const AVAILABLE_MODELS = [
  AUTOMATIC_AGENT_MODEL,
  "openrouter/openrouter/free",
  "openrouter/nvidia/nemotron-3.5-super-vl:free",
  "gemini/gemini-3.6-flash",
  "gemini/gemini-3.5-flash-lite",
];

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  model?: string;
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
  const { isConfigured, showAuthModal, saveApiKey, closeModal, openModal, isLoading: authLoading, routerModels } = useAgentModels();
  const { aiMode } = useAudio();

  const loadMessages = (): Message[] => {
    try {
      let saved = localStorage.getItem('aiagent_messages');
      if (!saved) {
        const legacyMessages = localStorage.getItem('aichat_messages');
        if (legacyMessages) {
          saved = legacyMessages;
          localStorage.setItem('aiagent_messages', legacyMessages);
        }
      }
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

  const saveMessages = (msgs: Message[]) => {
    try {
      localStorage.setItem('aiagent_messages', JSON.stringify(msgs));
    } catch (e) {
      console.warn('Failed to save messages:', e);
    }
  };

  const [messages, setMessages] = useState<Message[]>(() => loadMessages());
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AUTOMATIC_AGENT_MODEL);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const modelOptions = Array.from(new Set([
    AUTOMATIC_AGENT_MODEL,
    ...routerModels.filter((model) => Boolean(model)),
    ...AVAILABLE_MODELS.slice(1),
  ]));
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploadDropdownOpen, setIsUploadDropdownOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [imageGenEnabled, setImageGenEnabled] = useState(false);
  const [, setRetryingMessageId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("User");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<string>("Unknown");
  const [uploadDropdownPos, setUploadDropdownPos] = useState<{ bottom: number; left: number; maxHeight: number }>({ bottom: 0, left: 0, maxHeight: 0 });
  const [textareaOverflow, setTextareaOverflow] = useState<"hidden" | "auto">("hidden");
  const [sourcesVisibility, setSourcesVisibility] = useState<Record<string, boolean>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const uploadDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Message[]>([]);
  
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);
  
  useEffect(() => {
    const initAuth = async () => {
      try {
        const auth = await getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            const db = await getDb();
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
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
        return () => unsubscribe();
      } catch (error) {
        console.error("Failed to initialize auth in AIAgent:", error);
      }
    };
    
    initAuth();
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        continue;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setUploadedImages(prev => [...prev, {
          data: base64.split(",")[1],
          mimeType: file.type,
          preview: base64
        }]);
      };
      reader.readAsDataURL(file);
    }
    setIsUploadDropdownOpen(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleMultiFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: UploadedFile[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) continue;
      const dangerousExts = ['.js', '.exe', '.bat', '.sh', '.php', '.py', '.rb', '.jsp', '.asp', '.aspx', '.cgi', '.pl'];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (dangerousExts.includes(ext || '')) {
        console.warn('Dangerous file type blocked:', file.name);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        console.warn('File too large:', file.name);
        continue;
      }
      try { newFiles.push({ name: file.name, content: await file.text(), type: file.type }); } catch { void 0; }
    }
    if (newFiles.length) { setUploadedFiles(prev => [...prev, ...newFiles]); }
    if (multiFileInputRef.current) multiFileInputRef.current.value = "";
    setIsUploadDropdownOpen(false);
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: UploadedFile[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) continue;
      const dangerousExts = ['.js', '.exe', '.bat', '.sh', '.php', '.py', '.rb', '.jsp', '.asp', '.aspx', '.cgi', '.pl'];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (dangerousExts.includes(ext || '')) {
        console.warn('Dangerous file type blocked:', file.name);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        console.warn('File too large:', file.name);
        continue;
      }
      try { newFiles.push({ name: file.webkitRelativePath || file.name, content: await file.text(), type: file.type }); } catch { void 0; }
    }
    if (newFiles.length) { setUploadedFiles(prev => [...prev, ...newFiles]); }
    if (folderInputRef.current) folderInputRef.current.value = "";
    setIsUploadDropdownOpen(false);
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllUploads = () => {
    setUploadedImages([]);
    setUploadedFiles([]);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (multiFileInputRef.current) multiFileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const buildContextFromFiles = (files: UploadedFile[]): string => {
    if (!files.length) return "";
    let context = "\n\n--- Context from uploaded files ---\n";
    for (const file of files) context += `\nFile: ${file.name}\n\`\`\`\n${file.content.substring(0, 3000)}${file.content.length > 3000 ? "\n... (truncated)" : ""}\n\`\`\`\n`;
    context += "\n--- End of context ---\n";
    return context;
  };

  const callAI = async (
    messageText: string,
    images: UploadedImage[],
    files: UploadedFile[],
    modelIndex: number,
    currentMessages: Message[],
    isRetry: boolean,
    originalUserMessage?: string
  ): Promise<{ text: string; model: string; sources?: { title: string; url: string }[]; searchImages?: string[] }> => {
    const modelName = modelOptions[modelIndex];
    if (!modelName) throw new Error("Model not found");
    const history = currentMessages.filter(m => !m.error && !(isRetry && m.role === "user" && m.content === originalUserMessage)).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
    const textContext = messageText + buildContextFromFiles(files);
    const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [{ type: "text", text: textContext || "Describe these images" }];
    for (const image of images) content.push({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } });
    const firebaseAuth = await getAuth();
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error("Please sign in before using AI Agent");
    const idToken = await user.getIdToken(true);
    const prompt = `${textContext}${images.length ? `\n\n[${images.length} image(s) attached]` : ""}`;
    const route = resolveAgentModelRoute(modelName, AGENT_API_BASE, LOCAL_AGENT_API_BASE);
    const response = await fetch(`${route.apiBase}/agent/chat`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ provider: "9router", model: route.model, prompt, history }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.detail || `AI Agent request failed: ${response.status}`);
    const result = data?.data?.result || {};
    const text = cleanMarkdown(result.content || "");
    if (!text) throw new Error("AI Agent returned an empty response");
    return { text, model: result.model || modelName, sources: [], searchImages: [] };
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

  const sendMessage = async (messageText: string, images: UploadedImage[], files: UploadedFile[], retryModelIndex: number = Math.max(0, modelOptions.indexOf(selectedModel)), isRetry: boolean = false) => {
    setIsLoading(true);

    if (!isRetry) {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: messageText || (images.length ? `[${images.length} image(s)]` : files.length ? `[${files.length} file(s)]` : ""),
        timestamp: new Date(),
        images: images.map(img => ({ data: img.data, mimeType: img.mimeType })),
        imageData: images.length > 0 ? images[0].preview : undefined,
        files: files.map(f => ({ name: f.name, content: f.content.substring(0, 500) }))
      };
      setMessages(prev => [...prev, userMsg]);
    }

    if (imageGenEnabled && messageText.trim() && !images.length) {
      try {
        const imgDataUrl = await generateImage(messageText);
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
        setIsLoading(false);
        setRetryingMessageId(null);
      }
      return;
    }
    
    try {
      const response = await callAI(messageText, images, files, retryModelIndex, messagesRef.current, isRetry, messageText);
      const newMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: response.text,
        model: response.model,
        timestamp: new Date(),
        sources: response.sources && response.sources.length > 0 ? response.sources : undefined,
        searchImages: response.searchImages && response.searchImages.length > 0 ? response.searchImages : undefined,
      };
      setMessages(prev => [...prev, newMsg]);

      if (aiMode === 'auto') {
        speakText(response.text, (Date.now() + 1).toString());
      }
    } catch (error: unknown) {
      const errorType = getErrorType(error);
      const friendlyError = getErrorMessage(error);
      
      const errorMessage = getErrorText(error);
      const isServiceUnavailable = errorType === "SERVICE_UNAVAILABLE" || errorMessage.includes("503");
      const isRateLimit = errorType === "RATE_LIMIT" || errorMessage.includes("429");
      
      if ((isServiceUnavailable || isRateLimit) && retryModelIndex < modelOptions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await sendMessage(messageText, images, files, retryModelIndex + 1, true);
        return;
      }
      
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: "bot", 
        content: friendlyError, 
        model: "Error", 
        timestamp: new Date(), 
        error: true,
        errorDetails: error.message 
      }]);
      
      console.error("API Error Details:", {
        type: errorType,
        message: error.message,
        stack: error.stack,
        model: selectedModel,
        retryCount: retryModelIndex
      });
    } finally { 
      setIsLoading(false); 
      setRetryingMessageId(null); 
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !uploadedImages.length && !uploadedFiles.length) || isLoading || !isConfigured) return;
    const currentInput = input, currentImages = [...uploadedImages], currentFiles = [...uploadedFiles];
    setInput("");
    clearAllUploads();
    await sendMessage(currentInput, currentImages, currentFiles);
  };

  const retryMessage = async (messageId: string) => {
    const errorIndex = messages.findIndex(m => m.id === messageId);
    if (errorIndex <= 0) return;
    const userMsg = messages[errorIndex - 1];
    if (userMsg.role !== "user") return;
    setRetryingMessageId(messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
    const recoveredImages: UploadedImage[] = userMsg.images?.map(img => ({ data: img.data, mimeType: img.mimeType, preview: `data:${img.mimeType};base64,${img.data}` })) || [];
    const recoveredFiles: UploadedFile[] = userMsg.files?.map(f => ({ name: f.name, content: f.content, type: "" })) || [];
    await sendMessage(userMsg.content, recoveredImages, recoveredFiles, Math.max(0, modelOptions.indexOf(selectedModel)), true);
  };

  const copyMessage = (content: string) => navigator.clipboard.writeText(content);
  
  const clearChat = () => { 
    setMessages([]); 
    localStorage.removeItem('aiagent_messages');
    localStorage.removeItem('aichat_messages');
  };

  const calcDropdownPos = (
    btnRect: DOMRect,
    menuWidth: number,
    menuHeight: number
  ): { bottom: number; left: number; maxHeight: number } => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    const gap = 4;
    const spaceAbove = btnRect.top - gap;
    const bottom = vh - btnRect.top + gap;
    const maxHeight = Math.min(menuHeight, Math.max(spaceAbove - gap, 140));

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

  if (authLoading) return <Loading />;

  return (
    <>
      <RouterAuthModal isOpen={showAuthModal} onSave={saveApiKey} onClose={closeModal} />
      {!isConfigured && !showAuthModal && (
        <div style={{ minHeight: "55vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <div style={{ textAlign: "center", maxWidth: "460px" }}>
            <h2>AI Agent memerlukan API key 9Router</h2>
            <p>Key akan disimpan terenkripsi untuk akun Anda.</p>
            <button type="button" className="github-modal-confirm" onClick={openModal}>Atur API key</button>
          </div>
        </div>
      )}
      <AnimatePresence>
        {isConfigured && isModelPickerOpen && (
          <motion.div
            className="github-modal-overlay aiagent-model-picker-overlay"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsModelPickerOpen(false);
            }}
          >
            <motion.div
              className="github-modal aiagent-model-picker-modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              role="dialog"
              aria-modal="true"
              aria-labelledby="aiagent-model-picker-title"
            >
              <div className="aiagent-model-picker-header">
                <div className="aiagent-model-picker-icon"><Bot size={20} /></div>
                <div className="aiagent-model-picker-heading">
                  <h3 id="aiagent-model-picker-title">Pilih model AI</h3>
                  <p>Pilih model untuk percakapan ini.</p>
                </div>
                <button
                  type="button"
                  className="aiagent-model-picker-close"
                  onClick={() => setIsModelPickerOpen(false)}
                  aria-label="Tutup pemilih model"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="aiagent-model-option-list" role="radiogroup" aria-label="Model AI">
                {modelOptions.map((model) => {
                  const isAutomatic = model === AUTOMATIC_AGENT_MODEL;
                  const isSelected = model === selectedModel;
                  return (
                    <button
                      type="button"
                      key={model}
                      className={`aiagent-model-option${isSelected ? " selected" : ""}`}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setSelectedModel(model);
                        setIsModelPickerOpen(false);
                      }}
                    >
                      <span className="aiagent-model-option-copy">
                        <strong>{isAutomatic ? "Auto (disarankan)" : model}</strong>
                        <small>{isAutomatic ? `Model default AI Agent · ${model}` : "Model tersedia melalui AI Agent"}</small>
                      </span>
                      {isSelected && <Check size={18} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {isConfigured && (
        <div className="aiagent-container">
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
                              title="Retry with same model"
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
                  <button className="aiagent-icon-btn" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setUploadDropdownPos(calcDropdownPos(r, 160, 150)); setIsUploadDropdownOpen(!isUploadDropdownOpen); }}><Plus size={24} /></button>
                  {isUploadDropdownOpen && (
                    <div
                      className="upload-dropdown-menu"
                      style={{
                        position: "fixed",
                        bottom: uploadDropdownPos.bottom,
                        left: uploadDropdownPos.left,
                        maxHeight: uploadDropdownPos.maxHeight,
                      }}
                    >
                      <button onClick={() => imageInputRef.current?.click()}><ImageIcon size={18} /> Photos (multi)</button>
                      <button onClick={() => multiFileInputRef.current?.click()}><FileText size={18} /> Files (multi)</button>
                      <button onClick={() => folderInputRef.current?.click()}><Folder size={18} /> Folder</button>
                    </div>
                  )}
                </div>
                <div className="aiagent-model-wrapper">
                  <button
                    type="button"
                    className="aiagent-model-picker-trigger"
                    onClick={() => setIsModelPickerOpen(true)}
                    title="Pilih model AI"
                    aria-label="Pilih model AI"
                    aria-haspopup="dialog"
                    aria-expanded={isModelPickerOpen}
                  >
                    <span className="aiagent-icon-btn" aria-hidden="true"><Bot size={24} /></span>
                  </button>
                </div>
                <button 
                  className={`aiagent-icon-btn globe-btn${webSearchEnabled ? " web-search-active" : ""}`} 
                  onClick={() => setWebSearchEnabled(v => !v)} 
                  title={webSearchEnabled ? "Web Search ON" : "Web Search OFF"}
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
              <button onClick={handleSendMessage} disabled={isLoading || (!input.trim() && !uploadedImages.length && !uploadedFiles.length)} className="aiagent-send-btn">
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
