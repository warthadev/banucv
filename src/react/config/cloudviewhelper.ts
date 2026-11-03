// src/react/config/cloudviewhelper.ts
import type { NavSnapshot } from '@config/cloudviewtypes';

export const HF_SIDEBAR_WIDTH_KEY = 'hf_sidebar_width';
export const HF_VIEW_MODE_KEY = 'hf_view_mode';
export const HF_SORT_FIELD_KEY = 'hf_sort_field';
export const HF_SORT_DIR_KEY = 'hf_sort_dir';
export const HF_SORT_FIELDS = ['name', 'date', 'size', 'type'] as const;
export const HF_SIDEBAR_DEFAULT_WIDTH = 220;
export const HF_SIDEBAR_MIN_WIDTH = 160;
export const HF_SIDEBAR_MAX_WIDTH = 500;
export const THUMB_PREFIX = 'thumbs/';

export type SortField = 'name' | 'date' | 'size' | 'type';
export type SortDir = 'asc' | 'desc';

export interface SortableItem {
  name?: string;
  date?: number;
  size?: number;
  media_type?: string;
  _isFolder?: boolean;
}

export const SORT_FIELDS: readonly SortField[] = ['name', 'date', 'size', 'type'];

export const sortItems = <T extends SortableItem>(
  items: readonly T[],
  field: SortField,
  direction: SortDir,
  foldersFirst = false,
): T[] => {
  return [...items].sort((a, b) => {
    if (foldersFirst) {
      if (a._isFolder && !b._isFolder) return -1;
      if (!a._isFolder && b._isFolder) return 1;
    }

    let comparison = 0;
    if (field === 'name') {
      comparison = (a.name || '').localeCompare(b.name || '');
    } else if (field === 'date') {
      comparison = (b.date || 0) - (a.date || 0);
    } else if (field === 'size') {
      comparison = (b.size || 0) - (a.size || 0);
    } else if (field === 'type') {
      comparison = (a.media_type || '').localeCompare(b.media_type || '');
    }

    return direction === 'asc' ? comparison : -comparison;
  });
};

export const areSnapshotsEqual = (a: NavSnapshot | null, b: NavSnapshot | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.sourceId === b.sourceId &&
    a.sourceType === b.sourceType &&
    a.hfView === b.hfView &&
    a.repo === b.repo &&
    a.repoType === b.repoType &&
    a.path === b.path &&
    a.fileId === b.fileId &&
    a.chatId === b.chatId &&
    a.mobileView === b.mobileView
  );
};

export const safeDecodeFilename = (name: string): string => {
  if (!name) return name;
  try {
    if (name.includes('%')) {
      const decoded = decodeURIComponent(name);
      if (decoded && decoded !== name) return decoded;
    }
  } catch {
    void 0;
  }
  return name;
};
