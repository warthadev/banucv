// src/react/config/githubeditorhelper.ts
import { Octokit } from "octokit";
import { db, auth } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFileExtension } from "./utils";

export interface GithubCredentials {
  githubUsername: string;
  githubToken: string;
  updatedAt?: Date;
  uid?: string;
}

export interface GithubRepo {
  name: string;
  full_name?: string;
  description?: string;
  private?: boolean;
  id: number;
  _isTemp?: boolean;
  [key: string]: unknown;
}

export interface GithubEditingFile {
  path: string;
  content: string;
  sha: string;
}

export const GITHUB_KEY_UPDATED_EVENT = "githubKeyUpdated";

export const saveGithubCredentials = async (username: string, token: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const credentials: GithubCredentials = {
    githubUsername: username,
    githubToken: token,
    updatedAt: new Date(),
    uid: user.uid,
  };

  await setDoc(doc(db, "users", user.uid), credentials, { merge: true });
  
  return credentials;
};

export const loadGithubCredentials = async (): Promise<GithubCredentials | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const docRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data() as GithubCredentials;
    if (data.githubUsername && data.githubToken) {
      return data;
    }
  }
  
  return null;
};

export const getGithubCredentials = async (): Promise<GithubCredentials | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  
  const firestoreData = await loadGithubCredentials();
  if (firestoreData) {
    return firestoreData;
  }
  
  return null;
};

export const clearGithubCredentials = () => {
  currentUsername = "";
  currentToken = "";
  currentOctokit = null;
};

let currentUsername = "";
let currentToken = "";
let currentOctokit: Octokit | null = null;

export const setGithubCredentials = (username: string, token: string) => {
  currentUsername = username;
  currentToken = token;
  currentOctokit = new Octokit({ auth: token });
};

export const getOctokit = (): Octokit => {
  if (!currentOctokit) {
    throw new Error("GitHub credentials not set. Please login first.");
  }
  return currentOctokit;
};

export const isConfigured = (): boolean => {
  return !!currentUsername && !!currentToken;
};

export const refreshOctokit = () => {
  if (currentToken) {
    currentOctokit = new Octokit({ auth: currentToken });
  }
};

export interface GithubItem {
  name: string;
  path: string;
  sha: string;
  type: "dir" | "file";
  size?: number;
  _isTemp?: boolean;
}

export interface ItemTarget {
  type: "repo" | "file" | "folder";
  name: string;
  path?: string;
  sha?: string;
}

export const isImageFile = (filename: string): boolean => {
  const ext = getFileExtension(filename).toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext);
};

export const isTextFile = (filename: string): boolean => {
  const ext = getFileExtension(filename).toLowerCase();
  const textExts = [
    "txt", "md", "json", "js", "ts", "jsx", "tsx",
    "css", "scss", "html", "xml", "yml", "yaml",
    "py", "rb", "go", "rs", "php", "java", "c", "cpp",
    "h", "hpp", "cs", "sql", "sh", "bash"
  ];
  return textExts.includes(ext);
};

export const sortItems = (items: GithubItem[]): GithubItem[] => {
  return [...items].sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "dir" ? -1 : 1;
  });
};

export const encodeContent = (content: string): string => {
  return btoa(unescape(encodeURIComponent(content)));
};

export const decodeContent = (encoded: string): string => {
  return decodeURIComponent(escape(atob(encoded)));
};

export const getLanguage = (filename: string): string => {
  const ext = getFileExtension(filename);
  const map: Record<string, string> = {
    js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
    css: "css", scss: "css", json: "json", md: "markdown",
    py: "python", rs: "rust", go: "go", rb: "ruby",
    php: "php", java: "java", c: "c", cpp: "cpp",
    cs: "csharp", sh: "bash", yml: "yaml", sql: "sql",
    html: "markup", xml: "markup", txt: "text",
  };
  return map[ext] || "text";
};

export const fetchReposAPI = async (): Promise<GithubRepo[]> => {
  const octokit = getOctokit();
  const res = await octokit.request("GET /user/repos", {
    sort: "updated",
    per_page: 100,
    direction: "desc",
    timestamp: Date.now(),
  } as Parameters<typeof octokit.request>[1]);
  return res.data as GithubRepo[];
};

export const fetchContentsAPI = async (repo: string, path: string) => {
  const octokit = getOctokit();
  let res;
  if (!path || path === "" || path === "/") {
    res = await octokit.request(
      "GET /repos/{owner}/{repo}/contents",
      { owner: currentUsername, repo }
    );
  } else {
    res = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      { owner: currentUsername, repo, path }
    );
  }
  const data = Array.isArray(res.data) ? res.data : [res.data];
  return sortItems(data as GithubItem[]);
};

export const fetchFileContentAPI = async (repo: string, path: string) => {
  const octokit = getOctokit();
  const res = await octokit.request(
    "GET /repos/{owner}/{repo}/contents/{path}",
    { owner: currentUsername, repo, path }
  );
  const fileData = res.data as { content: string; sha: string };
  return {
    content: decodeContent(fileData.content),
    sha: fileData.sha,
  };
};

