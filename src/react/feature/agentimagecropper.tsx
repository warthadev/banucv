// Editor crop gambar sebelum dikirim: geser gambar, atur zoom dan rasio
// area crop, lalu hasilnya dirender via canvas. Bingkai LUAR selalu statik
// (kotak tetap); yang berubah hanya area crop di dalamnya — gambar digeser
// / di-zoom sampai menutupi area crop, sisanya digelapkan. File asli di
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

  // Bingkai LUAR statik: selalu kotak selebar viewport, apa pun rasionya.
  // Area crop di dalamnya yang berubah: selebar bingkai kalau landscape,
  // setinggi bingkai kalau portrait, selalu di tengah.
  const cropW = aspect >= 1 ? size : size * aspect;
  const cropH = aspect >= 1 ? size / aspect : size;
  const cropX = (size - cropW) / 2;
  const cropY = (size - cropH) / 2;
  // Gambar harus selalu menutupi area crop (bukan bingkai).
  const base = natural && size > 0 ? Math.max(cropW / natural.w, cropH / natural.h) : 1;
  const dispW = natural ? natural.w * base * zoom : 0;
  const dispH = natural ? natural.h * base * zoom : 0;

  const prevAspectRef = useRef(aspect);
  // Posisikan di tengah saat gambar pertama kali dimuat / ukuran berubah /
  // rasio diganti. Setelahnya: jaga gambar tetap menutupi area crop.
  useEffect(() => {
    if (!natural) return;
    const aspectChanged = prevAspectRef.current !== aspect;
    prevAspectRef.current = aspect;
    setOffset((prev) => {
      const cx = cropX + (cropW - dispW) / 2;
      const cy = cropY + (cropH - dispH) / 2;
      // Pertama kali atau rasio diganti: tengah. Setelahnya: jaga tetap
      // menutupi area crop.
      if (prev.x === 0 && prev.y === 0) return { x: cx, y: cy };
      if (aspectChanged) return { x: cx, y: cy };
      return { x: clamp(prev.x, cropX + cropW - dispW, cropX), y: clamp(prev.y, cropY + cropH - dispH, cropY) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, size, aspect]);

  const applyZoom = (next: number) => {
    const z = clamp(next, MIN_ZOOM, MAX_ZOOM);
    if (!natural || z === zoom) return;
    const ratio = z / zoom;
    const cx = cropX + cropW / 2;
    const cy = cropY + cropH / 2;
    const nx = cx + (offset.x - cx) * ratio;
    const ny = cy + (offset.y - cy) * ratio;
    const nw = natural.w * base * z;
    const nh = natural.h * base * z;
    setZoom(z);
    setOffset({ x: clamp(nx, cropX + cropW - nw, cropX), y: clamp(ny, cropY + cropH - nh, cropY) });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({
      x: clamp(d.ox + (e.clientX - d.px), cropX + cropW - dispW, cropX),
      y: clamp(d.oy + (e.clientY - d.py), cropY + cropH - dispH, cropY),
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img || !natural || busy) return;
    setBusy(true);
    try {
      const scale = base * zoom;
      const sx = (cropX - offset.x) / scale;
      const sy = (cropY - offset.y) / scale;
      const sw = cropW / scale;
      const sh = cropH / scale;
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
          style={{ height: `${size}px` }}
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
          {/* Bingkai luar statik; di luar area crop digelapkan, grid hanya di dalam area crop. */}
          <div className="aiagent-crop-dim" style={{ left: 0, top: 0, width: "100%", height: cropY }} />
          <div className="aiagent-crop-dim" style={{ left: 0, top: cropY + cropH, width: "100%", height: size - (cropY + cropH) }} />
          <div className="aiagent-crop-dim" style={{ left: 0, top: cropY, width: cropX, height: cropH }} />
          <div className="aiagent-crop-dim" style={{ left: cropX + cropW, top: cropY, width: size - (cropX + cropW), height: cropH }} />
          <div className="aiagent-crop-frame" style={{ left: cropX, top: cropY, width: cropW, height: cropH }}>
            <div className="aiagent-crop-grid" />
          </div>
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
            onChange={(e) => { setAspect(Number(e.target.value)); }}
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
