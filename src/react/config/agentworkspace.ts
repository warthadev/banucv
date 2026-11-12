import { AI_AGENT_API_BASE } from "./api";
import { getAuth } from "./firebase";

export interface WorkspaceInfo {
  uid: string;
  owner: boolean;
  storage: "per-user";
}

export interface WorkspaceEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  modified: number;
}

export interface WorkspaceFile {
  path: string;
  name: string;
  mimeType: string;
  isText: boolean;
  text: string | null;
  dataBase64: string;
  size: number;
}

export interface OwnerHostTextFile {
  path: string;
  name: string;
  mimeType: string;
  isText: true;
  text: string;
  size: number;
}

export interface PackageRecord {
  id: string;
  package: string;
  status: string;
  requestedAt?: number;
  reviewedAt?: number;
  uid?: string;
}

export interface HostActionPreview {
  confirmationRequired: true;
  actionId: string;
  action: Record<string, string>;
  expiresAt: number;
}

const apiRequest = async <T>(path: string, expectedUid: string, init: RequestInit = {}): Promise<T> => {
  const auth = await getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to access this workspace");
  if (user.uid !== expectedUid) throw new Error("The signed-in account changed before this workspace request");
  const idToken = await user.getIdToken(true);
  if (auth.currentUser?.uid !== expectedUid) throw new Error("The signed-in account changed before this workspace request");
  const response = await fetch(`${AI_AGENT_API_BASE}/agent/workspace${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const record = typeof result === "object" && result !== null ? result as Record<string, unknown> : {};
    const detail = record.detail;
    const message = typeof detail === "string" ? detail : `Workspace request failed (${response.status})`;
    throw new Error(message);
  }
  return result as T;
};

export const getWorkspaceInfo = (uid: string) => apiRequest<WorkspaceInfo>("", uid);

export const listWorkspaceFiles = (path: string, uid: string) =>
  apiRequest<{ path: string; entries: WorkspaceEntry[] }>(`/files?path=${encodeURIComponent(path)}`, uid);

export const readWorkspaceFile = (path: string, uid: string) =>
  apiRequest<WorkspaceFile>(`/file?path=${encodeURIComponent(path)}`, uid);

export const listOwnerHostFiles = (path: string, uid: string) =>
  apiRequest<{ path: string; entries: WorkspaceEntry[] }>(`/admin/host/files?path=${encodeURIComponent(path)}`, uid);

export const readOwnerHostFile = (path: string, uid: string) =>
  apiRequest<OwnerHostTextFile>(`/admin/host/file?path=${encodeURIComponent(path)}`, uid);

export const writeWorkspaceFile = (path: string, content: string, uid: string) =>
  apiRequest<{ success: boolean; path: string; size: number }>(`/file?path=${encodeURIComponent(path)}`, uid, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });

export const moveWorkspaceFile = (source: string, destination: string, uid: string) =>
  apiRequest<{ success: boolean; source: string; destination: string }>("/move", uid, {
    method: "POST",
    body: JSON.stringify({ source, destination }),
  });

export const deleteWorkspaceFile = (path: string, uid: string) =>
  apiRequest<{ success: boolean; path: string }>(`/file?path=${encodeURIComponent(path)}`, uid, { method: "DELETE" });

export const listWorkspacePackages = (uid: string) =>
  apiRequest<{ requests: PackageRecord[]; sharedPackages: string[] }>("/packages", uid);

export const requestWorkspacePackage = (pkg: string, uid: string) =>
  apiRequest<{ request: PackageRecord }>("/packages", uid, { method: "POST", body: JSON.stringify({ package: pkg }) });

export const listAdminPackageRequests = (uid: string) =>
  apiRequest<{ requests: PackageRecord[]; sharedPackages: string[] }>("/admin/packages", uid);

export const reviewAdminPackageRequest = (targetUid: string, requestId: string, decision: "approve" | "reject", uid: string) =>
  apiRequest<{ request: PackageRecord; sharedImageChanged: boolean }>("/admin/packages/review", uid, {
    method: "POST",
    body: JSON.stringify({ target_uid: targetUid, request_id: requestId, decision }),
  });

export const listLocalModelInventory = (uid: string) =>
  apiRequest<{ models: string[] }>("/admin/models/local", uid);

export const updateLocalModelInventory = (model: string, action: "add" | "remove", uid: string) =>
  apiRequest<{ models: string[]; ollamaChanged: boolean }>("/admin/models/local", uid, {
    method: "POST",
    body: JSON.stringify({ model, action }),
  });

export const confirmHostAction = (actionId: string, uid: string) =>
  apiRequest<{ success: boolean; message?: string; exitCode?: number; output?: string }>("/host-actions/confirm", uid, {
    method: "POST",
    body: JSON.stringify({ action_id: actionId }),
  });
