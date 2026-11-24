// src/react/config/sitelabel.ts
// Turn a link into a short, lowercase site label for log tags, e.g. "youtube", "tiktok", "mega".

const KNOWN_SITES: Array<[string, string]> = [
  ['youtube.com', 'youtube'], ['youtu.be', 'youtube'], ['youtube-nocookie.com', 'youtube'],
  ['tiktok.com', 'tiktok'],
  ['instagram.com', 'instagram'],
  ['facebook.com', 'facebook'], ['fb.watch', 'facebook'], ['fb.com', 'facebook'],
  ['twitter.com', 'twitter'], ['x.com', 'twitter'], ['t.co', 'twitter'],
  ['reddit.com', 'reddit'], ['redd.it', 'reddit'],
  ['twitch.tv', 'twitch'],
  ['vimeo.com', 'vimeo'],
  ['dailymotion.com', 'dailymotion'], ['dai.ly', 'dailymotion'],
  ['soundcloud.com', 'soundcloud'],
  ['bilibili.com', 'bilibili'], ['b23.tv', 'bilibili'],
  ['pinterest.com', 'pinterest'], ['pin.it', 'pinterest'],
  ['mega.nz', 'mega'], ['mega.io', 'mega'],
  ['drive.google.com', 'gdrive'], ['docs.google.com', 'gdrive'],
  ['mediafire.com', 'mediafire'],
  ['dropbox.com', 'dropbox'],
  ['github.com', 'github'], ['githubusercontent.com', 'github'],
  ['huggingface.co', 'huggingface'],
  ['t.me', 'telegram'], ['telegram.me', 'telegram'],
  ['pixeldrain.com', 'pixeldrain'],
];

const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac']);
const FALLBACK = 'universal';

export const getSiteLabel = (value: string | null | undefined): string => {
  const raw = String(value || '').trim();
  if (!raw) return FALLBACK;
  if (/^magnet:/i.test(raw)) return 'torrent';

  let host = '';
  try { host = new URL(raw).hostname.toLowerCase(); } catch { return FALLBACK; }
  host = host.replace(/^www\./, '').replace(/\.$/, '');
  if (!host) return FALLBACK;

  for (const [domain, label] of KNOWN_SITES) {
    if (host === domain || host.endsWith(`.${domain}`)) return label;
  }

  const parts = host.split('.');
  if (parts.length < 2) return FALLBACK;
  let name = parts[parts.length - 2];
  if (SECOND_LEVEL.has(name) && parts.length >= 3) name = parts[parts.length - 3];
  name = name.replace(/[^a-z0-9-]/g, '').slice(0, 20);
  return name || FALLBACK;
};

// Clean a site name sent by the server (yt-dlp extractor name); null when unusable.
export const normalizeSiteLabel = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const name = value.toLowerCase().split(':')[0].replace(/[^a-z0-9-]/g, '').slice(0, 20);
  return name && name !== 'generic' ? name : null;
};
