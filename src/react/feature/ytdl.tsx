import React, { useState, useEffect, useRef } from 'react';

type LogType = 'system' | 'critical' | 'success';

interface LogItem {
  msg: string;
  type: LogType;
}

interface Mp4Format {
  resolution: string;
  video_url: string;
  audio_url: string | null;
  needs_mux: boolean;
  height?: number;
  width?: number;
  real_res?: string;
  filesize?: number;
  format_note?: string;
  format_id?: string;
  ext?: string;
}

interface Mp3Format {
  quality: string;
  audio_url: string;
  bitrate?: number;
}

interface ExtractResponse {
  success: boolean;
  platform?: string;
  title?: string;
  uploader?: string;
  duration?: string;
  thumbnail?: string;
  view_count?: number;
  like_count?: number;
  mp4_formats?: Mp4Format[];
  mp3_formats?: Mp3Format[];
  best_muxed?: {
    video_url: string;
    resolution: string;
    ext: string;
    filesize?: number;
  };
  error?: string;
  message?: string;
}

// Return empty string if size is unknown -> UI will hide it
const formatBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  const fixed = i <= 1 ? value.toFixed(0) : value.toFixed(1);
  return `${fixed} ${sizes[i]}`;
};

const formatBitrate = (kbps?: number | null): string => {
  if (!kbps || kbps <= 0) return '';
  return `${Math.round(kbps)} kbps`;
};

