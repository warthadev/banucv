// src/react/config/telegram.ts
import { formatBytes, formatDuration, formatRelativeDate } from './utils';

export interface TelegramChat {
  id: number;
  name: string;
  type: string;
  unread_count?: number;
  total_size?: number;
}

export interface TelegramFile {
  id: number;
  name: string;
  size: number;
  file_id: string;
  media_type: string;
  mime_type?: string;
  caption?: string;
  duration?: number;
  width?: number;
  height?: number;
  date?: number;
  metadata?: TelegramFileMetadata;
  file?: File;
}

export interface TelegramFileMetadata {
  duration?: number;
  width?: number;
  height?: number;
  subtitleTracks?: {
    index: number;
    language: string;
    codec: string;
  }[];
  audioTracks?: {
    index: number;
    language: string;
    codec: string;
  }[];
  format?: string;
  videoTracks?: any[];
}

export type ViewMode = 'list' | 'grid' | 'thumbnail';
export type MobileView = 'chats' | 'files' | 'player';
export type SortField = 'name' | 'date' | 'size' | 'type';
export type SortDir = 'asc' | 'desc';

export const STORAGE_KEYS = {
  SELECTED_CHAT_ID: 'tg_selected_chat_id',
  SELECTED_CHAT: 'tg_selected_chat',
  MOBILE_VIEW: 'tg_mobile_view',
  SIDEBAR_WIDTH: 'tg_sidebar_width',
  SIDEBAR_COLLAPSED: 'tg_sidebar_collapsed',
  VIEW_MODE: 'tg_view_mode',
  SORT_FIELD: 'tg_sort_field',
  SORT_DIR: 'tg_sort_dir',
};

export const typeColor: Record<string, string> = {
  video: '#e74c3c',
  audio: '#2ecc71',
  image: '#3498db',
  archive: '#f39c12',
  voice: '#9b59b6',
  sticker: '#e67e22',
  gif: '#1abc9c',
  contact: '#34495e',
  location: '#16a085',
  poll: '#2980b9',
  document: '#7f8c8d',
  text: '#95a5a6',
};

export const getColor = (t: string): string => typeColor[t] || '#95a5a6';

export const typeLabel: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  image: 'Image',
  archive: 'Archive',
  voice: 'Voice',
  sticker: 'Sticker',
  gif: 'GIF',
  contact: 'Contact',
  location: 'Location',
  poll: 'Poll',
  document: 'Document',
  text: 'Text',
};

export const getLabel = (t: string): string => typeLabel[t] || 'File';

export { formatBytes, formatDuration, formatRelativeDate };