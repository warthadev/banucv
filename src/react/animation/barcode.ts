// Main Card Animation
export const cardVariants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      type: "spring", 
      stiffness: 260, 
      damping: 20 
    } as const
  }
};

// Input Switch Animation (AnimatePresence)
export const inputVariants = {
  initial: { opacity: 0, x: -10 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.2 } 
  },
  exit: { 
    opacity: 0, 
    x: 10,
    transition: { duration: 0.2 } 
  }
};

// Button Interaction
export const btnTapVariants = {
  scale: 0.96
};
