// src/react/feature/aichat.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Trash2, Volume2, VolumeX, AlertCircle } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useGemini } from "@hook/usegemini";
import { GeminiAuthModal } from "./geminiauthmodal";
import Loading from "@control/loading";

// Daftar model dari yang paling irit quota ke yang berat
const AVAILABLE_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite", 
  "gemini-2.5-flash",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite-001",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
];

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  model?: string;
  timestamp: Date;
}

// Deteksi bahasa sederhana dan aman
const detectLanguage = (text: string): "id" | "en" => {
  const hasIndonesianChar = /[àáâãäåçèéêëìíîïñòóôõøùúûüýÿ]/i.test(text);
  const indonesianWords = ["yang", "dan", "atau", "ini", "itu", "saya", "kamu", "kita", "mereka", "bisa", "tidak", "ada", "untuk", "dengan", "dari", "ke", "pada", "akan", "sudah", "belum", "jika", "karena", "jadi", "tapi", "saja", "pernah", "boleh", "harus", "mau", "sangat", "senang", "sedih", "marah", "takut"];
  const lowerText = text.toLowerCase();
  const hasIndonesianWord = indonesianWords.some(word => lowerText.includes(word));
  return (hasIndonesianChar || hasIndonesianWord) ? "id" : "en";
};

