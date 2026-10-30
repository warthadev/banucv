// src/react/feature/aichat.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Bot, Trash2, Volume2, VolumeX, AlertCircle,
  Image as ImageIcon, X, Loader2, Sparkles, RefreshCw, FileText, Copy, Download, Folder, MapPin, Plus, User, Globe, Wand2, Link, ChevronDown
} from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import useGemini, { getCachedGeminiKey } from "@hook/usegemini";
import { useAudio } from "@hook/useaudio";
import { GeminiAuthModal } from "./geminiauthmodal";
import Loading from "@control/loading";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { getAuth, getDb } from "@config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const AVAILABLE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-pro-preview-customtools",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-image-preview",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
  "gemini-3.1-flash-tts-preview",
  "gemini-3-pro-image-preview",
  "gemini-3-pro-image",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-flash-native-audio-latest",
  "gemini-2.5-flash-native-audio-preview-09-2025",
  "gemini-2.5-flash-native-audio-preview-12-2025",
  "gemini-2.5-pro",
  "gemini-2.5-pro-preview-tts",
  "gemini-2.5-computer-use-preview-10-2025",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
  "gemini-omni-flash-preview",
  "gemini-robotics-er-1.6-preview",
  "gemini-robotics-er-2-preview",
  "gemini-embedding-001",
  "gemini-embedding-2-preview",
  "gemini-embedding-2",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
  "nano-banana-pro-preview",
  "lyria-3-clip-preview",
  "lyria-3-pro-preview",
  "antigravity-preview-05-2026",
  "deep-research-max-preview-04-2026",
  "deep-research-preview-04-2026",
  "deep-research-pro-preview-12-2025",
  "aqa",
  "imagen-4.0-generate-001",
  "imagen-4.0-ultra-generate-001",
  "imagen-4.0-fast-generate-001",
  "veo-3.1-generate-preview",
  "veo-3.1-fast-generate-preview",
  "veo-3.1-lite-generate-preview",
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
    <div className="aichat-table-block-wrapper">
      <div className="aichat-table-header">
        <span className="aichat-table-label">Table</span>
        <div className="aichat-table-actions">
          <button onClick={handleCopy} className="aichat-table-btn">
            {copied ? 'Copied!' : <Copy size={14} />}
            <span>Copy</span>
          </button>
          <button onClick={handleDownload} className="aichat-table-btn">
            <Download size={14} />
            <span>CSV</span>
          </button>
        </div>
      </div>
      <div className="aichat-table-scroll">
        <table className="aichat-table-content">
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
    <div className="aichat-code-block-wrapper">
      <div className="aichat-code-block-actions">
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

const MarkdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children).replace(/\n$/, "");
    return !inline && match ? <CodeBlock language={match[1]} code={code} /> : <code className={className} {...props}>{children}</code>;
  },
  a({ href, children }: any) { return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>; },
  img({ src, alt }: any) { return <img src={src} alt={alt} className="aichat-markdown-img" />; },
  table({ children }: any) {
    return <div className="aichat-markdown-table-wrapper">{children}</div>;
  },
  thead({ children }: any) {
    return <thead className="aichat-markdown-thead">{children}</thead>;
  },
  th({ children }: any) {
    return <th className="aichat-markdown-th">{children}</th>;
  },
  td({ children }: any) {
    return <td className="aichat-markdown-td">{children}</td>;
  },
  tr({ children }: any) {
    return <tr className="aichat-markdown-tr">{children}</tr>;
  },
};

const cleanMarkdown = (text: string) => text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();

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
  .replace(/\u0000/g, "")
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

