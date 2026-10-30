// src/react/config/cloudviewapi.ts
import { getActiveBase } from '@config/api';
import type { HFApiResult } from '@config/cloudviewtypes';

export const hfPost = async (endpoint: string, body: any): Promise<HFApiResult> => {
  try {
    const API_BASE = getActiveBase();
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.detail || `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
};

export const hfBackendMove = async (
  repoId: string,
  repoType: 'dataset' | 'model' | 'space',
  srcPath: string,
  dstPath: string,
  token: string
): Promise<HFApiResult> => {
  return hfPost('/hf/move', {
    repo_id: repoId,
    repo_type: repoType,
    src_path: srcPath,
    dst_path: dstPath,
    token,
  });
};

export const hfBackendMoveBulk = async (
  repoId: string,
  repoType: 'dataset' | 'model' | 'space',
  srcPaths: string[],
  dstFolder: string,
  basePath: string,
  token: string,
  mirrorBasePath?: string
): Promise<HFApiResult> => {
  return hfPost('/hf/move-bulk', {
    repo_id: repoId,
    repo_type: repoType,
    src_paths: srcPaths,
    dst_folder: dstFolder,
    base_path: basePath,
    mirror_base_path: mirrorBasePath,
    token,
  });
};

export const hfBackendRenameFolder = async (
  repoId: string,
  repoType: 'dataset' | 'model' | 'space',
  srcFolder: string,
  dstFolder: string,
  token: string
): Promise<HFApiResult> => {
  return hfPost('/hf/rename-folder', {
    repo_id: repoId,
    repo_type: repoType,
    src_folder: srcFolder,
    dst_folder: dstFolder,
    token,
  });
};

export const hfBackendDelete = async (
  repoId: string,
  repoType: 'dataset' | 'model' | 'space',
  paths: string[],
  token: string,
  ignoreMissing: boolean = false
): Promise<HFApiResult> => {
  return hfPost('/hf/delete', {
    repo_id: repoId,
    repo_type: repoType,
    paths,
    token,
    ignore_missing: ignoreMissing,
  });
};

export const hfBackendDeleteFolder = async (
  repoId: string,
  repoType: 'dataset' | 'model' | 'space',
  folderPath: string,
  token: string
): Promise<HFApiResult> => {
  return hfPost('/hf/delete-folder', {
    repo_id: repoId,
    repo_type: repoType,
    folder_path: folderPath,
    token,
  });
};

export const hfBackendListFolders = async (
  repoId: string,
  repoType: 'dataset' | 'model' | 'space',
  token: string
): Promise<HFApiResult> => {
  return hfPost('/hf/list-folders', {
    repo_id: repoId,
    repo_type: repoType,
    token,
  });
};

export const hfBackendCrossCopy = async (payload: {
  src_repo_id: string;
  src_repo_type: 'dataset' | 'model' | 'space';
  src_paths: string[];
  dst_repo_id: string;
  dst_repo_type: 'dataset' | 'model' | 'space';
  dst_path_prefix: string;
  src_base_path: string;
  src_token: string;
  dst_token: string;
  delete_source?: boolean;
}): Promise<HFApiResult> => {
  return hfPost('/hf/cross-copy', payload);
};

export const hfBackendRenameRepo = async (
  repoId: string,
  repoType: 'dataset' | 'model' | 'space',
  newName: string,
  token: string
): Promise<HFApiResult> => {
  return hfPost('/hf/rename-repo', {
    repo_id: repoId,
    repo_type: repoType,
    new_name: newName,
    token,
  });
};

export const hfBackendDeleteRepo = async (
  repoId: string,
  repoType: 'dataset' | 'model' | 'space',
  token: string
): Promise<HFApiResult> => {
  return hfPost('/hf/delete-repo', {
    repo_id: repoId,
    repo_type: repoType,
    token,
  });
};

export const hfBackendCreateRepo = async (
  name: string,
  repoType: 'dataset' | 'model' | 'space',
  isPrivate: boolean,
  token: string
): Promise<HFApiResult> => {
  return hfPost('/hf/create-repo', {
    name,
    repo_type: repoType,
    private: isPrivate,
    token,
  });
};

export const hfBackendSquashHistory = async (
  repoId: string,
  repoType: 'dataset' | 'model' | 'space',
  token: string
): Promise<HFApiResult> => {
  return hfPost('/hf/squash-history', {
    repo_id: repoId,
    repo_type: repoType,
    token,
  });
};

export const hfBackendUpdateRepoVisibility = async (
  repoId: string,
  repoType: 'dataset' | 'model' | 'space',
  isPrivate: boolean,
  token: string
): Promise<HFApiResult> => {
  return hfPost('/hf/update-repo-visibility', {
    repo_id: repoId,
    repo_type: repoType,
    private: isPrivate,
    token,
  });
};