const Page: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [data, setData] = useState<ExtractResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [copyLabel, setCopyLabel] = useState('copy');
  const [activeTab, setActiveTab] = useState<'mp4' | 'mp3'>('mp4');
  const [muxingRes, setMuxingRes] = useState<string | null>(null);
  const [downloadingMp3, setDownloadingMp3] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (msg: string, type: LogType = 'system') => {
    const now = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const prefix =
      type === 'critical' ? '[error]' : type === 'success' ? '[success]' : '[info]';
    setLogs(prev => [
      ...prev,
      {
        msg: `${prefix} ${now} — ${msg}`,
        type,
      },
    ]);
  };

  const copyToClipboard = () => {
    if (!logs.length) return;
    navigator.clipboard
      .writeText(logs.map(l => l.msg).join('\n'))
      .then(() => {
        setCopyLabel('copied!');
        setTimeout(() => setCopyLabel('copy'), 2000);
      })
      .catch(() => {});
  };

  const handleExtract = async (retryCount = 0) => {
    if (!inputUrl) {
      addLog('URL must not be empty', 'critical');
      return;
    }

    const cleanUrl = inputUrl.trim().split('?')[0];
    setLoading(true);

    if (retryCount === 0) {
      setData(null);
      setLogs([]);
      setActiveTab('mp4');
    }

    addLog('Initializing extraction process...');
    addLog(`Target: ${cleanUrl.substring(0, 50)}...`);
    addLog('Connecting to server...');

    let shouldRetry = false;

    try {
      const res = await fetch(
        'https://warthadev-backend.onrender.com/extract/ytdl',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ url: cleanUrl }),
        }
      );

      const resData: ExtractResponse = await res.json();

      if (!res.ok || !resData.success) {
        addLog(
          `Extraction failed: ${
            resData.message || resData.error || `HTTP ${res.status}`
          }`,
          'critical'
        );
        return;
      }

      addLog(
        `Platform detected: ${resData.platform || 'unknown'}`,
        'success'
      );
      addLog(
        `Title: ${resData.title?.substring(0, 50) || 'untitled'}`,
        'success'
      );
      addLog(
        `Video formats available: ${resData.mp4_formats?.length || 0}`,
        'success'
      );
      addLog(
        `Audio formats available: ${resData.mp3_formats?.length || 0}`,
        'success'
      );
      addLog('Extraction completed.', 'success');
      setData(resData);
    } catch (e: any) {
      const msg = e?.message || 'Connection failed';
      if (retryCount < 2) {
        addLog(`${msg}. Retrying... (${retryCount + 1}/2)`, 'critical');
        shouldRetry = true;
      } else {
        addLog(msg, 'critical');
        addLog('Check your connection or try again later.', 'critical');
      }
    } finally {
      setLoading(false);
      if (!shouldRetry) addLog('System ready.');
    }

    if (shouldRetry) {
      setTimeout(() => handleExtract(retryCount + 1), 1500);
    }
  };

  const handleMuxDownload = async (fmt: Mp4Format) => {
    if (muxingRes) return;
    setMuxingRes(fmt.resolution);
    addLog(`Merging video + audio for ${fmt.resolution}...`);

    try {
      const res = await fetch(
        'https://warthadev-backend.onrender.com/extract/mux',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_url: fmt.video_url,
            audio_url: fmt.audio_url,
            resolution: fmt.resolution,
            title: data?.title || 'video_download',
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: mux failed`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const fileName = data?.uploader
        ? `${data.uploader} - ${data.title} - ${fmt.resolution}`
        : `${data?.title || 'video'} - ${fmt.resolution}`;
      a.download = `${fileName}.mp4`;
      a.click();
      URL.revokeObjectURL(blobUrl);

      addLog(`${fmt.resolution} merged and downloaded successfully.`, 'success');
    } catch (e: any) {
      addLog(`Mux failed: ${e?.message || 'unknown error'}`, 'critical');
    } finally {
      setMuxingRes(null);
    }
  };

  const handleMp3Download = async (fmt: Mp3Format) => {
    if (downloadingMp3) return;
    setDownloadingMp3(fmt.quality);
    addLog(`Downloading audio: ${fmt.quality}...`);
    try {
      const res = await fetch(fmt.audio_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const name = data?.uploader
        ? `${data.uploader} - ${data.title}`
        : data?.title || 'audio';
      a.download = `${name}.mp3`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      addLog('Audio downloaded successfully.', 'success');
    } catch (e: any) {
      addLog(
        `Audio download failed: ${e?.message || 'unknown error'}`,
        'critical'
      );
    } finally {
      setDownloadingMp3(null);
    }
  };

  const getLogColor = (type: LogType) => {
    if (type === 'critical') return 'var(--primary)';
    if (type === 'success') return 'var(--text)';
    return 'var(--text-sub)';
  };

  const uploaderTitle = data
    ? data.uploader
      ? `${data.uploader} — ${data.title}`
      : data.title
    : '';

  return (
    <div className="home-container">
      <main className="home-hero">
        {/* Input */}
        <div className="ytdl-input-row">
          <input
            type="text"
            className="ytdl-input"
            placeholder="Paste video link here..."
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleExtract()}
          />
          <button
            className={`ytdl-btn-run${loading ? ' loading' : ''}`}
            onClick={() => handleExtract()}
            disabled={loading}
          >
            {loading && <span className="ytdl-spinner" />}
            {loading ? 'Processing...' : 'Extract'}
          </button>
        </div>

        {/* Main content */}
        <div className={`ytdl-body${isMobile ? ' mobile' : ''}`}>
          {/* Console */}
          <div className="ytdl-console-wrap">
            <div className="ytdl-console-header">
              <span className="ytdl-console-label">● kernel log</span>
              <button className="ytdl-copy-btn" onClick={copyToClipboard}>
                {copyLabel}
              </button>
            </div>
            <div
              ref={terminalRef}
              className={`ytdl-terminal${isMobile ? ' mobile' : ''}`}
            >
              {logs.length === 0 && (
                <span className="ytdl-terminal-empty">
                  # Waiting for commands...
                </span>
              )}
              {logs.map((log, i) => (
                <div
                  key={i}
                  className="ytdl-log-line"
                  style={{
                    color: getLogColor(log.type),
                    fontWeight: log.type === 'critical' ? 'bold' : 'normal',
                  }}
                >
                  {log.msg}
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="ytdl-results-wrap">
            {data && (
              <div className="ytdl-result-card">
                {/* Thumbnail */}
                {data.thumbnail && (
                  <div className="ytdl-thumb-wrap">
                    <img src={data.thumbnail} className="ytdl-thumb" alt="" />
                    <div className="ytdl-platform-badge">
                      {data.platform}
                    </div>
                  </div>
                )}

                <div className="ytdl-result-body">
                  {/* Uploader - Title */}
                  <p className="ytdl-title">{uploaderTitle}</p>

                  {/* Tabs */}
                  <div className="ytdl-tabs">
                    {(['mp4', 'mp3'] as const).map(tab => (
                      <button
                        key={tab}
                        className={`ytdl-tab${
                          activeTab === tab ? ' active' : ''
                        }`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* MP4 list */}
                  {activeTab === 'mp4' && (
                    <div className="ytdl-format-list">
                      {!(data.mp4_formats?.length) && (
                        <p className="ytdl-empty">
                          No video formats available.
                        </p>
                      )}
                      {(data.mp4_formats || []).map(
                        (fmt: Mp4Format, i: number) => {
                          const isMuxing = muxingRes === fmt.resolution;
                          const sizeLabel = formatBytes(fmt.filesize);
                          const sizePart = sizeLabel ? ` · ${sizeLabel}` : '';
                          if (fmt.needs_mux) {
                            return (
                              <button
                                key={i}
                                className="ytdl-format-btn"
                                onClick={() => handleMuxDownload(fmt)}
                                disabled={!!muxingRes}
                                style={{
                                  opacity:
                                    muxingRes && !isMuxing ? 0.5 : 1,
                                }}
                              >
                                <span className="ytdl-format-res">
                                  {fmt.resolution}
                                  <span className="ytdl-mux-badge">
                                    needs mux
                                  </span>
                                </span>
                                <span className="ytdl-format-info">
                                  {isMuxing && (
                                    <span className="ytdl-spinner small" />
                                  )}
                                  {isMuxing
                                    ? 'Merging...'
                                    : `mp4${sizePart} · download ↓`}
                                </span>
                              </button>
                            );
                          }
                          return (
                            <a
                              key={i}
                              href={fmt.video_url}
                              target="_blank"
                              rel="noreferrer"
                              className="ytdl-format-btn"
                            >
                              <span className="ytdl-format-res">
                                {fmt.resolution}
                                <span className="ytdl-clean-badge">
                                  has audio
                                </span>
                              </span>
                              <span className="ytdl-format-info">
                                {`mp4${sizePart} · download ↓`}
                              </span>
                            </a>
                          );
                        }
                      )}
                    </div>
                  )}

                  {/* MP3 list */}
                  {activeTab === 'mp3' && (
                    <div className="ytdl-format-list">
                      {!(data.mp3_formats?.length) && (
                        <p className="ytdl-empty">
                          No audio formats available.
                        </p>
                      )}
                      {(data.mp3_formats || []).map(
                        (fmt: Mp3Format, i: number) => {
                          const isDownloading =
                            downloadingMp3 === fmt.quality;
                          const bitrateLabel = formatBitrate(fmt.bitrate);
                          const bitratePart = bitrateLabel ? ` · ${bitrateLabel}` : '';
                          return (
                            <button
                              key={i}
                              className="ytdl-format-btn"
                              onClick={() => handleMp3Download(fmt)}
                              disabled={!!downloadingMp3}
                              style={{
                                opacity:
                                  downloadingMp3 && !isDownloading ? 0.5 : 1,
                              }}
                            >
                              <span className="ytdl-format-res">
                                {fmt.quality}
                              </span>
                              <span className="ytdl-format-info">
                                {isDownloading && (
                                  <span className="ytdl-spinner small" />
                                )}
                                {isDownloading
                                  ? 'Downloading...'
                                  : `mp3${bitratePart} · download ↓`}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Page;