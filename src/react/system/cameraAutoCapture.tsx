// src/react/system/cameraAutoCapture.tsx
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2 } from 'lucide-react';
import { auth, db } from '@config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

interface CameraAutoCaptureProps {
  onComplete: (photoURL: string) => void;
  onError: (error: string) => void;
}

const CameraAutoCapture: React.FC<CameraAutoCaptureProps> = ({ onComplete, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'requesting' | 'ready' | 'capturing' | 'uploading' | 'done'>('requesting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setStatus('requesting');
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus('ready');
          // Auto capture after 1 second (give time for camera to adjust)
          setTimeout(() => capturePhoto(), 1000);
        }
      } catch (err: any) {
        console.error('Camera error:', err);
        setErrorMsg(err.message || 'Could not access camera');
        onError('Camera access denied or failed');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = async () => {
    if (status !== 'ready') return;
    setStatus('capturing');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to JPEG base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setStatus('uploading');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user');

      const storage = getStorage();
      const filename = `selfie_${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `selfies/${filename}`);
      await uploadString(storageRef, imageData, 'data_url');
      const downloadURL = await getDownloadURL(storageRef);

      // Save URL to Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        selfieUrl: downloadURL,
        selfieTakenAt: new Date().toISOString(),
      });

      setStatus('done');
      onComplete(downloadURL);
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorMsg(err.message || 'Failed to save photo');
      onError('Failed to save selfie');
    }
  };

  return (
    <div className="camera-auto-overlay">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="camera-auto-card"
      >
        <div className="camera-auto-header">
          <Camera size={28} />
          <h3>Identity Verification</h3>
        </div>

        <div className="camera-auto-preview">
          {status === 'requesting' && (
            <div className="camera-placeholder">
              <Loader2 className="spin" size={40} />
              <p>Requesting camera access...</p>
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline muted className="camera-video" style={{ display: status === 'ready' ? 'block' : 'none' }} />
          {(status === 'capturing' || status === 'uploading') && (
            <div className="camera-placeholder">
              <Loader2 className="spin" size={40} />
              <p>{status === 'capturing' ? 'Capturing...' : 'Uploading...'}</p>
            </div>
          )}
          {status === 'done' && (
            <div className="camera-success">
              <Camera size={48} />
              <p>Photo saved</p>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="camera-error">
            <p>Error: {errorMsg}</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </motion.div>

      <style>{`
        .camera-auto-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }
        .camera-auto-card {
          background: var(--card-bg);
          border-radius: 24px;
          padding: 24px;
          width: 90%;
          max-width: 400px;
          text-align: center;
          border: 1px solid var(--border-color);
        }
        .camera-auto-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 20px;
          color: var(--primary);
        }
        .camera-auto-header h3 {
          margin: 0;
          font-size: 1.2rem;
        }
        .camera-auto-preview {
          width: 100%;
          aspect-ratio: 4/3;
          background: #000;
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .camera-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: white;
        }
        .camera-success {
          color: var(--primary);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .camera-error {
          color: #ef4444;
          margin-top: 12px;
        }
        .camera-error button {
          margin-top: 8px;
          padding: 8px 16px;
          background: var(--primary);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CameraAutoCapture;