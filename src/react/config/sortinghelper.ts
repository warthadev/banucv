// src/react/config/sortinghelper.ts
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
