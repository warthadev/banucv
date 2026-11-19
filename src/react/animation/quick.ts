// src/react/animation/quick.ts

// path quickMenuVariants: animasi untuk dropdown menu quick access
export const quickMenuVariants = {
  initial: { opacity: 0, y: 10, scale: 0.95 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      duration: 0.2, 
      ease: "easeOut" 
    }
  },
  exit: { 
    opacity: 0, 
    y: 10, 
    scale: 0.95,
    transition: { 
      duration: 0.15, 
      ease: "easeIn" 
    }
  }
};

// path quickToggleVariants: animasi untuk tombol toggle quick access
export const quickToggleVariants = {
  idle: { 
    scale: 1,
    rotate: 0,
    backgroundColor: "var(--bg-alpha)",
    color: "var(--text)"
  },
  tap: { 
    scale: 0.95,
    transition: { 
      duration: 0.05
    }
  },
  open: { 
    rotate: 90,
    backgroundColor: "var(--primary)",
    color: "#ffffff",
    transition: { 
      duration: 0.15,
      ease: "easeInOut"
    }
  }
};

// path quickItemVariants: animasi untuk setiap item dalam dropdown
export const quickItemVariants = {
  hidden: { opacity: 0, x: -5 },
  visible: (custom: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: custom * 0.01,
      duration: 0.1,
      ease: "easeOut"
    }
  }),
  exit: {
    opacity: 0,
    x: 5,
    transition: {
      duration: 0.08,
      ease: "easeIn"
    }
  }
};

// path quickWrapperVariants: animasi untuk posisi wrapper (responsif terhadap player)
export const quickWrapperVariants = {
  withPlayer: { 
    bottom: 110,
    right: '5%',
    transition: { 
      duration: 0.2,
      ease: "easeOut"
    }
  },
  withoutPlayer: { 
    bottom: 24,
    right: '5%',
    transition: { 
      duration: 0.2,
      ease: "easeOut"
    }
  }
};

// path quickOverlayVariants: animasi untuk overlay
export const quickOverlayVariants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: { duration: 0.1 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.1 }
  }
};