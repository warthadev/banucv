// src/react/hook/usenavbar.ts
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../redux/store";
import { logout } from "../redux/authslice";
import { signOut } from "firebase/auth";
import { auth } from "@config/firebase";
import { clearGithubCredentials } from "@config/githubeditorhelper";

export const useNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isHomePage = location.pathname === "/";
  const showNavAndHamburger = !isHomePage;

  useEffect(() => {
    const syncAuth = () => {
      const token = localStorage.getItem("token");
      const currentIsLoggedIn = !!token;
      if (currentIsLoggedIn !== isLoggedIn) {
        window.location.reload();
      }
    };
    
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, [isLoggedIn]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 640) setIsMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async (e: React.MouseEvent | any) => {
    if (e?.preventDefault) e.preventDefault();
    try {
      await signOut(auth);
      clearGithubCredentials(); // Hapus data GitHub dari localStorage
    } catch (error) {
      console.error("Logout Error:", error);
    } finally {
      dispatch(logout());
      setIsMenuOpen(false);
      navigate("/", { replace: true });
    }
  };

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return {
    isLoggedIn,
    isMenuOpen,
    isHomePage,
    showNavAndHamburger,
    handleLogout,
    toggleMenu,
    closeMenu
  };
};