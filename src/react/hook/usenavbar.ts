// src/react/hook/usenavbar.ts
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../redux/store";
import { logout } from "../redux/authslice";
import { resetCloud } from "../redux/cloudslice";
import { signOut } from "firebase/auth";
import { getAuth } from "@config/firebase";
import { clearGithubCredentials } from "@config/githubeditorhelper";
import { invalidateAgentCache } from "@hook/useAgentModels";

export const useNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  
  const [openMenuLocationKey, setOpenMenuLocationKey] = useState<string | null>(null);
  const isMenuOpen = openMenuLocationKey === location.key;

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
    const handleResize = () => {
      if (window.innerWidth > 640) setOpenMenuLocationKey(null);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async (e?: React.MouseEvent<HTMLElement>) => {
    if (e?.preventDefault) e.preventDefault();
    try {
      const auth = await getAuth();
      await signOut(auth);
      clearGithubCredentials();
      invalidateAgentCache();
    } catch (error) {
      console.error("Logout Error:", error);
    } finally {
      dispatch(resetCloud());
      dispatch(logout());
      setOpenMenuLocationKey(null);
      navigate("/", { replace: true });
    }
  };

  const toggleMenu = () => setOpenMenuLocationKey(isMenuOpen ? null : location.key);
  const closeMenu = () => setOpenMenuLocationKey(null);

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