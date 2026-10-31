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
  Camera,
  Cloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  quickMenuVariants, 
  quickToggleVariants, 
  quickItemVariants,
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
  { name: 'Collect Photo', path: '/collect-photo', icon: Camera, description: 'View all user selfies' },
  { name: 'Cloud Manager', path: '/cloudview', icon: Cloud, description: 'Browse Telegram files' },
];

const Quick: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPlaying, isStopped, selectedGenre } = useAudio();
  const isQuickVisible = useSelector((state: RootState) => state.visible.isQuickVisible);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [isClick, setIsClick] = useState(true);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [isCloudPlaylistActive, setIsCloudPlaylistActive] = useState(false);
  const [floatingBounds, setFloatingBounds] = useState<{ left: number; right: number; top: number; bottom: number } | null>(null);

  const isDashboard = location.pathname === "/dashboard";
  const isPlayerActive = (!!selectedGenre && isPlaying && !isStopped) || isCloudPlaylistActive;
  const isSettingPage = location.pathname === "/setting";

  useEffect(() => {
    const handlePlaylistState = (event: Event) => {
      const active = (event as CustomEvent<{ active?: boolean }>).detail?.active === true;
      setIsCloudPlaylistActive(active);
    };
    window.addEventListener('playlist:state', handlePlaylistState);
    return () => window.removeEventListener('playlist:state', handlePlaylistState);
  }, []);

  useEffect(() => {
    const handleFloatingBounds = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean; left?: number; right?: number; top?: number; bottom?: number }>).detail;
      if (detail?.active && [detail.left, detail.right, detail.top, detail.bottom].every((value) => typeof value === 'number')) {
        setFloatingBounds({ left: detail.left!, right: detail.right!, top: detail.top!, bottom: detail.bottom! });
      } else {
        setFloatingBounds(null);
      }
    };
    window.addEventListener('floating:bounds', handleFloatingBounds);
    return () => window.removeEventListener('floating:bounds', handleFloatingBounds);
  }, []);

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 600) setScreenSize('mobile');
      else if (width < 1024) setScreenSize('tablet');
      else setScreenSize('desktop');
    };
    
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  const clampPosition = (pos: { x: number; y: number }) => {
    const btnSize = screenSize === 'mobile' ? 48 : 54;
    const padding = 10;
    const maxX = window.innerWidth - btnSize - padding;
    const maxY = window.innerHeight - btnSize - padding;
    
    if (pos.x === 0 && pos.y === 0) return { x: 0, y: 0 };

    const safe = {
      x: Math.max(padding, Math.min(Number.isFinite(pos.x) ? pos.x : padding, maxX)),
      y: Math.max(padding, Math.min(Number.isFinite(pos.y) ? pos.y : padding, maxY))
    };
    if (!floatingBounds) return safe;

    const gap = 12;
    const overlaps = (x: number, y: number) => (
      x < floatingBounds.right + gap &&
      x + btnSize > floatingBounds.left - gap &&
      y < floatingBounds.bottom + gap &&
      y + btnSize > floatingBounds.top - gap
    );
    if (!overlaps(safe.x, safe.y)) return safe;

    const aboveY = floatingBounds.top - btnSize - gap;
    if (aboveY >= padding && !overlaps(safe.x, aboveY)) return { x: safe.x, y: aboveY };

    const leftX = floatingBounds.left - btnSize - gap;
    if (leftX >= padding && !overlaps(leftX, safe.y)) return { x: leftX, y: safe.y };

    const rightX = floatingBounds.right + gap;
    if (rightX <= maxX && !overlaps(rightX, safe.y)) return { x: rightX, y: safe.y };

    return { x: safe.x, y: Math.max(padding, aboveY) };
  };

  useEffect(() => {
    const saved = localStorage.getItem('quick_position');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        const clamped = clampPosition(pos);
        setPosition(clamped);
        setHasMoved(clamped.x !== 0 || clamped.y !== 0);
      } catch (e) {
        console.warn('Failed to load quick position');
      }
    }
  }, [screenSize, floatingBounds]);

  useEffect(() => {
    if (hasMoved) {
      const clamped = clampPosition(position);
      if (clamped.x !== position.x || clamped.y !== position.y) {
        setPosition(clamped);
      }
    }
  }, [screenSize, floatingBounds]);

  useEffect(() => {
    if (hasMoved) {
      localStorage.setItem('quick_position', JSON.stringify(position));
    }
  }, [position, hasMoved]);

  useEffect(() => {
    if (isOpen && toggleRef.current) {
      const rect = toggleRef.current.getBoundingClientRect();
      setButtonRect(rect);
    }
  }, [isOpen]);

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
    if (isClick) {
      setIsOpen(!isOpen);
    }
  };

  const handleDragStart = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    setDragStartPos({ x: clientX, y: clientY });
    setIsClick(true);
    setIsDragging(true);
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top
    });
  };

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const deltaX = Math.abs(clientX - dragStartPos.x);
    const deltaY = Math.abs(clientY - dragStartPos.y);
    
    if (deltaX > 5 || deltaY > 5) {
      setIsClick(false);
    }
    
    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;
    
    setPosition(clampPosition({ x: newX, y: newY }));
    setHasMoved(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  const resetPosition = () => {
    setPosition({ x: 0, y: 0 });
    setHasMoved(false);
    localStorage.removeItem('quick_position');
  };

  const getDropdownStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 99999,
      backgroundColor: 'var(--bg-alpha)',
      backdropFilter: 'blur(15px)',
      WebkitBackdropFilter: 'blur(15px)',
      border: isDashboard ? 'none' : '1px solid var(--border-color)',
      borderRadius: '20px',
      padding: '8px',
      width: screenSize === 'mobile' ? '200px' : '230px',
      maxHeight: screenSize === 'mobile' ? '360px' : '420px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    };

    if (!buttonRect) return style;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dropdownWidth = screenSize === 'mobile' ? 200 : 230;
    const dropdownHeight = Math.min(screenSize === 'mobile' ? 320 : 360, vh - 40);
    const gap = 4;

    const isLeftSide = buttonRect.left < vw / 2;
    let left: number;
    if (isLeftSide) {
      left = buttonRect.right + gap;
      if (left + dropdownWidth + 10 > vw) {
        left = buttonRect.left - dropdownWidth - gap;
      }
    } else {
      left = buttonRect.left - dropdownWidth - gap;
      if (left < 10) {
        left = buttonRect.right + gap;
      }
    }

    const spaceBelow = vh - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    let top: number;

    if (spaceBelow >= spaceAbove) {
      top = buttonRect.bottom + gap;
      if (top + dropdownHeight + 10 > vh) {
        top = buttonRect.top - dropdownHeight - gap;
      }
    } else {
      top = buttonRect.top - dropdownHeight - gap;
      if (top < 10) {
        top = buttonRect.bottom + gap;
      }
    }

    left = Math.max(10, Math.min(left, vw - dropdownWidth - 10));
    top = Math.max(10, Math.min(top, vh - dropdownHeight - 10));

    style.left = left + 'px';
    style.top = top + 'px';
    style.width = dropdownWidth + 'px';
    style.maxHeight = dropdownHeight + 'px';

    return style;
  };

  const btnSize = screenSize === 'mobile' ? 48 : 54;
  const padding = 10;
  const maxX = window.innerWidth - btnSize - padding;
  const maxY = window.innerHeight - btnSize - padding;
  
  const hasCustomPosition = hasMoved && position.x >= padding && position.x <= maxX && position.y >= padding && position.y <= maxY;
  const finalX = hasCustomPosition ? position.x : 0;
  const finalY = hasCustomPosition ? position.y : 0;

  const bottomPosition = isPlayerActive ? 110 : 24;

  const getToggleClassName = () => {
    if (isDashboard) {
      return 'quick-toggle-btn dashboard-active';
    }
    return `quick-toggle-btn ${isOpen ? 'active' : ''}`;
  };

  if (!isQuickVisible || isSettingPage) {
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

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            variants={quickMenuVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={getDropdownStyle()}
            className={`quick-dropdown-menu${isDashboard ? ' quick-dropdown-menu--dashboard' : ''}`}
            role="menu"
          >
            <div className="quick-menu-header">
              <span>QUICK ACCESS</span>
            </div>
            
            <div className="dropdown-list-wrapper hide-scrollbar">
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
                        size={screenSize === 'mobile' ? 16 : 18} 
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

      <motion.div 
        ref={menuRef}
        className="quick-action-wrapper"
        animate={hasCustomPosition ? {
          left: Math.max(padding, Math.min(finalX, maxX)) + 'px',
          top: Math.max(padding, Math.min(finalY, maxY)) + 'px',
          right: 'auto',
          bottom: 'auto',
          transition: { duration: 0 },
        } : {
          left: 'auto',
          top: 'auto',
          right: '5%',
          bottom: bottomPosition,
          transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
        }}
        style={{
          position: 'fixed',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          isolation: 'isolate',
          userSelect: 'none',
          touchAction: 'none',
          cursor: isDragging ? 'grabbing' : 'default',
          ...(hasCustomPosition ? {
            left: Math.max(padding, Math.min(finalX, maxX)) + 'px',
            top: Math.max(padding, Math.min(finalY, maxY)) + 'px',
            right: 'auto',
            bottom: 'auto',
          } : {
            left: 'auto',
            top: 'auto',
            right: '5%',
            bottom: `${bottomPosition}px`,
          })
        }}
      >
        <motion.button 
          ref={toggleRef}
          className={getToggleClassName()}
          variants={quickToggleVariants}
          initial="idle"
          animate={isOpen ? "open" : "idle"}
          whileTap="tap"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onClick={toggleMenu}
          onDoubleClick={resetPosition}
          aria-label={isOpen ? "Close quick menu" : "Open quick menu"}
          aria-expanded={isOpen}
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            position: 'relative',
            zIndex: 1,
            alignSelf: 'flex-end',
            width: btnSize,
            height: btnSize,
          }}
        >
          {isOpen ? (
            <X size={screenSize === 'mobile' ? 20 : 24} strokeWidth={2.5} style={{ color: 'currentColor' }} />
          ) : (
            <LayoutGrid size={screenSize === 'mobile' ? 20 : 24} strokeWidth={2.5} style={{ color: 'currentColor' }} />
          )}
        </motion.button>
      </motion.div>
    </>
  );
};

export default Quick;
