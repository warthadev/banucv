// Config pegas yang lu pake
export const springConfig = { 
  type: "spring", 
  stiffness: 300, 
  damping: 20 
} as const;

// Variants untuk Card Utama
export const cardVariants = {
  initial: { opacity: 0, y: 40, scale: 0.95 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      duration: 0.7, 
      ease: [0.19, 1, 0.22, 1] 
    }
  }
} as const;

// Variants untuk Header (Title & Text)
export const textVariants = (delay: number) => ({
  initial: { opacity: 0 },
  animate: { 
    opacity: 1, 
    transition: { delay } 
  }
} as const);

// Variants untuk Icon Box
export const iconVariants = (delay: number) => ({
  initial: { y: 20, opacity: 0, scale: 0.5 },
  animate: { 
    y: 0, 
    opacity: 1, 
    scale: 1,
    transition: { ...springConfig, delay }
  },
  hover: { y: -8, scale: 1.05 },
  tap: { scale: 0.9 }
} as const);
