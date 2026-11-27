// Editor crop gambar sebelum dikirim: geser gambar, atur zoom dan rasio
// area crop, lalu hasilnya dirender via canvas. File asli di
// perangkat tidak diubah — yang diganti hanya salinan yang mau dikirim.
import React, { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

export interface CroppedImage {
  dataUrl: string;
  blob: Blob;
}

const OUTPUT_SIZE = 1024;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const MIN_ASPECT = 0.5;
const MAX_ASPECT = 2.0;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const ImageCropper: React.FC<{
  src: string;
  fileName?: string;
  onDone: (result: CroppedImage) => void;
  onCancel: () => void;
}> = ({ src, fileName, onDone, onCancel }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [size, setSize] = useState(280);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Ukur viewport (lebar modal bisa beda di HP) + muat gambar asli.
  useEffect(() => {
    const el = viewportRef.current;
    if (el) setSize(el.getBoundingClientRect().width);
    const onResize = () => { if (viewportRef.current) setSize(viewportRef.current.getBoundingClientRect().width); };
    window.addEventListener("resize", onResize);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => window.removeEventListener("resize", onResize);
  }, [src]);

  // Rasio area crop dapat diubah bebas dalam rentang lebar/potret.
  const viewportHeight = size / aspect;
  const base = natural && size > 0 ? Math.max(size / natural.w, viewportHeight / natural.h) : 1;
  const dispW = natural ? natural.w * base * zoom : 0;
  const dispH = natural ? natural.h * base * zoom : 0;

  // Posisikan di tengah saat gambar pertama kali dimuat / ukuran berubah.
  useEffect(() => {
    if (!natural) return;
    setOffset((prev) => {
      const cx = (size - dispW) / 2;
      const cy = (viewportHeight - dispH) / 2;
      // Pertama kali: tengah. Setelahnya: jaga tetap menutupi viewport.
      if (prev.x === 0 && prev.y === 0) return { x: cx, y: cy };
      return { x: clamp(prev.x, size - dispW, 0), y: clamp(prev.y, viewportHeight - dispH, 0) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, size, aspect]);

  const applyZoom = (next: number) => {
    const z = clamp(next, MIN_ZOOM, MAX_ZOOM);
    if (!natural || z === zoom) return;
    const ratio = z / zoom;
    const cx = size / 2;
    const cy = viewportHeight / 2;
    const nx = cx + (offset.x - cx) * ratio;
    const ny = cy + (offset.y - cy) * ratio;
    const nw = natural.w * base * z;
    const nh = natural.h * base * z;
    setZoom(z);
    setOffset({ x: clamp(nx, size - nw, 0), y: clamp(ny, viewportHeight - nh, 0) });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({
      x: clamp(d.ox + (e.clientX - d.px), size - dispW, 0),
      y: clamp(d.oy + (e.clientY - d.py), viewportHeight - dispH, 0),
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img || !natural || busy) return;
    setBusy(true);
    try {
      const scale = base * zoom;
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sw = size / scale;
      const sh = viewportHeight / scale;
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = Math.max(1, Math.round(OUTPUT_SIZE / aspect));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak tersedia");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        setBusy(false);
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") onDone({ dataUrl: reader.result, blob });
        };
        reader.readAsDataURL(blob);
      }, "image/jpeg", 0.92);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="aiagent-crop-overlay" role="dialog" aria-modal="true" aria-label="Potong gambar">
      <div className="aiagent-crop-modal">
        <div className="aiagent-crop-title">Potong Gambar Bebas{fileName ? ` — ${fileName.length > 24 ? `${fileName.slice(0, 21)}…` : fileName}` : ""}</div>
        <div
          ref={viewportRef}
          className="aiagent-crop-viewport"
          style={{ aspectRatio: `${aspect}`, height: "auto" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {natural && (
            <img
              src={src}
              alt="Gambar yang dipotong"
              draggable={false}
              style={{
                width: `${natural.w * base * zoom}px`,
                height: `${natural.h * base * zoom}px`,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          <div className="aiagent-crop-grid" />
        </div>
        <div className="aiagent-crop-controls">
          <ZoomOut size={16} />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.1}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label="Zoom"
          />
          <ZoomIn size={16} />
        </div>
        <div className="aiagent-crop-controls">
          <span className="aiagent-crop-ratio-label">Rasio</span>
          <input
            type="range"
            min={MIN_ASPECT}
            max={MAX_ASPECT}
            step={0.01}
            value={aspect}
            onChange={(e) => { setAspect(Number(e.target.value)); setOffset({ x: 0, y: 0 }); }}
            aria-label="Rasio crop bebas"
          />
          <span className="aiagent-crop-ratio-value">{aspect.toFixed(2)}:1</span>
        </div>
        <div className="aiagent-crop-actions">
          <button type="button" onClick={onCancel}>Batal</button>
          <button type="button" className="primary" onClick={handleCrop} disabled={!natural || busy}>
            {busy ? "Memotong…" : "Potong & Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
};
