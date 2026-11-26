import { getAuth } from "./firebase";
import { AI_AGENT_API_BASE } from "./api";

export interface AgentMemoryEntry {
  id: string;
  text: string;
  source: "ai" | "user" | string;
  createdAt?: string | null;
}

export interface AgentMemoryState {
  instructions: string;
  memories: AgentMemoryEntry[];
}

interface AgentMemoryResponse {
  success?: boolean;
  data?: { instructions?: string; memories?: AgentMemoryEntry[] };
  instructions?: string;
  memory?: AgentMemoryEntry;
  deleted?: boolean;
  detail?: string;
}

const getAuthenticatedUser = async () => {
  const firebaseAuth = await getAuth();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Sign in to manage this account's AI memory.");
  return { user, idToken: await user.getIdToken(true) };
};

const requestMemory = async (
  idToken: string,
  path: string,
  method: "GET" | "PUT" | "POST" | "DELETE",
  body?: Record<string, string>,
): Promise<AgentMemoryResponse> => {
  const response = await fetch(`${AI_AGENT_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as AgentMemoryResponse;
  if (!response.ok) throw new Error(data.detail || `AI memory request failed (${response.status})`);
  return data;
};

export const loadAgentMemory = async (): Promise<AgentMemoryState> => {
  const { idToken } = await getAuthenticatedUser();
  const data = await requestMemory(idToken, "/agent/memory", "GET");
  return {
    instructions: typeof data.data?.instructions === "string" ? data.data.instructions : "",
    memories: Array.isArray(data.data?.memories) ? data.data.memories : [],
  };
};

export const saveAgentInstructions = async (instructions: string): Promise<string> => {
  const { idToken } = await getAuthenticatedUser();
  const data = await requestMemory(idToken, "/agent/memory/instructions", "PUT", {
    instructions: instructions.trim(),
  });
  if (typeof data.instructions !== "string") {
    throw new Error("The saved instructions were not returned.");
  }
  return data.instructions;
};

export const addAgentMemory = async (text: string): Promise<AgentMemoryEntry> => {
  const { idToken } = await getAuthenticatedUser();
  const data = await requestMemory(idToken, "/agent/memory/memories", "POST", {
    text: text.trim(),
  });
  if (!data.memory || typeof data.memory.id !== "string") {
    throw new Error("The saved memory was not returned.");
  }
  return data.memory;
};

export const deleteAgentMemory = async (memoryId: string): Promise<void> => {
  const { idToken } = await getAuthenticatedUser();
  await requestMemory(idToken, `/agent/memory/memories/${encodeURIComponent(memoryId)}`, "DELETE");
};
