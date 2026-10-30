// src/react/hook/usehfdataset.ts
import { useCallback, useMemo, useState } from 'react';
import type { HFFile } from '@config/cloudsource';
import { getActiveBase } from '@config/api';

const HF_API_BASE = 'https://huggingface.co/api';

export interface HFRepo {
  name: string;
  full_name: string;
  type: 'dataset' | 'model' | 'space';
  private: boolean;
  last_modified?: string;
  size?: number;
  description?: string;
  likes?: number;
  downloads?: number;
}

const COVER_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif']);
const COVER_VIDEO_EXT = new Set(['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']);

export interface HFFolderStructure {
  folders: { name: string; size: number; coverPath?: string; coverSize?: number }[];
  files: HFFile[];
  totalSize: number;
}

export interface HFSearchUser {
  id: string;
  username: string;
  fullname?: string;
  avatarUrl?: string;
  isOrg?: boolean;
}

export interface HFSearchRepo {
  id: string;
  name: string;
  full_name: string;
  type: 'dataset' | 'model' | 'space';
  private: boolean;
  likes?: number;
  downloads?: number;
}

const buildAvatarUrl = (name: string, avatar?: string): string => {
  if (avatar && avatar.length > 0) return avatar;
  return `https://huggingface.co/api/avatars/${encodeURIComponent(name)}`;
};

