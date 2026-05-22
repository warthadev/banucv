// src/react/system/quick.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAudio } from '@hook/useaudio';
import { useSelector } from 'react-redux';
import type { RootState } from '@redux/store';
import { 
  LayoutGrid, 
  Bot, 
  MessageSquareText, 
  Download, 
  Loader2, 
  QrCode,
  X,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  quickMenuVariants, 
  quickToggleVariants, 
  quickItemVariants, 
  quickWrapperVariants,
  quickOverlayVariants
} from '@animation/quick';
import { GithubIcon } from '@control/icon';

const quickMenuItems = [
  { name: 'AI Check', path: '/ai-check', icon: Bot, description: 'Analyze system status' },
  { name: 'AI Chat', path: '/ai-chat', icon: MessageSquareText, description: 'Interactive assistant' },
  { name: 'Downloader', path: '/downloader', icon: Download, description: 'Extract video content' },
  { name: 'GitHub Repo', path: '/github-editor', icon: GithubIcon, description: 'Manage & edit GitHub repositories' },
  { name: 'Loading Test', path: '/loading', icon: Loader2, description: 'Test UI loading states' },
  { name: 'Barcode', path: '/barcode', icon: QrCode, description: 'Scan or generate codes' },
  // Tambah di quickMenuItems array
  { name: 'Collect Photo', path: '/collect-photo', icon: Camera, description: 'View all user selfies' },
];

const Quick: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isStopped, selectedGenre } = useAudio();
  const isQuickVisible = useSelector((state: RootState) => state.visible.isQuickVisible);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [isOpen, setIsOpen] = useState(false);

  const isDashboard = location.pathname === "/dashboard";
  const isPlayerActive = isDashboard && selectedGenre && !isStopped;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  if (!isQuickVisible) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={quickOverlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="quick-menu-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'transparent',
              zIndex: 9998
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.div 
        ref={menuRef}
        className="quick-action-wrapper" 
        variants={quickWrapperVariants}
        animate={isPlayerActive ? "withPlayer" : "withoutPlayer"}
        style={{ position: 'fixed', zIndex: 10000 }}
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              variants={quickMenuVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="quick-dropdown-menu"
              role="menu"
            >
              <div className="quick-menu-header">QUICK ACCESS</div>
              
              <div className="dropdown-list-wrapper">
                {quickMenuItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.name}
                      custom={index}
                      variants={quickItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onClick={() => handleNavigate(item.path)}
                      className="dropdown-item-btn"
                      role="menuitem"
                      aria-label={`Open ${item.name}`}
                    >
                      <div className="item-icon-wrapper">
                        <Icon 
                          size={18} 
                          strokeWidth={2.5} 
                          className={item.name === 'Loading Test' ? 'animate-spin' : ''} 
                          style={{ color: 'currentColor' }}
                        />
                      </div>
                      <div className="item-text-group">
                        <span className="item-name">{item.name}</span>
                        <span className="item-desc">{item.description}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button 
          className={`quick-toggle-btn ${isOpen ? 'active' : ''}`}
          variants={quickToggleVariants}
          initial="idle"
          animate={isOpen ? "open" : "idle"}
          whileTap="tap"
          onClick={toggleMenu}
          aria-label={isOpen ? "Close quick menu" : "Open quick menu"}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <X size={24} strokeWidth={2.5} style={{ color: '#ffffff' }} />
          ) : (
            <LayoutGrid size={24} strokeWidth={2.5} style={{ color: 'var(--text)' }} />
          )}
        </motion.button>
      </motion.div>
    </>
  );
};

export default Quick;