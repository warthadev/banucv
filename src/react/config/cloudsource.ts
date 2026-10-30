// src/react/config/cloudsource.ts
export type CloudSourceType = 'telegram' | 'hf_dataset';

export interface CloudSource {
  id: string;
  type: CloudSourceType;
  name: string;
  platform: string;
  icon: string;
  status: 'online' | 'offline' | 'loading';
  description?: string;
  
  // Telegram specific
  sessionString?: string;
  phoneNumber?: string;
  unreadCount?: number;
  
  // HF Dataset specific
  datasetId?: string;
  datasetPath?: string;
  fileCount?: number;
  totalSize?: number;
  lastSync?: Date;
  // HF Repository specific (baru)
  hfToken?: string;
  hfView?: 'repos' | 'files';  // view state: list repos atau browse files
  currentRepo?: string;         // repo yang sedang dipilih
  currentRepoType?: 'dataset' | 'model' | 'space' | '';
  currentPath?: string;         // path folder saat ini
}

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
  folders: string[];
  files: HFFile[];
  totalSize: number;
}

export const DEFAULT_SOURCES: CloudSource[] = [];

export const generateSourceId = (): string => {
  return `source_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export const getSourceIcon = (type: CloudSourceType): string => {
  return type === 'telegram' ? '☁️' : '📁';
};

export const getPlatformLabel = (type: CloudSourceType): string => {
  return type === 'telegram' ? 'Telegram Account' : 'Hugging Face';
};

export const getSourceStatusColor = (status: CloudSource['status']): string => {
  switch (status) {
    case 'online': return '#22c55e';
    case 'offline': return '#6b7280';
    case 'loading': return '#f59e0b';
    default: return '#6b7280';
  }
};

export const getRepoTypeColor = (type: HFRepo['type']): string => {
  switch (type) {
    case 'dataset': return '#1565c0';
    case 'model': return '#7b1fa2';
    case 'space': return '#2e7d32';
    default: return '#6b7280';
  }
};

export const getRepoTypeLabel = (type: HFRepo['type']): string => {
  switch (type) {
    case 'dataset': return 'Dataset';
    case 'model': return 'Model';
    case 'space': return 'Space';
    default: return 'Unknown';
  }
};

export const getFileTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    image: '#3b82f6',
    video: '#ef4444',
    audio: '#22c55e',
    text: '#8b5cf6',
    json: '#f59e0b',
    yaml: '#06b6d4',
    markdown: '#6366f1',
    pdf: '#ef4444',
    zip: '#8b5cf6',
    tar: '#8b5cf6',
    gz: '#8b5cf6',
  };
  return colors[type] || '#6b7280';
};