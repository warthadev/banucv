// Variants untuk Judul & Subtitle (Hero)
export const heroVariants = {
  initial: { opacity: 0, y: -30 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.8, 
      ease: [0.19, 1, 0.22, 1] 
    }
  }
} as const; // 🔥 Tambah as const di sini

// Variants untuk Grid Container (Stagger logic)
export const gridVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
} as const; // 🔥 Tambah as const di sini

// Variants untuk Feature Card
export const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { 
      type: "spring", 
      stiffness: 260, 
      damping: 20 
    }
  }
} as const; // 🔥 Tambah as const di sini

// Variants untuk Social Icons (Quick Connect)
export const socialIconVariants = {
  hover: { scale: 1.2 },
  tap: { scale: 0.9 }
} as const; // 🔥 Tambah as const di sini