const getErrorMessage = (error: any): string => {
  if (!error) return "Unknown error occurred";
  
  const message = error.message || error.toString?.() || "";
  
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

const getErrorType = (error: any): string => {
  const message = error.message || error.toString?.() || "";
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

const AIChat: React.FC = () => {
  const { isConfigured, showAuthModal, saveApiKey, closeModal, isLoading: authLoading } = useGemini();
  const { aiMode } = useAudio();

  const loadMessages = (): Message[] => {
    try {
      const saved = localStorage.getItem('aichat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((msg: any) => ({
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
      localStorage.setItem('aichat_messages', JSON.stringify(msgs));
    } catch (e) {
      console.warn('Failed to save messages:', e);
    }
  };

  const [messages, setMessages] = useState<Message[]>(() => loadMessages());
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploadDropdownOpen, setIsUploadDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [imageGenEnabled, setImageGenEnabled] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("User");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<string>("Unknown");
  const [uploadDropdownPos, setUploadDropdownPos] = useState<{ bottom: number; left: number; maxHeight: number }>({ bottom: 0, left: 0, maxHeight: 0 });
  const [modelDropdownPos, setModelDropdownPos] = useState<{ bottom: number; left: number; maxHeight: number }>({ bottom: 0, left: 0, maxHeight: 0 });
  const [textareaOverflow, setTextareaOverflow] = useState<"hidden" | "auto">("hidden");
  const [sourcesVisibility, setSourcesVisibility] = useState<Record<string, boolean>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const uploadDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
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
        console.error("Failed to initialize auth in AIChat:", error);
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
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) setIsModelDropdownOpen(false);
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
      try { newFiles.push({ name: file.name, content: await file.text(), type: file.type }); } catch {}
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
      try { newFiles.push({ name: (file as any).webkitRelativePath || file.name, content: await file.text(), type: file.type }); } catch {}
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
    const modelName = AVAILABLE_MODELS[modelIndex];
    if (!modelName) throw new Error(`Model ${modelName} not found`);
    const apiKey = getCachedGeminiKey();
    if (!apiKey) throw new Error("No API key");
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelConfig: any = { model: modelName };
    if (webSearchEnabled) {
      modelConfig.tools = [{ googleSearch: {} }];
    }
    const model = genAI.getGenerativeModel(modelConfig);
    const fullMessage = messageText + buildContextFromFiles(files);
    
    let result;
    try {
      if (images && images.length > 0) {
        const parts: any[] = [{ text: fullMessage || "Describe these images" }];
        for (const img of images) {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }
        result = await model.generateContent(parts);
      } else {
        const history = currentMessages.filter(m => !m.error && !(isRetry && m.role === "user" && m.content === originalUserMessage)).map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }));
        const chat = model.startChat({ history });
        result = await chat.sendMessage(fullMessage);
      }
    } catch (error: any) {
      console.error("API Error:", {
        message: error.message,
        status: error.status,
        details: error,
        model: modelName,
        errorType: getErrorType(error)
      });
      throw error;
    }

    const response = await result.response;
    const text = cleanMarkdown(response.text());
    const sources: { title: string; url: string }[] = [];
    const searchImages: string[] = [];

    const candidate = response.candidates?.[0];
    if (candidate?.groundingMetadata) {
      const chunks = candidate.groundingMetadata.groundingChunks || [];
      for (const chunk of chunks) {
        if (chunk.web) {
          const title = chunk.web.title || chunk.web.uri || "Source";
          const url = chunk.web.uri;
          if (url) {
            sources.push({ title, url });
          }
        }
        if (chunk.image) {
          const imgUrl = chunk.image.uri || chunk.image.base64;
          if (imgUrl) searchImages.push(imgUrl);
        }
      }
    }

    return { text, model: modelName, sources, searchImages };
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

  const sendMessage = async (messageText: string, images: UploadedImage[], files: UploadedFile[], retryModelIndex: number = 0, isRetry: boolean = false) => {
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
      } catch (error: any) {
        const friendlyError = getErrorMessage(error);
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: "bot", 
          content: friendlyError, 
          model: "pollinations", 
          timestamp: new Date(), 
          error: true,
          errorDetails: error.message 
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
    } catch (error: any) {
      const errorType = getErrorType(error);
      const friendlyError = getErrorMessage(error);
      
      const isServiceUnavailable = errorType === "SERVICE_UNAVAILABLE" || error.message?.includes("503");
      const isRateLimit = errorType === "RATE_LIMIT" || error.message?.includes("429");
      
      if ((isServiceUnavailable || isRateLimit) && retryModelIndex < AVAILABLE_MODELS.length - 1) {
        const nextModel = AVAILABLE_MODELS[retryModelIndex + 1];
        setSelectedModel(nextModel);
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
    await sendMessage(userMsg.content, recoveredImages, recoveredFiles, 0, true);
  };

  const copyMessage = (content: string) => navigator.clipboard.writeText(content);
  
  const clearChat = () => { 
    setMessages([]); 
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
      <GeminiAuthModal isOpen={showAuthModal} onSave={saveApiKey} onClose={closeModal} />
      {isConfigured && (
        <div className="aichat-container">
          <div className="aichat-messages" ref={scrollRef}>
            {!messages.length && (
              <div className="aichat-welcome">
                <div className="aichat-welcome-icon"><Sparkles size={56} /></div>
                <h3>Hello, {userDisplayName}!</h3>
                <p>Ask me anything or upload files</p>
              </div>
            )}
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`aichat-message ${msg.role === "user" ? "user" : "bot"}`}>
                  {msg.role === "user" && <div className="aichat-user-avatar">{userAvatar ? <img src={userAvatar} alt="Avatar" /> : <User size={24} />}</div>}
                  <div className="aichat-message-content">
                    {msg.role === "user" && <div className="aichat-username">{userDisplayName}</div>}
                    {msg.role === "bot" && (
                      <div className="aichat-bot-header">
                        <div className="aichat-bot-header-left">
                          <span className="aichat-model-name">
                            {msg.model === 'pollinations' ? 'Pollinations' : (msg.model || selectedModel)}
                          </span>
                          {msg.error && (
                            <button 
                              onClick={() => retryMessage(msg.id)} 
                              className="aichat-retry-btn-header"
                              title="Retry with same model"
                            >
                              <RefreshCw size={12} /> Retry
                            </button>
                          )}
                        </div>
                        {!msg.imageData && (
                          <div className="aichat-bot-actions">
                            <button 
                              onClick={() => {
                                const textToSpeak = msg.error ? getFullErrorText(msg) : msg.content;
                                speakText(textToSpeak, msg.id);
                              }} 
                              className="aichat-speak-btn"
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
                              className="aichat-copy-btn"
                              title={msg.error ? "Copy error message" : "Copy"}
                            >
                              <Copy size={14} /> Copy
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {msg.role === "user" && msg.images && msg.images.length > 0 && (
                      <div className="aichat-message-images">
                        {msg.images.map((img, idx) => (
                          <div key={idx} className="aichat-message-image">
                            <img src={`data:${img.mimeType};base64,${img.data}`} alt={`Uploaded ${idx + 1}`} />
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.role === "bot" && msg.imageData && msg.model?.startsWith("pollinations") && (
                      <img
                        src={msg.imageData}
                        alt="Generated"
                        className="aichat-generated-image"
                        onClick={() => window.open(msg.imageData, "_blank")}
                      />
                    )}
                    {msg.files && msg.files.length > 0 && (
                      <div className="aichat-message-files">
                        {msg.files.map((f, idx) => (
                          <div key={idx} className="file-chip"><FileText size={14} /> {f.name}</div>
                        ))}
                      </div>
                    )}
                    {!(msg.role === "bot" && msg.model?.startsWith("pollinations") && msg.imageData) && (
                      <>
                        {msg.role === "bot" ? (
                          msg.error ? (
                            <div className="aichat-message-bubble error-bubble">
                              <div className="aichat-error-content">
                                {msg.content}
                                {msg.errorDetails && (
                                  <div className="aichat-error-details">
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
                                      <div key={index} className="aichat-code-block-wrapper">
                                        <CodeBlock language={part.language || ''} code={part.content} />
                                      </div>
                                    );
                                  } else if (part.type === 'table') {
                                    return <TableBlock key={index} content={part.content} />;
                                  } else {
                                    return (
                                      <div key={index} className="aichat-message-bubble">
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
                          <div className="aichat-message-bubble aichat-user-bubble">
                            <p className="aichat-user-text">{msg.content}</p>
                          </div>
                        )}
                      </>
                    )}
                    {msg.role === "bot" && msg.searchImages && msg.searchImages.length > 0 && (
                      <div className="aichat-search-images">
                        {msg.searchImages.map((url, idx) => (
                          <img key={idx} src={url} alt={`Search result ${idx+1}`} className="aichat-search-image" />
                        ))}
                      </div>
                    )}
                    {msg.role === "bot" && msg.sources && msg.sources.length > 0 && (
                      <div className="aichat-sources">
                        <button 
                          className="aichat-sources-toggle"
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
                        <ul className={`aichat-sources-list ${sourcesVisibility[`sources_${msg.id}`] ? 'open' : ''}`}>
                          {msg.sources.map((src, idx) => (
                            <li key={idx}>
                              <a href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="aichat-message-footer">
                      {msg.role === "user" && <><span className="aichat-location"><MapPin size={12} /> {userLocation}</span><span className="aichat-time">{formatTime(msg.timestamp)}{!isToday(msg.timestamp) && ` • ${formatDate(msg.timestamp)}`}</span></>}
                      {msg.role === "bot" && <span className="aichat-time">{formatTime(msg.timestamp)}{!isToday(msg.timestamp) && ` • ${formatDate(msg.timestamp)}`}</span>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="aichat-typing">
                <div className="aichat-typing-content">
                  <div className="aichat-typing-header"><span>{selectedModel}</span><div className="aichat-typing-dots"><span></span><span></span><span></span></div></div>
                </div>
              </div>
            )}
          </div>

          {(uploadedImages.length > 0 || uploadedFiles.length > 0) && (
            <div className="aichat-previews">
              {uploadedImages.map((img, idx) => (
                <div key={`img-${idx}`} className="aichat-image-preview">
                  <img src={img.preview} alt={`Preview ${idx + 1}`} />
                  <button onClick={() => removeImage(idx)} className="aichat-image-remove"><X size={16} /></button>
                </div>
              ))}
              {uploadedFiles.map((file, idx) => (
                <div key={`file-${idx}`} className="aichat-file-preview">
                  <FileText size={14} />
                  <span>{file.name.length > 30 ? file.name.substring(0,27)+"..." : file.name}</span>
                  <button onClick={() => removeFile(idx)}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="aichat-input-container">
            <textarea
              ref={textareaRef}
              className="aichat-input-textarea"
              placeholder={totalUploads > 0 ? `Message with ${totalUploads} attachment(s)...` : "Type a message..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={1}
              style={{ overflowY: textareaOverflow }}
            />
            <div className="aichat-input-buttons">
              <div className="aichat-input-buttons-left">
                <div className="aichat-upload-wrapper" ref={uploadDropdownRef}>
                  <button className="aichat-icon-btn" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setUploadDropdownPos(calcDropdownPos(r, 160, 150)); setIsUploadDropdownOpen(!isUploadDropdownOpen); }}><Plus size={24} /></button>
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
                <div className="aichat-model-wrapper" ref={modelDropdownRef}>
                  <button className="aichat-icon-btn" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setModelDropdownPos(calcDropdownPos(r, 220, 260)); setIsModelDropdownOpen(!isModelDropdownOpen); }}><Bot size={24} /></button>
                  {isModelDropdownOpen && (
                    <div
                      className="model-dropdown-menu"
                      style={{
                        position: "fixed",
                        bottom: modelDropdownPos.bottom,
                        left: modelDropdownPos.left,
                        maxHeight: modelDropdownPos.maxHeight,
                      }}
                    >
                      {AVAILABLE_MODELS.map(model => (
                        <button key={model} className={model === selectedModel ? 'active' : ''} onClick={() => { setSelectedModel(model); setIsModelDropdownOpen(false); }}>
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button 
                  className={`aichat-icon-btn globe-btn${webSearchEnabled ? " web-search-active" : ""}`} 
                  onClick={() => setWebSearchEnabled(v => !v)} 
                  title={webSearchEnabled ? "Web Search ON" : "Web Search OFF"}
                >
                  <Globe size={22} />
                </button>
                <button 
                  className={`aichat-icon-btn wand2-btn${imageGenEnabled ? " image-gen-active" : ""}`} 
                  onClick={() => setImageGenEnabled(v => !v)} 
                  title={imageGenEnabled ? "Image Gen ON" : "Image Gen OFF"}
                >
                  <Wand2 size={22} />
                </button>
                <button onClick={clearChat} className="aichat-clear-btn"><Trash2 size={22} /></button>
              </div>
              <button onClick={handleSendMessage} disabled={isLoading || (!input.trim() && !uploadedImages.length && !uploadedFiles.length)} className="aichat-send-btn">
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

export default AIChat;