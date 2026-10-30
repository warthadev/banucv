// src/react/system/mediarendermodal.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { ExternalLink, Download, Copy, Check, X } from 'lucide-react';
import { getActiveBase } from '@config/api';
import { pauseGlobalPlaylist } from '@config/playlistglobal';

export const HF_SIGNED_URL_MAX_AGE_MS = 40 * 60 * 1000;

const sanitizeText = (text: string | undefined | null): string => {
  if (!text) return '';
  const element = document.createElement('div');
  element.textContent = text;
  return element.textContent || '';
};

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

const createStreamLink = async (url: string, name: string | undefined, token: string): Promise<string> => {
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

type Platform = 'android' | 'ios' | 'desktop';

const detectPlatform = (): Platform => {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
};

const toAbsoluteUrl = (url: string): string => {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
};

const buildAndroidIntent = (url: string, title: string, pkg?: string): string => {
  const u = new URL(url);
  const scheme = u.protocol.replace(':', '');
  const rest = `${u.host}${u.pathname}${u.search}`;
  const fallback = pkg
    ? `S.browser_fallback_url=${encodeURIComponent(`https://play.google.com/store/apps/details?id=${pkg}`)};`
    : '';
  return `intent://${rest}#Intent;scheme=${scheme};${pkg ? `package=${pkg};` : ''}type=video/*;S.title=${encodeURIComponent(title)};${fallback}end`;
};

const buildIosVlcUrl = (url: string): string =>
  `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`;

const safeFileBase = (name?: string): string =>
  (name || 'video').replace(/\.[^./\\]+$/, '').replace(/[\r\n\\/:*?"<>|]+/g, '_') || 'video';

const isHfUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.hostname.endsWith('huggingface.co') || parsed.hostname.endsWith('hf.co');
  } catch {
    return false;
  }
};

export interface MediaRenderModalProps {
  isOpen: boolean;
  url: string;
  name?: string;
  token?: string;
  onClose: () => void;
}

export const MediaRenderModal: React.FC<MediaRenderModalProps> = ({
  isOpen,
  url,
  name,
  token,
  onClose,
}) => {
  const [extUrl, setExtUrl] = useState('');
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState('');
  const [extCopied, setExtCopied] = useState(false);

  const platform = React.useMemo(() => detectPlatform(), []);

  const prepareLink = useCallback(async () => {
    if (!url) return;
    setExtUrl('');
    setExtError('');
    setExtCopied(false);
    setExtLoading(true);
    try {
      const hfSource = isHfUrl(url);
      let target = url;
      if (token || hfSource) {
        const pub = await fetch(url, { method: 'HEAD' }).catch(() => null);
        if (pub && pub.ok) {
          target = url;
        } else if (token) {
          try {
            target = await createStreamLink(url, name, token);
          } catch {
            const signed = await resolveHfSignedUrl(url, token);
            if (!signed) throw new Error('NEEDS_AUTH');
            target = signed;
          }
        } else {
          throw new Error('NEEDS_AUTH');
        }
      }
      setExtUrl(toAbsoluteUrl(target));
    } catch (err: any) {
      setExtError(
        err?.message === 'NEEDS_AUTH'
          ? "This private file is too small to get a temporary link, so it can't be opened in another app. Please download it instead."
          : 'Failed to prepare the link. Please try again.'
      );
    } finally {
      setExtLoading(false);
    }
  }, [url, name, token]);

  useEffect(() => {
    if (isOpen) {
      pauseGlobalPlaylist();
      void prepareLink();
    } else {
      setExtUrl('');
      setExtError('');
      setExtCopied(false);
      setExtLoading(false);
    }
  }, [isOpen, prepareLink]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const copyExtUrl = useCallback(async () => {
    if (!extUrl) return;
    try {
      await navigator.clipboard.writeText(extUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = extUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { void 0; }
      document.body.removeChild(ta);
    }
    setExtCopied(true);
    setTimeout(() => setExtCopied(false), 2000);
  }, [extUrl]);

  const downloadM3u = useCallback(() => {
    if (!extUrl) return;
    const title = (name || 'video').replace(/[\r\n]+/g, ' ');
    const body = `#EXTM3U\n#EXTINF:-1,${title}\n${extUrl}\n`;
    const blob = new Blob([body], { type: 'audio/x-mpegurl' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${safeFileBase(name)}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }, [extUrl, name]);

  if (!isOpen) return null;

  const title = name || 'video';
  let androidLinks: { vlc: string; mx: string; any: string } | null = null;
  let iosVlc = '';
  if (extUrl) {
    try {
      if (platform === 'android') {
        androidLinks = {
          vlc: buildAndroidIntent(extUrl, title, 'org.videolan.vlc'),
          mx: buildAndroidIntent(extUrl, title, 'com.mxtech.videoplayer.ad'),
          any: buildAndroidIntent(extUrl, title),
        };
      } else if (platform === 'ios') {
        iosVlc = buildIosVlcUrl(extUrl);
      }
    } catch {
      void 0;
    }
  }

  return (
    <div className="mediarender-ext-overlay" onClick={onClose}>
      <div className="mediarender-ext-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mediarender-ext-header">
          <span>Watch in another app</span>
          <button className="mediarender-ext-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {extLoading && <p className="mediarender-ext-note">Preparing link…</p>}
        {!extLoading && extError && <p className="mediarender-ext-note mediarender-ext-note--error">{extError}</p>}

        {!extLoading && !extError && extUrl && (
          <div className="mediarender-ext-list">
            {androidLinks && (
              <>
                <a className="mediarender-ext-item" href={androidLinks.vlc}><ExternalLink size={16} /> Open in VLC</a>
                <a className="mediarender-ext-item" href={androidLinks.mx}><ExternalLink size={16} /> Open in MX Player</a>
                <a className="mediarender-ext-item" href={androidLinks.any}><ExternalLink size={16} /> Choose another app…</a>
              </>
            )}
            {platform === 'ios' && iosVlc && (
              <a className="mediarender-ext-item" href={iosVlc}><ExternalLink size={16} /> Open in VLC</a>
            )}
            <button className="mediarender-ext-item" onClick={copyExtUrl}>
              {extCopied ? <Check size={16} /> : <Copy size={16} />} {extCopied ? 'Link copied' : 'Copy link'}
            </button>
            {platform === 'desktop' && (
              <button className="mediarender-ext-item" onClick={downloadM3u}>
                <Download size={16} /> Download .m3u playlist (open with VLC)
              </button>
            )}
            <p className="mediarender-ext-note">
              {platform === 'desktop'
                ? 'Or in VLC: Media → Open Network Stream (Ctrl+N) → paste the link.'
                : 'If the app is not installed you will be sent to the app store, or use "Copy link" and paste it into your player.'}
            </p>
            {(token || isHfUrl(url)) && (
              <p className="mediarender-ext-note">
                This link is temporary and grants access to the file. Do not share it with anyone.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaRenderModal;
