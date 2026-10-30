import { FiHome, FiHeart, FiSettings, FiCodesandbox, FiCpu } from "react-icons/fi";

// Data Link Navigasi
export const navLinks = [
  { to: "/", label: "Home", icon: FiHome },
  { to: "/donation", label: "Support", icon: FiHeart },
  { to: "/setting", label: "Setting", icon: FiSettings },
];

// Animasi Hamburger
export const hamburgerVariants = {
  line1: { 
    closed: { rotate: 0, translateY: 0 }, 
    opened: { rotate: 45, translateY: 8 } 
  },
  line2: { 
    closed: { opacity: 1, scale: 1 }, 
    opened: { opacity: 0, scale: 0 } 
  },
  line3: { 
    closed: { rotate: 0, translateY: 0 }, 
    opened: { rotate: -45, translateY: -8 } 
  },
};

// Animasi Dropdown Mobile
export const dropdownVariants = {
  initial: { opacity: 0, y: -10, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.95 },
};
