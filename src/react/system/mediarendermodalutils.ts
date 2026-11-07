// src/react/system/mediarendermodalutils.ts
import { getActiveBase } from '@config/api';

const safeDecodeFilename = (name: string): string => {
  if (!name) return name;
  let current = name;
  for (let i = 0; i < 3; i++) {
    try {
      if (!current.includes('%')) break;
      const decoded = decodeURIComponent(current);
      if (!decoded || decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
};

const extractNameFromUrl = (url: string): string => {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.href);
    const base = parsed.pathname.split('/').filter(Boolean).pop() || '';
    return safeDecodeFilename(base);
  } catch {
    return '';
  }
};

const cleanFilename = (name: string): string => {
  const decoded = safeDecodeFilename(name);
  const trimmed = decoded.replace(/[\r\n]+/g, ' ').trim();
  return trimmed || 'download';
};

export const resolveDownloadFilename = (item: { name?: string; url: string }): string => {
  const fromItem = safeDecodeFilename(item.name || '');
  if (fromItem && fromItem.trim()) return cleanFilename(fromItem);
  const fromUrl = extractNameFromUrl(item.url);
  if (fromUrl && fromUrl.trim()) return cleanFilename(fromUrl);
  return 'download';
};

export const resolveHfSignedUrl = async (
  url: string,
  token?: string,
  signal?: AbortSignal
): Promise<string | null> => {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'HEAD',
    headers,
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.url && res.url !== url ? res.url : null;
};

const fetchToBlobWithName = async (
  url: string,
  token: string | undefined,
  filename: string,
  signal?: AbortSignal
): Promise<void> => {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let sourceUrl = url;
  if (token || url.includes('huggingface.co') || url.includes('hf.co')) {
    try {
      const signed = await resolveHfSignedUrl(url, token, signal);
      if (signed) sourceUrl = signed;
    } catch {
      void 0;
    }
  }

  const res = await fetch(sourceUrl, { headers, signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const rawBlob = await res.blob();
  const mime = res.headers.get('content-type') || rawBlob.type || 'application/octet-stream';
  const blob = rawBlob.type === mime ? rawBlob : new Blob([rawBlob], { type: mime });

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = cleanFilename(filename);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
};

export const tryDirectHfDownload = async (
  url: string,
  token?: string,
  signal?: AbortSignal
): Promise<boolean> => {
  const u = new URL(url, window.location.href);
  u.searchParams.set('download', 'true');
  const signed = await resolveHfSignedUrl(u.toString(), token, signal);
  if (!signed) return false;
  const a = document.createElement('a');
  a.href = signed;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
};

export const downloadMediaWithName = async (
  item: { name?: string; url: string },
  token?: string,
  signal?: AbortSignal
): Promise<void> => {
  const filename = resolveDownloadFilename(item);
  await fetchToBlobWithName(item.url, token, filename, signal);
};

export const createStreamLink = async (url: string, name: string | undefined, token: string): Promise<string> => {
  const API_BASE = getActiveBase();
  const res = await fetch(`${API_BASE}/proxy/stream-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, token, filename: name || '' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.path) throw new Error('NO_PATH');
  return `${API_BASE}${data.path}`;
};
