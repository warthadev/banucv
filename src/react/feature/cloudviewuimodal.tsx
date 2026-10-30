// src/react/feature/cloudviewuimodal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import type { HFRepo } from '@config/cloudsource';
import { sanitizeText, REPO_NAME_RE } from '@config/cloudviewuiconfig';

export const RenameRepoModal: React.FC<{
  open: boolean;
  value: string;
  target: HFRepo | null;
  onChangeValue: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}> = ({ open, value, target, onChangeValue, onConfirm, onClose, loading }) => {
  if (!target) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cloudview-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="cloudview-modal"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.17 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="cloudview-modal-title">Rename repository</h3>
            <p className="cloudview-modal-desc">
              Enter a new name for <strong>{sanitizeText(target.name)}</strong>
            </p>
            <input
              className="cloudview-modal-input"
              type="text"
              value={value}
              onChange={(e) => onChangeValue(e.target.value)}
              placeholder="New repository name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm();
                if (e.key === 'Escape') onClose();
              }}
            />
            <div className="cloudview-modal-actions">
              <button className="cloudview-modal-btn cloudview-modal-btn--cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                className="cloudview-modal-btn cloudview-modal-btn--confirm"
                onClick={onConfirm}
                disabled={loading || !value.trim() || value.trim() === target.name}
              >
                {loading ? <Loader2 className="spin" size={16} /> : 'Rename'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const DeleteRepoModal: React.FC<{
  open: boolean;
  targets: HFRepo[];
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}> = ({ open, targets, onConfirm, onClose, loading }) => {
  const count = targets.length;
  const title = count === 1 ? `Delete repository` : `Delete ${count} repositories`;

  return (
    <AnimatePresence>
      {open && targets.length > 0 && (
        <motion.div
          className="cloudview-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="cloudview-modal cloudview-modal--danger"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.17 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cloudview-modal-danger-icon">
              <AlertCircle size={26} />
            </div>
            <h3 className="cloudview-modal-title">{title}?</h3>
            <p className="cloudview-modal-desc">
              {count === 1
                ? <>Delete <strong>{sanitizeText(targets[0].name)}</strong> and all files inside? This cannot be undone.</>
                : <>Delete <strong>{count} repositories</strong> and all files inside? This cannot be undone.</>
              }
            </p>
            <div className="cloudview-modal-actions">
              <button className="cloudview-modal-btn cloudview-modal-btn--cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button className="cloudview-modal-btn cloudview-modal-btn--danger" onClick={onConfirm} disabled={loading}>
                {loading ? <Loader2 className="spin" size={16} /> : 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const AddRepoModal: React.FC<{
  open: boolean;
  onConfirm: (params: { name: string; type: 'dataset' | 'model' | 'space'; isPrivate: boolean }) => void;
  onClose: () => void;
  loading: boolean;
}> = ({ open, onConfirm, onClose, loading }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'dataset' | 'model' | 'space'>('dataset');
  const [isPrivate, setIsPrivate] = useState(true);
  const [touched, setTouched] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [visMenuOpen, setVisMenuOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  const visRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setType('dataset');
      setIsPrivate(true);
      setTouched(false);
      setTypeMenuOpen(false);
      setVisMenuOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: Event) => {
      const t = e.target as Node;
      if (typeRef.current && !typeRef.current.contains(t)) setTypeMenuOpen(false);
      if (visRef.current && !visRef.current.contains(t)) setVisMenuOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [open]);

  const trimmed = name.trim();
  const valid = REPO_NAME_RE.test(trimmed);
  const showError = touched && trimmed.length > 0 && !valid;

  const submit = () => {
    setTouched(true);
    if (!valid || loading) return;
    onConfirm({ name: trimmed, type, isPrivate });
  };

  const typeLabels: Record<'dataset' | 'model' | 'space', string> = {
    dataset: 'Dataset',
    model: 'Model',
    space: 'Space',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cloudview-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={loading ? undefined : onClose}
        >
          <motion.div
            className="cloudview-modal cloudview-modal--add-repo"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.17 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="cloudview-modal-title">Add repository</h3>
            <p className="cloudview-modal-desc">Create a new repository on your Hugging Face account.</p>

            <input
              className="cloudview-modal-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Repository name"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape' && !loading) onClose();
              }}
            />
            {showError && (
              <p className="cloudview-modal-desc" style={{ color: '#ef4444', marginTop: 6, fontSize: 12 }}>
                Use letters, numbers, "-", "_" or "." only (no spaces).
              </p>
            )}

            <div className="cloudview-transfer-field">
              <label className="cloudview-transfer-label">Type</label>
              <div className="cloudview-transfer-custom-select" ref={typeRef}>
                <button
                  type="button"
                  className="cloudview-transfer-select-trigger"
                  onClick={() => { if (!loading) { setTypeMenuOpen(v => !v); setVisMenuOpen(false); } }}
                  disabled={loading}
                >
                  <span>{typeLabels[type]}</span>
                  <ChevronDown size={16} className={`cloudview-transfer-select-chevron ${typeMenuOpen ? 'open' : ''}`} />
                </button>
                <AnimatePresence>
                  {typeMenuOpen && (
                    <motion.div
                      className="cloudview-transfer-select-menu"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      {(['dataset', 'model', 'space'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          className={`cloudview-transfer-select-item ${type === t ? 'active' : ''}`}
                          onClick={() => { setType(t); setTypeMenuOpen(false); }}
                        >
                          {typeLabels[t]}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="cloudview-transfer-field">
              <label className="cloudview-transfer-label">Visibility</label>
              <div className="cloudview-transfer-custom-select" ref={visRef}>
                <button
                  type="button"
                  className="cloudview-transfer-select-trigger"
                  onClick={() => { if (!loading) { setVisMenuOpen(v => !v); setTypeMenuOpen(false); } }}
                  disabled={loading}
                >
                  <span>{isPrivate ? 'Private' : 'Public'}</span>
                  <ChevronDown size={16} className={`cloudview-transfer-select-chevron ${visMenuOpen ? 'open' : ''}`} />
                </button>
                <AnimatePresence>
                  {visMenuOpen && (
                    <motion.div
                      className="cloudview-transfer-select-menu"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <button
                        type="button"
                        className={`cloudview-transfer-select-item ${isPrivate ? 'active' : ''}`}
                        onClick={() => { setIsPrivate(true); setVisMenuOpen(false); }}
                      >
                        Private
                      </button>
                      <button
                        type="button"
                        className={`cloudview-transfer-select-item ${!isPrivate ? 'active' : ''}`}
                        onClick={() => { setIsPrivate(false); setVisMenuOpen(false); }}
                      >
                        Public
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="cloudview-modal-actions">
              <button className="cloudview-modal-btn cloudview-modal-btn--cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button className="cloudview-modal-btn cloudview-modal-btn--confirm" onClick={submit} disabled={loading || !trimmed}>
                {loading ? <Loader2 className="spin" size={16} /> : 'Create'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const SquashRepoModal: React.FC<{
  open: boolean;
  targets: HFRepo[];
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}> = ({ open, targets, onConfirm, onClose, loading }) => {
  const count = targets.length;
  const title = count === 1 ? 'Squash history' : `Squash history (${count} repositories)`;

  return (
    <AnimatePresence>
      {open && count > 0 && (
        <motion.div
          className="cloudview-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={loading ? undefined : onClose}
        >
          <motion.div
            className="cloudview-modal cloudview-modal--danger"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.17 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cloudview-modal-danger-icon">
              <AlertCircle size={26} />
            </div>
            <h3 className="cloudview-modal-title">{title}?</h3>
            <p className="cloudview-modal-desc">
              {count === 1
                ? <>All old commits of <strong>{sanitizeText(targets[0].name)}</strong> will be merged into one clean commit.</>
                : <>All old commits of <strong>{count} repositories</strong> will be merged into one clean commit each.</>
              }
            </p>
            <p className="cloudview-modal-desc" style={{ marginTop: 8 }}>
              Previous revisions will be <strong>permanently deleted</strong> and cannot be recovered.
              Your current files stay as they are. Storage usage updates after Hugging Face finishes
              garbage collection (can take a few hours).
            </p>
            <div className="cloudview-modal-actions">
              <button className="cloudview-modal-btn cloudview-modal-btn--cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button className="cloudview-modal-btn cloudview-modal-btn--danger" onClick={onConfirm} disabled={loading}>
                {loading ? <Loader2 className="spin" size={16} /> : 'Squash'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const VisibilityRepoModal: React.FC<{
  open: boolean;
  target: HFRepo | null;
  onConfirm: (isPrivate: boolean) => void;
  onClose: () => void;
  loading: boolean;
}> = ({ open, target, onConfirm, onClose, loading }) => {
  if (!target) return null;
  const isCurrentlyPrivate = target.private;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cloudview-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="cloudview-modal"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.17 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="cloudview-modal-title">Change visibility</h3>
            <p className="cloudview-modal-desc">
              <strong>{sanitizeText(target.name)}</strong> is currently <strong>{isCurrentlyPrivate ? 'Private' : 'Public'}</strong>.
            </p>
            <p className="cloudview-modal-desc" style={{ marginTop: 8 }}>
              {isCurrentlyPrivate
                ? 'Make it Public? Anyone will be able to see and access this repository.'
                : 'Make it Private? Only you (and authorized accounts) will be able to access this repository.'}
            </p>
            <div className="cloudview-modal-actions">
              <button className="cloudview-modal-btn cloudview-modal-btn--cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                className="cloudview-modal-btn cloudview-modal-btn--confirm"
                onClick={() => onConfirm(!isCurrentlyPrivate)}
                disabled={loading}
              >
                {loading ? <Loader2 className="spin" size={16} /> : (isCurrentlyPrivate ? 'Make Public' : 'Make Private')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};