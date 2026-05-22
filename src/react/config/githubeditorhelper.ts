// src/react/config/githubeditorhelper.ts
import { Octokit } from "octokit";
import { db, auth } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface GithubCredentials {
  githubUsername: string;
  githubToken: string;
  updatedAt?: Date;
  uid?: string;
}

export const saveGithubCredentials = async (username: string, token: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const credentials: GithubCredentials = {
    githubUsername: username,
    githubToken: token,
    updatedAt: new Date(),
    uid: user.uid,
  };

  // PERBAIKAN: tambahkan merge true agar tidak menghapus field lain (seperti geminiApiKey)
  await setDoc(doc(db, "users", user.uid), credentials, { merge: true });
  
  localStorage.setItem("github_username", username);
  localStorage.setItem("github_token", token);
  
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
      localStorage.setItem("github_username", data.githubUsername);
      localStorage.setItem("github_token", data.githubToken);
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
  
  const localUsername = localStorage.getItem("github_username");
  const localToken = localStorage.getItem("github_token");
  if (localUsername && localToken) {
    return { githubUsername: localUsername, githubToken: localToken };
  }
  
  return null;
};

export const clearGithubCredentials = () => {
  localStorage.removeItem("github_username");
  localStorage.removeItem("github_token");
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
}

export interface ItemTarget {
  type: "repo" | "file" | "folder";
  name: string;
  path?: string;
  sha?: string;
}

export const formatBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  const fixed = i <= 1 ? value.toFixed(0) : value.toFixed(1);
  return `${fixed} ${sizes[i]}`;
};

export const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  if (parts.length === 1) return "";
  return parts.pop() || "";
};

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
  const ext = filename.split(".").pop()?.toLowerCase() || "";
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

export const fetchReposAPI = async () => {
  const octokit = getOctokit();
  const res = await octokit.request("GET /user/repos", {
    sort: "updated",
    per_page: 100,
    direction: "desc",
    timestamp: Date.now(),
  } as any);
  return res.data;
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
  const res: any = await octokit.request(
    "GET /repos/{owner}/{repo}/contents/{path}",
    { owner: currentUsername, repo, path }
  );
  return {
    content: decodeContent(res.data.content),
    sha: res.data.sha,
  };
};

export const saveFileAPI = async (repo: string, path: string, content: string, sha: string) => {
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

export const deleteFolderRecursiveAPI = async (repo: string, folderPath: string) => {
  const items = await fetchContentsAPI(repo, folderPath);
  for (const item of items) {
    if (item.type === "dir") {
      await deleteFolderRecursiveAPI(repo, item.path);
    } else {
      await deleteFileAPI(repo, item.path, item.sha);
    }
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

export const renameRepoAPI = async (oldName: string, newName: string) => {
  const octokit = getOctokit();
  const res = await octokit.request("PATCH /repos/{owner}/{repo}", {
    owner: currentUsername,
    repo: oldName,
    name: newName,
  });
  return res.data;
};

export const deleteRepoAPI = async (repoName: string) => {
  const octokit = getOctokit();
  await octokit.request("DELETE /repos/{owner}/{repo}", {
    owner: currentUsername,
    repo: repoName,
  });
};

export const createRepoAPI = async (name: string, description: string) => {
  const octokit = getOctokit();
  const res = await octokit.request("POST /user/repos", {
    name,
    description,
    private: false,
  });
  return res.data;
};

export const uploadFolderToGitHub = async (
  files: FileList,
  repo: string,
  basePath: string = ""
): Promise<void> => {
  const octokit = getOctokit();
  const promises: Promise<any>[] = [];

  for (const file of files) {
    let relativePath = file.webkitRelativePath || file.name;
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