export const saveFileAPI = async (repo: string, path: string, content: string, sha: string): Promise<string | undefined> => {
  const octokit = getOctokit();
  const res = await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner: currentUsername,
    repo,
    path,
    message: `update ${path}`,
    content: encodeContent(content),
    sha,
  });
  // The response already carries the new blob sha, so no extra GET is needed.
  return (res.data as { content?: { sha?: string } }).content?.sha;
};

export const createFileAPI = async (repo: string, path: string, content: string) => {
  const octokit = getOctokit();
  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner: currentUsername,
    repo,
    path,
    message: `create ${path}`,
    content: encodeContent(content),
  });
};

export const createFolderAPI = async (repo: string, path: string) => {
  const octokit = getOctokit();
  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner: currentUsername,
    repo,
    path: `${path}/.gitkeep`,
    message: `create folder ${path}`,
    content: btoa(""),
  });
};

export const deleteFileAPI = async (repo: string, path: string, sha: string) => {
  const octokit = getOctokit();
  await octokit.request("DELETE /repos/{owner}/{repo}/contents/{path}", {
    owner: currentUsername,
    repo,
    path,
    message: `delete ${path}`,
    sha,
  });
};

const getDefaultBranch = async (repo: string): Promise<string> => {
  const octokit = getOctokit();
  const res = await octokit.rest.repos.get({
    owner: currentUsername,
    repo,
  });
  return res.data.default_branch;
};

const collectAllPathsInFolder = async (repo: string, folderPath: string): Promise<string[]> => {
  const paths: string[] = [];
  const items = await fetchContentsAPI(repo, folderPath);
  
  for (const item of items) {
    if (item.type === "dir") {
      const subPaths = await collectAllPathsInFolder(repo, item.path);
      paths.push(...subPaths);
    } else {
      paths.push(item.path);
    }
  }
  return paths;
};

export const deleteFolderTreeAPI = async (repo: string, folderPath: string): Promise<void> => {
  const octokit = getOctokit();
  
  const pathsToDelete = await collectAllPathsInFolder(repo, folderPath);
  if (pathsToDelete.length === 0) return;
  
  const defaultBranch = await getDefaultBranch(repo);
  
  const branch = await octokit.rest.repos.getBranch({
    owner: currentUsername,
    repo,
    branch: defaultBranch,
  });
  const latestCommitSha = branch.data.commit.sha;
  
  const latestCommit = await octokit.rest.git.getCommit({
    owner: currentUsername,
    repo,
    commit_sha: latestCommitSha,
  });
  const baseTreeSha = latestCommit.data.tree.sha;
  
  const tree = pathsToDelete.map(path => ({
    path: path,
    mode: '100644' as const,
    type: 'blob' as const,
    sha: null
  }));
  
  const newTree = await octokit.rest.git.createTree({
    owner: currentUsername,
    repo,
    base_tree: baseTreeSha,
    tree: tree,
  });
  
  const newCommit = await octokit.rest.git.createCommit({
    owner: currentUsername,
    repo,
    message: `Delete folder ${folderPath} (${pathsToDelete.length} files) in one commit`,
    tree: newTree.data.sha,
    parents: [latestCommitSha],
  });
  
  await octokit.rest.git.updateRef({
    owner: currentUsername,
    repo,
    ref: `heads/${defaultBranch}`,
    sha: newCommit.data.sha,
    force: false,
  });
};

export const deleteFolderRecursiveAPIFallback = async (repo: string, folderPath: string): Promise<void> => {
  const items = await fetchContentsAPI(repo, folderPath);
  for (const item of items) {
    if (item.type === "dir") {
      await deleteFolderRecursiveAPIFallback(repo, item.path);
    } else {
      await deleteFileAPI(repo, item.path, item.sha);
    }
  }
};

export const deleteFolderRecursiveAPI = async (repo: string, folderPath: string): Promise<void> => {
  try {
    await deleteFolderTreeAPI(repo, folderPath);
  } catch {
    await deleteFolderRecursiveAPIFallback(repo, folderPath);
  }
};

export const renameFileAPI = async (repo: string, oldPath: string, newPath: string, sha: string) => {
  const { content } = await fetchFileContentAPI(repo, oldPath);
  await createFileAPI(repo, newPath, content);
  await deleteFileAPI(repo, oldPath, sha);
};

export const renameFolderRecursiveAPI = async (repo: string, oldPath: string, newPath: string) => {
  const items = await fetchContentsAPI(repo, oldPath);
  for (const item of items) {
    const newItemPath = item.path.replace(oldPath, newPath);
    if (item.type === "dir") {
      await renameFolderRecursiveAPI(repo, item.path, newItemPath);
    } else {
      await renameFileAPI(repo, item.path, newItemPath, item.sha);
    }
  }
};

export const uploadFileAPI = async (repo: string, path: string, content: string) => {
  const octokit = getOctokit();
  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner: currentUsername,
    repo,
    path,
    message: `upload ${path}`,
    content: encodeContent(content),
  });
};