export const useHFDataset = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWithAuth = useCallback(async (url: string, token?: string) => {
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
  }, []);

  const getRepoSize = useCallback(async (repoId: string, repoType: string, token?: string): Promise<number> => {
    try {
      let info;
      if (repoType === 'dataset') {
        info = await fetchWithAuth(`${HF_API_BASE}/datasets/${repoId}?blobs=true`, token);
      } else if (repoType === 'model') {
        info = await fetchWithAuth(`${HF_API_BASE}/models/${repoId}?blobs=true`, token);
      } else if (repoType === 'space') {
        info = await fetchWithAuth(`${HF_API_BASE}/spaces/${repoId}?blobs=true`, token);
      } else {
        return 0;
      }
      const siblings = info.siblings || [];
      return siblings.reduce((acc: number, s: any) => acc + (s.size || 0), 0);
    } catch {
      return 0;
    }
  }, [fetchWithAuth]);

  const listRepositories = useCallback(async (username: string, token?: string): Promise<HFRepo[]> => {
    setLoading(true);
    setError(null);
    const repos: HFRepo[] = [];

    try {
      const datasets = await fetchWithAuth(`${HF_API_BASE}/datasets?author=${username}`, token);
      if (datasets && Array.isArray(datasets)) {
        for (const ds of datasets) {
          repos.push({
            name: ds.id.split('/')[1] || ds.id,
            full_name: ds.id,
            type: 'dataset',
            private: ds.private || false,
            last_modified: ds.createdAt || new Date().toISOString(),
            description: ds.description || '',
            likes: ds.likes || 0,
            downloads: ds.downloads || 0,
          });
        }
      }
    } catch (err) {}

    try {
      const models = await fetchWithAuth(`${HF_API_BASE}/models?author=${username}`, token);
      if (models && Array.isArray(models)) {
        for (const model of models) {
          repos.push({
            name: model.id.split('/')[1] || model.id,
            full_name: model.id,
            type: 'model',
            private: model.private || false,
            last_modified: model.createdAt || new Date().toISOString(),
            description: model.description || '',
            likes: model.likes || 0,
            downloads: model.downloads || 0,
          });
        }
      }
    } catch (err) {}

    try {
      const spaces = await fetchWithAuth(`${HF_API_BASE}/spaces?author=${username}`, token);
      if (spaces && Array.isArray(spaces)) {
        for (const space of spaces) {
          repos.push({
            name: space.id.split('/')[1] || space.id,
            full_name: space.id,
            type: 'space',
            private: space.private || false,
            last_modified: space.createdAt || new Date().toISOString(),
            description: space.description || '',
            likes: space.likes || 0,
            downloads: space.downloads || 0,
          });
        }
      }
    } catch (err) {}

    if (repos.length > 0) {
      const sizePromises = repos.map(async (repo) => {
        try {
          const size = await getRepoSize(repo.full_name, repo.type, token);
          return { ...repo, size };
        } catch {
          return { ...repo, size: 0 };
        }
      });
      const reposWithSize = await Promise.all(sizePromises);
      setLoading(false);
      return reposWithSize;
    }

    setLoading(false);
    return repos;
  }, [fetchWithAuth, getRepoSize]);

  /**
   * Tanggal commit terakhir per item (file dan folder) di satu folder, dari API tree HF (expand=true).
   * Hasilnya { namaItem: unixSeconds }. Ini tanggal commit, bukan tanggal file dibuat (git tidak menyimpannya).
   */
  const getFolderDates = useCallback(async (
    repoId: string,
    repoType: string,
    path: string,
    token?: string
  ): Promise<Record<string, number>> => {
    const plural = repoType === 'dataset' ? 'datasets' : repoType === 'space' ? 'spaces' : 'models';
    const encodedPath = path ? '/' + path.split('/').map(encodeURIComponent).join('/') : '';
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const dates: Record<string, number> = {};
    let url: string | null = `${HF_API_BASE}/${plural}/${repoId}/tree/main${encodedPath}?expand=true`;
    for (let page = 0; url && page < 20; page++) {
      const res: Response = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const entries = await res.json();
      for (const entry of entries as any[]) {
        const date = entry?.lastCommit?.date;
        const name = typeof entry?.path === 'string' ? entry.path.split('/').pop() : '';
        if (date && name) dates[name] = Math.floor(new Date(date).getTime() / 1000);
      }
      const next = res.headers.get('Link')?.match(/<([^>]+)>;\s*rel="next"/);
      url = next ? next[1] : null;
    }
    return dates;
  }, []);

  const getFolderStructure = useCallback(async (
    repoId: string,
    repoType: string,
    path: string = '',
    token?: string
  ): Promise<HFFolderStructure> => {
    setLoading(true);
    setError(null);
    try {
      let info;
      if (repoType === 'dataset') {
        info = await fetchWithAuth(`${HF_API_BASE}/datasets/${repoId}?blobs=true`, token);
      } else if (repoType === 'model') {
        info = await fetchWithAuth(`${HF_API_BASE}/models/${repoId}?blobs=true`, token);
      } else if (repoType === 'space') {
        info = await fetchWithAuth(`${HF_API_BASE}/spaces/${repoId}?blobs=true`, token);
      } else {
        return { folders: [], files: [], totalSize: 0 };
      }

      const siblings = info.siblings || [];
      const foldersMap = new Map<string, number>();
      const coversMap = new Map<string, { path: string; rank: number; size: number }>();
      const files: HFFile[] = [];
      const prefix = path ? `${path}/` : '';

      for (const sibling of siblings) {
        const filePath = sibling.rfilename || '';
        if (!filePath) continue;

        if (prefix && !filePath.startsWith(prefix)) continue;

        const relative = prefix ? filePath.substring(prefix.length) : filePath;
        if (!relative) continue;

        if (relative.includes('/')) {
          const folderName = relative.split('/')[0];
          if (folderName && folderName.toLowerCase() !== 'thumbs') {
            const currentSize = foldersMap.get(folderName) || 0;
            foldersMap.set(folderName, currentSize + (sibling.size || 0));

            // Cover folder: pilih gambar (lalu video) pertama di dalam folder, rekursif.
            const coverExt = filePath.split('.').pop()?.toLowerCase() || '';
            const rank = COVER_IMAGE_EXT.has(coverExt) ? 0 : COVER_VIDEO_EXT.has(coverExt) ? 1 : -1;
            if (rank >= 0) {
              const prev = coversMap.get(folderName);
              if (!prev || rank < prev.rank || (rank === prev.rank && filePath.localeCompare(prev.path) < 0)) {
                coversMap.set(folderName, { path: filePath, rank, size: sibling.size || 0 });
              }
            }
          }
        } else {
          const fileName = relative;
          if (fileName === '.gitkeep') continue;
          const fileSize = sibling.size || 0;
          const fileType = fileName.split('.').pop()?.toLowerCase() || 'file';
          const fullPath = filePath;

          files.push({
            id: `${repoId}:${fullPath}`,
            name: fileName,
            size: fileSize,
            type: fileType,
            url: `https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(fullPath)}`,
            path: fullPath,
            createdAt: undefined,
          });
        }
      }

      const folders = Array.from(foldersMap.entries()).map(([name, size]) => ({ name, size, coverPath: coversMap.get(name)?.path, coverSize: coversMap.get(name)?.size }));
      const totalSize = files.reduce((acc, f) => acc + f.size, 0) + folders.reduce((acc, f) => acc + f.size, 0);

      setLoading(false);
      return {
        folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
        files: files.sort((a, b) => a.name.localeCompare(b.name)),
        totalSize,
      };
    } catch (err: any) {
      setError(err.message || 'Failed to fetch folder structure');
      setLoading(false);
      return { folders: [], files: [], totalSize: 0 };
    }
  }, [fetchWithAuth]);

  const searchHFUsers = useCallback(async (query: string): Promise<HFSearchUser[]> => {
    const q = query.trim();
    if (!q) return [];

    try {
      const res = await fetch(
        `${HF_API_BASE}/users?search=${encodeURIComponent(q)}&limit=30`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((u: any): HFSearchUser => {
        const username = u.user || u.name || u.id || '';
        return {
          id: u.id || username,
          username,
          fullname: u.fullname || '',
          avatarUrl: buildAvatarUrl(username, u.avatarUrl),
          isOrg: !!u.isOrg,
        };
      });
    } catch (err: any) {
      throw new Error(err?.message || 'Search failed');
    }
  }, []);

  const searchHFRepos = useCallback(async (query: string): Promise<HFSearchRepo[]> => {
    const q = query.trim();
    if (!q) return [];

    const safeFetch = async (url: string): Promise<any[]> => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      } catch {
        return [];
      }
    };

    const [datasets, models, spaces] = await Promise.all([
      safeFetch(`${HF_API_BASE}/datasets?search=${encodeURIComponent(q)}&limit=15&sort=downloads&direction=-1`),
      safeFetch(`${HF_API_BASE}/models?search=${encodeURIComponent(q)}&limit=15&sort=downloads&direction=-1`),
      safeFetch(`${HF_API_BASE}/spaces?search=${encodeURIComponent(q)}&limit=10&sort=likes&direction=-1`),
    ]);

    const merged: HFSearchRepo[] = [];
    const push = (arr: any[], type: 'dataset' | 'model' | 'space') => {
      for (const item of arr) {
        const id = item.id || item.modelId || '';
        if (!id) continue;
        merged.push({
          id,
          name: id.split('/')[1] || id,
          full_name: id,
          type,
          private: !!item.private,
          likes: item.likes || 0,
          downloads: item.downloads || 0,
        });
      }
    };

    push(datasets, 'dataset');
    push(models, 'model');
    push(spaces, 'space');

    const order: Record<string, number> = { dataset: 0, model: 1, space: 2 };
    merged.sort((a, b) => {
      const t = (order[a.type] ?? 99) - (order[b.type] ?? 99);
      if (t !== 0) return t;
      return (b.downloads || 0) - (a.downloads || 0);
    });

    return merged.slice(0, 40);
  }, []);

  const listUserRepos = useCallback(async (username: string): Promise<HFSearchRepo[]> => {
    const u = username.trim();
    if (!u) return [];

    const safeFetch = async (url: string): Promise<any[]> => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      } catch {
        return [];
      }
    };

    const [datasets, models, spaces] = await Promise.all([
      safeFetch(`${HF_API_BASE}/datasets?author=${encodeURIComponent(u)}&limit=100`),
      safeFetch(`${HF_API_BASE}/models?author=${encodeURIComponent(u)}&limit=100`),
      safeFetch(`${HF_API_BASE}/spaces?author=${encodeURIComponent(u)}&limit=100`),
    ]);

    const merged: HFSearchRepo[] = [];
    const push = (arr: any[], type: 'dataset' | 'model' | 'space') => {
      for (const item of arr) {
        const id = item.id || item.modelId || '';
        if (!id) continue;
        merged.push({
          id,
          name: id.split('/')[1] || id,
          full_name: id,
          type,
          private: !!item.private,
          likes: item.likes || 0,
          downloads: item.downloads || 0,
        });
      }
    };

    push(datasets, 'dataset');
    push(models, 'model');
    push(spaces, 'space');

    const order: Record<string, number> = { dataset: 0, model: 1, space: 2 };
    merged.sort((a, b) => {
      const t = (order[a.type] ?? 99) - (order[b.type] ?? 99);
      if (t !== 0) return t;
      return a.name.localeCompare(b.name);
    });

    return merged;
  }, []);

  const fetchDatasetInfo = useCallback(async (datasetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${HF_API_BASE}/datasets/${datasetId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch dataset: ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dataset info');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDatasetFiles = useCallback(async (datasetId: string, path: string = ''): Promise<HFFile[]> => {
    setLoading(true);
    setError(null);
    try {
      const url = path
        ? `${HF_API_BASE}/datasets/${datasetId}/resolve/main/${path}?recursive=true`
        : `${HF_API_BASE}/datasets/${datasetId}/resolve/main/`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch files: ${res.status}`);
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        return data
          .filter((item: any) => {
            const p = item.path || item.rfilename || '';
            if (!p) return false;
            if (p.endsWith('.gitkeep')) return false;
            if (p.startsWith('thumbs/')) return false;
            return true;
          })
          .map((item: any) => ({
            id: item.path || item.rfilename || `${Math.random()}`,
            name: item.rfilename || item.path || 'Unknown',
            size: item.size || 0,
            type: item.rfilename ? item.rfilename.split('.').pop()?.toLowerCase() || 'file' : 'file',
            url: `https://huggingface.co/datasets/${datasetId}/resolve/main/${encodeURIComponent(item.path || item.rfilename)}`,
            path: item.path || item.rfilename,
            createdAt: item.created_at ? new Date(item.created_at) : undefined,
          }));
      }

      return [];
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dataset files');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFileContent = useCallback(async (datasetId: string, filePath: string): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const url = `${HF_API_BASE}/datasets/${datasetId}/resolve/main/${filePath}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch file: ${res.status}`);
      }
      const content = await res.text();
      return content;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch file content');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createFolder = useCallback(async (
    repoId: string,
    repoType: string,
    folderPath: string,
    token: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const API_BASE = getActiveBase();
      const res = await fetch(`${API_BASE}/hf/create-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_id: repoId,
          repo_type: repoType,
          folder_path: folderPath,
          token,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data?.detail || `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error' };
    }
  }, []);

  const getFileUrl = useCallback((datasetId: string, filePath: string): string => {
    return `https://huggingface.co/${datasetId}/resolve/main/${encodeURIComponent(filePath)}`;
  }, []);

  const getRawFileUrl = useCallback((datasetId: string, filePath: string): string => {
    return `https://huggingface.co/${datasetId}/resolve/main/${encodeURIComponent(filePath)}?raw=true`;
  }, []);

  return useMemo(() => ({
    loading,
    error,
    listRepositories,
    getFolderStructure,
    getFolderDates,
    getRepoSize,
    searchHFUsers,
    searchHFRepos,
    listUserRepos,
    fetchDatasetInfo,
    fetchDatasetFiles,
    fetchFileContent,
    createFolder,
    getFileUrl,
    getRawFileUrl,
  }), [
    loading,
    error,
    listRepositories,
    getFolderStructure,
    getFolderDates,
    getRepoSize,
    searchHFUsers,
    searchHFRepos,
    listUserRepos,
    fetchDatasetInfo,
    fetchDatasetFiles,
    fetchFileContent,
    createFolder,
    getFileUrl,
    getRawFileUrl,
  ]);
};