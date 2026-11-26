// Editor potong gambar BEBAS sebelum dikirim: gambar tampil utuh (tidak
// di-zoom menutupi kotak), seret kotak seleksi ke mana saja, tarik sudutnya
// untuk mengubah ukuran dan rasio sesuka hati. Hasil mengikuti rasio seleksi
// (sisi terpanjang max 1024px), bukan dipaksa persegi. File asli di perangkat
// tidak diubah — yang diganti hanya salinan yang mau dikirim.
import React, { useEffect, useRef, useState } from "react";

export interface CroppedImage {
  dataUrl: string;
  blob: Blob;
}

const MAX_SIDE = 1024;
const MIN_SEL = 40;
const MAX_VIEW_H = 380;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type Sel = { x: number; y: number; w: number; h: number };
type DragMode = "move" | "nw" | "ne" | "sw" | "se";

export const ImageCropper: React.FC<{
  src: string;
  fileName?: string;
  onDone: (result: CroppedImage) => void;
  onCancel: () => void;
}> = ({ src, fileName, onDone, onCancel }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ mode: DragMode; px: number; py: number; sel: Sel } | null>(null);
  const naturalRef = useRef<{ w: number; h: number } | null>(null);
  const boxRef = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    naturalRef.current = natural;
  }, [natural]);
  useEffect(() => {
    boxRef.current = box;
  }, [box]);

  // Pasang ukuran tampil gambar (contain, bukan cover) + seleksi awal 80%.
  const fitBox = (nat: { w: number; h: number }) => {
    const el = modalRef.current;
    if (!el) return;
    const contentW = el.getBoundingClientRect().width - 32; // padding modal 16px kiri-kanan
    if (contentW <= 0) return;
    const aspect = nat.w / nat.h;
    let w = contentW;
    let h = w / aspect;
    if (h > MAX_VIEW_H) {
      h = MAX_VIEW_H;
      w = h * aspect;
    }
    const prev = boxRef.current;
    if (prev && prev.w > 0) {
      // Jaga seleksi tetap proporsional saat ukuran tampilan berubah.
      const kx = w / prev.w;
      const ky = h / prev.h;
      setSel((s) => (s ? { x: s.x * kx, y: s.y * ky, w: s.w * kx, h: s.h * ky } : s));
    }
    setBox({ w, h });
    setSel((s) => s ?? { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 });
  };

  // Muat gambar asli + pasang ulang ukuran saat jendela berubah.
  useEffect(() => {
    const onResize = () => {
      const nat = naturalRef.current;
      if (nat) fitBox(nat);
    };
    window.addEventListener("resize", onResize);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Hitung kotak tampil saat ukuran asli diketahui.
  useEffect(() => {
    if (natural) fitBox(natural);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural]);

  const startDrag = (e: React.PointerEvent, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    if (!sel) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, px: e.clientX, py: e.clientY, sel: { ...sel } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !box) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    const s = d.sel;
    if (d.mode === "move") {
      setSel({ ...s, x: clamp(s.x + dx, 0, box.w - s.w), y: clamp(s.y + dy, 0, box.h - s.h) });
      return;
    }
    let { x, y, w, h } = s;
    if (d.mode === "se") {
      w = clamp(s.w + dx, MIN_SEL, box.w - s.x);
      h = clamp(s.h + dy, MIN_SEL, box.h - s.y);
    } else if (d.mode === "nw") {
      x = clamp(s.x + dx, 0, s.x + s.w - MIN_SEL);
      y = clamp(s.y + dy, 0, s.y + s.h - MIN_SEL);
      w = s.w + (s.x - x);
      h = s.h + (s.y - y);
    } else if (d.mode === "ne") {
      y = clamp(s.y + dy, 0, s.y + s.h - MIN_SEL);
      w = clamp(s.w + dx, MIN_SEL, box.w - s.x);
      h = s.h + (s.y - y);
    } else {
      x = clamp(s.x + dx, 0, s.x + s.w - MIN_SEL);
      w = s.w + (s.x - x);
      h = clamp(s.h + dy, MIN_SEL, box.h - s.y);
    }
    setSel({ x, y, w, h });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img || !natural || !box || !sel || busy) return;
    setBusy(true);
    try {
      const scale = box.w / natural.w;
      const sx = sel.x / scale;
      const sy = sel.y / scale;
      const sw = sel.w / scale;
      const sh = sel.h / scale;
      const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
      const outW = Math.max(1, Math.round(sw * k));
      const outH = Math.max(1, Math.round(sh * k));
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak tersedia");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
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
      <div className="aiagent-crop-modal" ref={modalRef}>
        <div className="aiagent-crop-title">Potong Gambar{fileName ? ` — ${fileName.length > 24 ? `${fileName.slice(0, 21)}…` : fileName}` : ""}</div>
        <div
          className="aiagent-crop-viewport"
          style={box ? { width: box.w, height: box.h, margin: "0 auto" } : undefined}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {natural && box && (
            <img
              src={src}
              alt="Gambar yang dipotong"
              draggable={false}
              style={{ width: box.w, height: box.h }}
            />
          )}
          {sel && box && (
            <div
              className="aiagent-crop-select"
              style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
              onPointerDown={(e) => startDrag(e, "move")}
            >
              <div className="aiagent-crop-grid" />
              {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                <span
                  key={corner}
                  className={`aiagent-crop-handle aiagent-crop-handle-${corner}`}
                  onPointerDown={(e) => startDrag(e, corner)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="aiagent-crop-actions">
          <button type="button" onClick={onCancel}>Batal</button>
          <button type="button" className="primary" onClick={handleCrop} disabled={!natural || !sel || busy}>
            {busy ? "Memotong…" : "Potong & Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
};