export const updateFileAPI = async (repo: string, path: string, content: string, sha: string) => {
  const octokit = getOctokit();
  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner: currentUsername,
    repo,
    path,
    message: `update ${path}`,
    content: encodeContent(content),
    sha,
  });
};

export const renameRepoAPI = async (oldName: string, newName: string): Promise<GithubRepo> => {
  const octokit = getOctokit();
  const res = await octokit.request("PATCH /repos/{owner}/{repo}", {
    owner: currentUsername,
    repo: oldName,
    name: newName,
  });
  return res.data as GithubRepo;
};

export const deleteRepoAPI = async (repoName: string) => {
  const octokit = getOctokit();
  await octokit.request("DELETE /repos/{owner}/{repo}", {
    owner: currentUsername,
    repo: repoName,
  });
};

export const createRepoAPI = async (name: string, description: string): Promise<GithubRepo> => {
  const octokit = getOctokit();
  const res = await octokit.request("POST /user/repos", {
    name,
    description,
    private: false,
  });
  return res.data as GithubRepo;
};

export const uploadFolderToGitHub = async (
  files: FileList,
  repo: string,
  basePath: string = ""
): Promise<void> => {
  const octokit = getOctokit();
  const promises: Promise<unknown>[] = [];

  for (const file of files) {
    const relativePath = file.webkitRelativePath || file.name;
    const fullPath = basePath ? `${basePath}/${relativePath}` : relativePath;
    const content = await file.text();
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    promises.push(
      octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
        owner: currentUsername,
        repo,
        path: fullPath,
        message: `Upload ${fullPath}`,
        content: encodedContent,
      })
    );
  }

  const batchSize = 10;
  for (let i = 0; i < promises.length; i += batchSize) {
    await Promise.all(promises.slice(i, i + batchSize));
  }
};

// ---------- Fast multi-file commit (Git Data API) ----------
// One blob per file (parallel), then ONE tree + ONE commit + ONE ref update,
// instead of GET + PUT (+ GET) per file with one commit each.

export interface CommitEntry {
  path: string;
  file: File;
}

export interface CommitFilesResult {
  uploaded: Record<string, string>; // path -> blob sha
  failed: string[];
}

const BLOB_CONCURRENCY = 6;

const getStatusCode = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
};

// Read as binary (not text) so images and other non-text files are not corrupted.
const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
};

const mapWithLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await fn(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

export const commitFilesAPI = async (
  repo: string,
  entries: CommitEntry[],
  message: string
): Promise<CommitFilesResult> => {
  const octokit = getOctokit();
  const owner = currentUsername;

  const unique = new Map<string, File>();
  for (const entry of entries) unique.set(entry.path.replace(/^\/+/, ""), entry.file);
  const list = Array.from(unique, ([path, file]) => ({ path, file }));
  if (list.length === 0) throw new Error("No files to upload");

  const branchName = await getDefaultBranch(repo);
  const readBranch = () => octokit.rest.repos.getBranch({ owner, repo, branch: branchName });

  // An empty repository has no branch yet: seed it with the first file via the Contents API.
  let hasBranch = true;
  try {
    await readBranch();
  } catch (error) {
    const code = getStatusCode(error);
    if (code !== 404 && code !== 409) throw error;
    hasBranch = false;
  }

  const seeded: Record<string, string> = {};
  let pending = list;
  if (!hasBranch) {
    const first = list[0];
    const put = await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path: first.path,
      message,
      content: await fileToBase64(first.file),
    });
    seeded[first.path] = (put.data as { content?: { sha?: string } }).content?.sha ?? "";
    pending = list.slice(1);
    if (pending.length === 0) return { uploaded: seeded, failed: [] };
  }

  const blobResults = await mapWithLimit(pending, BLOB_CONCURRENCY, async (item) => {
    const res = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: await fileToBase64(item.file),
      encoding: "base64",
    });
    return res.data.sha;
  });

  const uploaded: Record<string, string> = {};
  const failed: string[] = [];
  let firstError: unknown;
  blobResults.forEach((result, index) => {
    if (result.status === "fulfilled") uploaded[pending[index].path] = result.value;
    else {
      failed.push(pending[index].path);
      if (firstError === undefined) firstError = result.reason;
    }
  });
  const paths = Object.keys(uploaded);
  if (paths.length === 0) throw firstError ?? new Error("Upload failed");

  // Tree + commit + ref. Retry once if the branch moved while the blobs were uploading.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const branch = await readBranch();
      const latestCommitSha = branch.data.commit.sha;
      const tree = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: branch.data.commit.commit.tree.sha,
        tree: paths.map((path) => ({
          path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: uploaded[path],
        })),
      });
      const commit = await octokit.rest.git.createCommit({
        owner,
        repo,
        message,
        tree: tree.data.sha,
        parents: [latestCommitSha],
      });
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
        sha: commit.data.sha,
        force: false,
      });
      return { uploaded: { ...seeded, ...uploaded }, failed };
    } catch (error) {
      lastError = error;
      const code = getStatusCode(error);
      if (code !== 409 && code !== 422) break;
    }
  }
  throw lastError;
};
