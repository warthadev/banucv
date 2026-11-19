// src/react/animation/githubeditor.ts

// ============================================
// LIST & ITEM ANIMATIONS
// ============================================

export const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.035 },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.16, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: 0.12 },
  },
};

// ============================================
// SIDEBAR ANIMATIONS
// ============================================

export const sidebarDesktopVariants = {
  open: {
    width: 290,
    opacity: 1,
    transition: {
      duration: 0.22,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  closed: {
    width: 0,
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// ============================================
// MODAL ANIMATIONS
// ============================================

export const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.17,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    transition: {
      duration: 0.13,
    },
  },
};

// ============================================
// OVERLAY ANIMATIONS
// ============================================

export const overlayVariants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: { duration: 0.14 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.14 },
  },
};

// ============================================
// TOGGLE BUTTON ANIMATIONS
// ============================================

export const toggleButtonVariants = {
  initial: {
    opacity: 0,
    x: -6,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.15 },
  },
  exit: {
    opacity: 0,
    x: -6,
    transition: { duration: 0.15 },
  },
};

// ============================================
// EMPTY STATE ANIMATIONS
// ============================================

export const emptyStateVariants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: { duration: 0.14 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.14 },
  },
};