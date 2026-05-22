import React, { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Download, Link, MessageCircle, Wifi } from "lucide-react";
import { Toaster, toast } from "sonner";
import { cardVariants, inputVariants, btnTapVariants } from "@/react/animation/barcode";

const BarcodePage: React.FC = () => {
  const [type, setType] = useState<"text" | "wa" | "wifi">("text");
  const [inputValue, setInputValue] = useState<string>("");
  const [waNumber, setWaNumber] = useState<string>("");
  const [waMessage, setWaMessage] = useState<string>("");
  const [wifiSsid, setWifiSsid] = useState<string>("");
  const [wifiPass, setWifiPass] = useState<string>("");
  const [finalValue, setFinalValue] = useState<string>(" ");
  
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (type === "text") {
      setFinalValue(inputValue.trim() || " ");
    } else if (type === "wa") {
      const cleanNum = waNumber.replace(/\D/g, "");
      setFinalValue(cleanNum ? `https://wa.me/${cleanNum}?text=${encodeURIComponent(waMessage)}` : " ");
    } else if (type === "wifi") {
      setFinalValue(wifiSsid ? `WIFI:S:${wifiSsid};T:WPA;P:${wifiPass};;` : " ");
    }
  }, [type, inputValue, waNumber, waMessage, wifiSsid, wifiPass]);

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const size = 1200; 
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = size;
      canvas.height = size;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, size, size);
      }
      
      const pngFile = canvas.toDataURL("image/png", 1.0);
      const downloadLink = document.createElement("a");
      downloadLink.download = `qrcode-hd-${type}-${Date.now()}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      
      URL.revokeObjectURL(url);
      toast.success("HD QR Code downloaded successfully!");
    };

    img.src = url;
  };

  return (
    <div className="barcode-container">
      <Toaster position="top-center" richColors />
      <motion.div 
        layout 
        className="barcode-card"
        variants={cardVariants}
        initial="initial"
        animate="animate"
      >
        <motion.div layout className="barcode-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <QrCode size={24} color="var(--primary-blue)" />
          <h1 className="barcode-title">QR Generator</h1>
        </motion.div>
        
        <motion.div layout className="type-selector">
          <button className={type === "text" ? "active" : ""} onClick={() => setType("text")}><Link size={16}/> Link</button>
          <button className={type === "wa" ? "active" : ""} onClick={() => setType("wa")}><MessageCircle size={16}/> WhatsApp</button>
          <button className={type === "wifi" ? "active" : ""} onClick={() => setType("wifi")}><Wifi size={16}/> WiFi</button>
        </motion.div>

        <motion.div layout className="barcode-display" ref={qrRef}>
          <QRCodeSVG 
            value={finalValue} 
            size={180} 
            level={"H"} 
            includeMargin={false} 
          />
        </motion.div>

        <motion.div layout className="barcode-input-group">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={type}
              variants={inputVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {type === "text" && (
                <input
                  type="text"
                  className="barcode-input"
                  placeholder="Enter URL or Text..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              )}

              {type === "wa" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="number"
                    className="barcode-input"
                    placeholder="Example: 62812345678"
                    value={waNumber}
                    onChange={(e) => setWaNumber(e.target.value)}
                  />
                  <input
                    type="text"
                    className="barcode-input"
                    placeholder="Auto-message (optional)..."
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                  />
                </div>
              )}

              {type === "wifi" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="text"
                    className="barcode-input"
                    placeholder="WiFi Name (SSID)..."
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                  />
                  <input
                    type="text"
                    className="barcode-input"
                    placeholder="WiFi Password..."
                    value={wifiPass}
                    onChange={(e) => setWifiPass(e.target.value)}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <motion.button 
            layout
            className="barcode-btn" 
            onClick={handleDownload} 
            disabled={finalValue === " "}
            whileTap={btnTapVariants}
          >
            <Download size={18} style={{ marginRight: '8px' }} />
            Download HD PNG
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default BarcodePage;