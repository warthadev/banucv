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