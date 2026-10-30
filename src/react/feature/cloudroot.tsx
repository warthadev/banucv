// src/react/feature/cloudroot.tsx
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, RefreshCw, LogOut, ChevronRight, Inbox, AlertTriangle, Cloud
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import {
  setSelectedChatId,
  setSelectedFileId,
  setSelectedRepo,
  setSelectedRepoType,
  setCurrentPath,
  setHfView,
} from '@redux/cloudslice';
import { useCloudSource, generateUniqueName } from '@hook/usecloudsource';
import { useScreenSize } from '@hook/usescreensize';
import type { CloudSource } from '@config/cloudsource';
import { getSourceStatusColor } from '@config/cloudsource';
import { CloudModalTele } from './cloudmodaltele';
import { CloudModalHF } from './cloudmodalhf';
import { TelegramIcon, HuggingFaceIcon } from '@control/icon';
import Loading from '@control/loading';
import { auth, db } from '@config/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from 'sonner';

interface CloudRootProps {
  onSelectSource: (sourceId: string) => void;
  clearSession?: () => void;
}

const CloudRoot: React.FC<CloudRootProps> = ({ onSelectSource, clearSession }) => {
  const dispatch = useDispatch();
  const {
    sources,
    loading,
    error,
    addSource,
    removeSource,
    syncSourcesFromFirestore,
  } = useCloudSource();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showTeleModal, setShowTeleModal] = useState(false);
  const [showHFModal, setShowHFModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isMobile = useScreenSize() === 'mobile';

  const handleAddTelegram = useCallback(() => {
    setShowAddModal(false);
    setShowTeleModal(true);
  }, []);

  const handleAddHF = useCallback(() => {
    setShowAddModal(false);
    setShowHFModal(true);
  }, []);

  const handleSelectSourceInternal = useCallback((sourceId: string) => {
    dispatch(setSelectedChatId(null));
    dispatch(setSelectedFileId(null));
    dispatch(setSelectedRepo(''));
    dispatch(setSelectedRepoType(''));
    dispatch(setCurrentPath(''));
    dispatch(setHfView('repos'));
    onSelectSource(sourceId);
  }, [dispatch, onSelectSource]);

  const handleTeleAuthSuccess = useCallback(async (sessionString: string, phoneNumber: string, platform: string) => {
    const baseName = phoneNumber || 'Telegram Account';

    const uniqueName = generateUniqueName(baseName, 'telegram', sources);

    await addSource('telegram', uniqueName, sessionString, phoneNumber, undefined, undefined, platform);
    await syncSourcesFromFirestore();
    setShowTeleModal(false);
  }, [addSource, syncSourcesFromFirestore, sources]);

  const handleHFAuthSuccess = useCallback(async (username: string, token: string) => {
    const existingHF = sources.filter(s => s.type === 'hf_dataset');
    const existingUsername = existingHF.find(s => s.datasetId === username);

    if (existingUsername) {
      toast.error(`Username "${username}" already connected`);
      return;
    }

    const user = auth.currentUser;
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          hfUsernames: arrayUnion(username),
          hfTokens: arrayUnion(token),
        });
      } catch (error) {
        toast.error("Failed to save credentials to database");
        return;
      }
    }

    await addSource('hf_dataset', username, undefined, undefined, username, undefined, 'Hugging Face', token);
    await syncSourcesFromFirestore();
    setShowHFModal(false);
    toast.success(`Hugging Face "${username}" connected successfully`);
  }, [addSource, syncSourcesFromFirestore, sources]);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      for (const source of sources) {
        if (source.type === 'telegram' && source.sessionString) {
          try {
            await fetch(`${import.meta.env.VITE_API_URL}/telegram/validate_session`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_string: source.sessionString }),
            });
          } catch (err) {}
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [sources]);

  const getSourceStatusText = useCallback((source: CloudSource): string => {
    if (source.type === 'telegram') {
      return source.status === 'online' ? 'Connected' : 'Disconnected';
    } else {
      return source.status === 'online' ? 'Available' : 'Unavailable';
    }
  }, []);

  const getSourceIcon = useCallback((source: CloudSource) => {
    if (source.type === 'telegram') {
      return <TelegramIcon size={22} />;
    } else if (source.type === 'hf_dataset') {
      return <HuggingFaceIcon size={22} />;
    }
    return <span style={{ fontSize: '16px' }}>{source.icon}</span>;
  }, []);

  const getSourceAccent = useCallback((source: CloudSource): string => {
    if (source.type === 'telegram') return '#229ED9';
    if (source.type === 'hf_dataset') return '#FFB000';
    return 'var(--primary)';
  }, []);

  const getAddSourceIcon = useCallback((type: 'telegram' | 'hf') => {
    if (type === 'telegram') {
      return <TelegramIcon size={28} />;
    } else {
      return <HuggingFaceIcon size={28} />;
    }
  }, []);

  if (loading) {
    return <Loading />;
  }

  const onlineCount = sources.filter((s) => s.status === 'online').length;

  const barTitle = (
    <>
      <span className="cloudroot-bar-logo"><Cloud size={16} /></span>
      <span>Cloud Manager</span>
    </>
  );

  const headerActions = (
    <>
      <button className="cloudview-toolbar-btn" onClick={() => setShowAddModal(true)} title="Add source">
        <Plus size={16} />
      </button>
      <button className="cloudview-toolbar-btn" onClick={handleRefreshAll} disabled={refreshing} title="Refresh all sources">
        <RefreshCw size={16} className={refreshing ? 'cloudroot-spin' : undefined} />
      </button>
      {clearSession && (
        <button className="cloudview-toolbar-btn" onClick={clearSession} title="Logout">
          <LogOut size={16} />
        </button>
      )}
    </>
  );

  return (
    <div className="cloudroot-container">
      {isMobile ? (
        <header className="cloudview-mobile-header cloudroot-bar">
          <div className="cloudview-mobile-header-left">
            <div className="cloudview-mobile-title cloudroot-bar-title">{barTitle}</div>
          </div>
          <div className="cloudview-mobile-header-right">{headerActions}</div>
        </header>
      ) : (
        <div className="cloudview-titlebar cloudroot-bar">
          <div className="cloudview-titlebar-left">
            <div className="cloudview-breadcrumb">
              <span className="cloudview-bc-item cloudview-bc-current cloudroot-bar-title">{barTitle}</span>
            </div>
          </div>
          <div className="cloudview-titlebar-actions">{headerActions}</div>
        </div>
      )}

      <main className="cloudroot-body">
        <div className="cloudroot-content">
          {error && (
            <div className="cloudroot-state cloudroot-state--error">
              <div className="cloudroot-state-icon"><AlertTriangle size={28} /></div>
              <p className="cloudroot-state-text">{error}</p>
              <button className="cloudroot-cta" onClick={() => window.location.reload()}>Retry</button>
            </div>
          )}

          {!error && sources.length === 0 && (
            <div className="cloudroot-state">
              <div className="cloudroot-state-icon"><Inbox size={32} /></div>
              <h2 className="cloudroot-state-title">No sources connected</h2>
              <p className="cloudroot-state-text">Connect a Telegram account or a Hugging Face dataset to get started.</p>
              <div className="cloudroot-empty-actions">
                <button className="cloudroot-provider" onClick={handleAddTelegram}>
                  {getAddSourceIcon('telegram')}
                  <span>Telegram</span>
                </button>
                <button className="cloudroot-provider" onClick={handleAddHF}>
                  {getAddSourceIcon('hf')}
                  <span>Hugging Face</span>
                </button>
              </div>
            </div>
          )}

          {!error && sources.length > 0 && (
            <>
              <p className="cloudroot-caption">
                {sources.length} {sources.length === 1 ? 'source' : 'sources'} · {onlineCount} online
              </p>
              <div className="cloudroot-grid">
              {sources.map((source, i) => (
                <motion.button
                  key={source.id}
                  className="cloudroot-card"
                  style={{ ['--src-accent' as any]: getSourceAccent(source) }}
                  onClick={() => handleSelectSourceInternal(source.id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.04 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="cloudroot-card-icon">{getSourceIcon(source)}</span>
                  <span className="cloudroot-card-info">
                    <span className="cloudroot-card-name">{source.name}</span>
                    <span className="cloudroot-card-platform">{source.platform}</span>
                    {source.unreadCount !== undefined && source.unreadCount > 0 && (
                      <span className="cloudroot-card-unread">{source.unreadCount} unread</span>
                    )}
                  </span>
                  <span className="cloudroot-card-side">
                    <span className="cloudroot-status">
                      <span className="cloudroot-status-dot" style={{ background: getSourceStatusColor(source.status) }} />
                      {getSourceStatusText(source)}
                    </span>
                    <ChevronRight size={16} className="cloudroot-card-chevron" />
                  </span>
                </motion.button>
              ))}
              <button className="cloudroot-card cloudroot-card--add" onClick={() => setShowAddModal(true)}>
                <Plus size={20} />
                <span>Add source</span>
              </button>
              </div>
            </>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="cloudroot-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              className="cloudroot-modal"
              initial={isMobile ? { y: '100%' } : { scale: 0.95, y: 20, opacity: 0 }}
              animate={isMobile ? { y: 0 } : { scale: 1, y: 0, opacity: 1 }}
              exit={isMobile ? { y: '100%' } : { scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cloudroot-modal-grabber" />
              <h3 className="cloudroot-modal-title">Add Cloud Source</h3>
              <div className="cloudroot-modal-options">
                <button className="cloudroot-option" onClick={handleAddTelegram}>
                  <span className="cloudroot-option-icon">{getAddSourceIcon('telegram')}</span>
                  <span className="cloudroot-option-text">
                    <span className="cloudroot-option-name">Telegram Account</span>
                    <span className="cloudroot-option-desc">Connect your Telegram account</span>
                  </span>
                  <ChevronRight size={16} className="cloudroot-card-chevron" />
                </button>
                <button className="cloudroot-option" onClick={handleAddHF}>
                  <span className="cloudroot-option-icon">{getAddSourceIcon('hf')}</span>
                  <span className="cloudroot-option-text">
                    <span className="cloudroot-option-name">Hugging Face Account</span>
                    <span className="cloudroot-option-desc">Connect your Hugging Face account</span>
                  </span>
                  <ChevronRight size={16} className="cloudroot-card-chevron" />
                </button>
              </div>
              <button className="cloudroot-modal-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CloudModalTele
        isOpen={showTeleModal}
        onSave={handleTeleAuthSuccess}
        onClose={() => setShowTeleModal(false)}
      />

      <CloudModalHF
        isOpen={showHFModal}
        onSave={handleHFAuthSuccess}
        onClose={() => setShowHFModal(false)}
      />
    </div>
  );
};

export default CloudRoot;
