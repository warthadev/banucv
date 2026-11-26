import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { AlertCircle, Brain, CheckCircle, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { getAuth } from "@config/firebase";
import {
  addAgentMemory,
  deleteAgentMemory,
  loadAgentMemory,
  saveAgentInstructions,
  type AgentMemoryEntry,
} from "@config/agentmemory";

interface SettingMemoryProps {
  onLoadingChange?: (isLoading: boolean) => void;
}

const ignoreLoadingChange = () => {};

interface SaveFeedback {
  status: "saved" | "error";
  message: string;
}

const SettingMemory: React.FC<SettingMemoryProps> = ({ onLoadingChange = ignoreLoadingChange }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [memories, setMemories] = useState<AgentMemoryEntry[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SaveFeedback | null>(null);
  const requestIdRef = useRef(0);

  useLayoutEffect(() => {
    onLoadingChange(!authReady || loading);
  }, [authReady, loading, onLoadingChange]);

  const refresh = useCallback(async (user: User | null) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSettingsError(null);
    if (!user) {
      setInstructions("");
      setMemories([]);
      setLoading(false);
      return;
    }
    try {
      const saved = await loadAgentMemory();
      if (requestId !== requestIdRef.current) return;
      setInstructions(saved.instructions);
      setMemories(saved.memories);
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setInstructions("");
        setMemories([]);
        setSettingsError(error instanceof Error ? error.message : "Unable to load AI memory.");
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    let disposed = false;
    getAuth().then((firebaseAuth) => {
      if (disposed) return;
      unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        setCurrentUser(user);
        setAuthReady(true);
        void refresh(user);
      });
    }).catch((error: unknown) => {
      setAuthReady(true);
      setLoading(false);
      setSettingsError(error instanceof Error ? error.message : "Firebase authentication is unavailable.");
    });
    return () => {
      disposed = true;
      requestIdRef.current += 1;
      unsubscribe();
    };
  }, [refresh]);

  const handleSaveInstructions = async () => {
    setSavingInstructions(true);
    setFeedback(null);
    try {
      const saved = await saveAgentInstructions(instructions);
      setInstructions(saved);
      setFeedback({ status: "saved", message: "Instructions saved. The AI will follow them in every chat." });
    } catch (error) {
      setFeedback({ status: "error", message: error instanceof Error ? error.message : "Could not save instructions." });
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleAddMemory = async () => {
    const text = newMemory.trim();
    if (!text) return;
    setAddingMemory(true);
    setFeedback(null);
    try {
      const saved = await addAgentMemory(text);
      setMemories((current) => [saved, ...current]);
      setNewMemory("");
      setFeedback({ status: "saved", message: "Memory saved." });
    } catch (error) {
      setFeedback({ status: "error", message: error instanceof Error ? error.message : "Could not save memory." });
    } finally {
      setAddingMemory(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    setDeletingId(memoryId);
    setFeedback(null);
    try {
      await deleteAgentMemory(memoryId);
      setMemories((current) => current.filter((entry) => entry.id !== memoryId));
    } catch (error) {
      setFeedback({ status: "error", message: error instanceof Error ? error.message : "Could not delete memory." });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <section className="stack-item settings-service-section setting-memory-card global-card global-section global-card--padded" aria-label="AI Memory" aria-busy="true">
        <div className="setting-agent-loading global-inline-row global-inline-row--gap-8" role="status" aria-label="Loading AI memory">
          <LoaderCircle size={18} className="setting-agent-spinner" />
        </div>
      </section>
    );
  }

  return (
    <section className="stack-item settings-service-section setting-memory-card global-card global-section global-card--padded" aria-label="AI Memory">
      {!currentUser ? (
        <p className="setting-agent-note" role="status">Sign in to your Firebase account to manage its AI memory.</p>
      ) : (
        <>
          <div className="su-profile-card setting-agent-safe-status global-inline-row global-inline-row--gap-8">
            <Brain size={17} aria-hidden="true" />
            <span>
              AI Memory
              <small>The AI remembers this in every chat — Cloud and Local. Delete anything it should forget.</small>
            </span>
          </div>

          {settingsError && (
            <p className="setting-agent-error global-inline-row global-inline-row--gap-8" role="alert"><AlertCircle size={15} /> AI memory warning: {settingsError}</p>
          )}

          <div className="setting-agent-form">
            <label className="setting-agent-label" htmlFor="setting-ai-instructions">
              Instructions for the AI
            </label>
            <textarea
              id="setting-ai-instructions"
              className="setting-agent-input"
              name="ai-instructions"
              value={instructions}
              onChange={(event) => {
                setInstructions(event.target.value);
                setFeedback(null);
              }}
              placeholder="Example: Always answer in Indonesian. I am a programmer building Wartha Sensei."
              rows={3}
              maxLength={2000}
              spellCheck={false}
            />
            <p className="setting-agent-note">Saved instructions are sent to the AI in every chat. Max 2000 characters.</p>
          </div>

          <div className="settings-section-actions">
            <button
              className="setting-agent-primary settings-section-save-btn"
              type="button"
              onClick={() => void handleSaveInstructions()}
              disabled={savingInstructions}
            >
              {savingInstructions ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Save size={16} aria-hidden="true" />}
              {savingInstructions ? "Saving…" : "Save instructions"}
            </button>
          </div>

          <div className="setting-agent-form">
            <label className="setting-agent-label" htmlFor="setting-ai-memory-new">
              Memories ({memories.length}/50)
            </label>
            {memories.length === 0 ? (
              <p className="setting-agent-note">No memories yet. The AI saves facts it should remember with its remember tool, or add one yourself below.</p>
            ) : (
              <div>
                {memories.map((entry) => (
                  <div className="su-list-item" key={entry.id}>
                    <span>{entry.text}</span>
                    <span className="setting-agent-note">{entry.source === "ai" ? "Saved by AI" : "Saved by you"}</span>
                    <button
                      className="global-icon-button"
                      type="button"
                      onClick={() => void handleDeleteMemory(entry.id)}
                      disabled={deletingId === entry.id}
                      aria-label={`Delete memory: ${entry.text}`}
                      title="Delete this memory"
                    >
                      {deletingId === entry.id ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Trash2 size={16} aria-hidden="true" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="su-list-item">
              <input
                id="setting-ai-memory-new"
                className="setting-agent-input"
                type="text"
                name="ai-memory-new"
                value={newMemory}
                onChange={(event) => {
                  setNewMemory(event.target.value);
                  setFeedback(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleAddMemory();
                  }
                }}
                placeholder="Add a memory, e.g. I like black coffee"
                maxLength={500}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="global-icon-button"
                type="button"
                onClick={() => void handleAddMemory()}
                disabled={addingMemory || !newMemory.trim()}
                aria-label="Add memory"
                title="Add memory"
              >
                {addingMemory ? <LoaderCircle size={16} className="setting-agent-spinner" /> : <Plus size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {feedback && (
            <p
              className={`settings-save-feedback${feedback.status === "error" ? " is-error" : ""}`}
              role={feedback.status === "error" ? "alert" : "status"}
              aria-live={feedback.status === "error" ? "assertive" : "polite"}
            >
              {feedback.status === "error"
                ? <AlertCircle size={15} aria-hidden="true" />
                : <CheckCircle size={15} aria-hidden="true" />}
              <span>{feedback.message}</span>
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default SettingMemory;
