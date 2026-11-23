// src/react/config/huggingface.ts
export const HF_API_BASE = 'https://huggingface.co/api';
export const COVER_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif']);
export const COVER_VIDEO_EXT = new Set(['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']);

export interface HFFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  path?: string;
  createdAt?: Date;
}

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

export const buildAvatarUrl = (name: string, avatar?: string): string => {
  if (avatar && avatar.length > 0) return avatar;
  return `${HF_API_BASE}/avatars/${encodeURIComponent(name)}`;
};