const AIChat: React.FC = () => {
  const { isConfigured, showAuthModal, saveApiKey, closeModal, isLoading: authLoading } = useGemini();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    speechSynthRef.current = window.speechSynthesis;
    return () => speechSynthRef.current?.cancel();
  }, []);

  const speakText = (text: string, messageId: string) => {
    if (!speechSynthRef.current) return;
    if (isSpeaking && currentSpeakingId === messageId) {
      speechSynthRef.current.cancel();
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
      return;
    }
    if (isSpeaking) {
      speechSynthRef.current.cancel();
    }
    const language = detectLanguage(text);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "id" ? "id-ID" : "en-US";
    utterance.rate = 0.9;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setCurrentSpeakingId(messageId);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
    };
    speechSynthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    speechSynthRef.current?.cancel();
    setIsSpeaking(false);
    setCurrentSpeakingId(null);
  };

  // Fungsi untuk mencoba berbagai model jika kena rate limit
  const sendWithFallback = async (userInput: string, history: any[], attemptIndex: number = 0): Promise<{text: string, model: string}> => {
    const modelName = AVAILABLE_MODELS[attemptIndex];
    if (!modelName) throw new Error("All models failed");

    try {
      const apiKey = localStorage.getItem("gemini_api_key");
      if (!apiKey) throw new Error("No API key");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userInput);
      return { text: result.response.text(), model: modelName };
    } catch (error: any) {
      const isRateLimit = error.message?.includes("429") || error.message?.includes("quota");
      if (isRateLimit && attemptIndex < AVAILABLE_MODELS.length - 1) {
        setErrorMessage(`Model ${modelName} is busy, switching to ${AVAILABLE_MODELS[attemptIndex + 1]}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return sendWithFallback(userInput, history, attemptIndex + 1);
      }
      throw error;
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !isConfigured) return;
    setErrorMessage(null);
    setIsLoading(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input;
    setInput("");

    try {
      const history = messages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      const response = await sendWithFallback(currentInput, history, 0);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: response.text,
        model: response.model,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      speakText(response.text, botMsg.id);
      setErrorMessage(null);
    } catch (error: any) {
      console.error("Chat error:", error);
      let errorContent = "Sorry, something went wrong. Please try again later.";
      if (error.message?.includes("429")) {
        errorContent = "⚠️ API quota exceeded. Please wait a few minutes or try a different API key.";
      } else if (error.message?.includes("API key")) {
        errorContent = "⚠️ Invalid API key. Please check your Gemini API key in settings.";
      }
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: errorContent,
        model: "Error",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setErrorMessage(errorContent);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (authLoading) return <Loading />;

  return (
    <>
      <GeminiAuthModal isOpen={showAuthModal} onSave={saveApiKey} onClose={closeModal} />
      {isConfigured && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--bg)",
        }}>
          {/* Header */}
          <div style={{
            flexShrink: 0,
            padding: "80px 16px 16px",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg)",
            zIndex: 1,
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              maxWidth: "1000px",
              margin: "0 auto",
              width: "100%",
            }}>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  background: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--border-color)",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  padding: "6px 24px 6px 10px",
                  cursor: "pointer",
                  outline: "none",
                  fontFamily: "monospace",
                  borderRadius: "20px",
                }}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model} value={model} style={{ background: "var(--card-bg)" }}>{model}</option>
                ))}
              </select>
              <button
                onClick={() => { setMessages([]); stopSpeaking(); setErrorMessage(null); }}
                style={{ background: "none", border: "none", color: "var(--text-sub)", cursor: "pointer", padding: 8, borderRadius: "50%" }}
                aria-label="Clear chat"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              maxWidth: "1000px",
              width: "100%",
              margin: "0 auto",
              boxSizing: "border-box",
            }}
          >
            {errorMessage && (
              <div style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid #ef4444",
                borderRadius: "12px",
                padding: "12px 16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#ef4444",
                fontSize: "0.8rem",
              }}>
                <AlertCircle size={18} />
                <span>{errorMessage}</span>
              </div>
            )}
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-sub)", textAlign: "center", gap: 12 }}>
                <Bot size={48} strokeWidth={1.5} />
                <p style={{ fontWeight: 500 }}>Start a conversation with Gemini AI</p>
                <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>Select a model from the top right corner</p>
              </div>
            )}
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    marginBottom: 16,
                  }}
                >
                  {msg.role === "bot" && (
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "var(--primary-alpha)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 22,
                      }}
                    >
                      <Bot size={18} color="var(--primary)" />
                    </div>
                  )}
                  <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginBottom: 4 }}>
                      {formatTime(msg.timestamp)}
                      {msg.model && msg.model !== "Error" && <span style={{ marginLeft: 8, opacity: 0.6, fontSize: "0.55rem" }}>{msg.model}</span>}
                    </div>
                    <div
                      style={{
                        backgroundColor: msg.role === "user" ? "var(--primary)" : "var(--bg)",
                        color: msg.role === "user" ? "#fff" : "var(--text)",
                        padding: "10px 14px",
                        borderRadius: msg.role === "user" ? "20px 20px 4px 20px" : "4px 20px 20px 20px",
                        border: msg.role === "bot" ? "1px solid var(--border-color)" : "none",
                        wordWrap: "break-word",
                        fontSize: "0.9rem",
                        lineHeight: 1.45,
                      }}
                    >
                      {msg.content}
                    </div>
                    {msg.role === "bot" && msg.model !== "Error" && (
                      <button
                        onClick={() => speakText(msg.content, msg.id)}
                        style={{ background: "none", border: "none", marginTop: 6, cursor: "pointer", color: "var(--text-sub)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.65rem", width: "fit-content", padding: "4px 8px", borderRadius: 12 }}
                        aria-label="Read aloud"
                      >
                        {isSpeaking && currentSpeakingId === msg.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        <span>{isSpeaking && currentSpeakingId === msg.id ? "Stop" : "Read"}</span>
                      </button>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "var(--primary-alpha)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 22,
                      }}
                    >
                      <User size={18} color="var(--primary)" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
                <div className="status-spinner" style={{ width: 14, height: 14 }} />
                <span style={{ fontSize: "0.7rem", color: "var(--text-sub)" }}>AI is thinking...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            flexShrink: 0,
            padding: "16px",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--bg)",
          }}>
            <div style={{
              display: "flex",
              gap: 12,
              maxWidth: "1000px",
              margin: "0 auto",
              width: "100%",
            }}>
              <input
                type="text"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                style={{
                  flex: 1,
                  padding: "14px 18px",
                  borderRadius: 40,
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--card-bg)",
                  color: "var(--text)",
                  outline: "none",
                  fontSize: "0.9rem",
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 40,
                  border: "none",
                  backgroundColor: "var(--primary)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isLoading || !input.trim() ? 0.6 : 1,
                }}
                aria-label="Send message"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChat;