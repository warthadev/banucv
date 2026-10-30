// src/react/feature/cloudviewuitoolbar.tsx
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X, Pencil, FolderInput, Copy, Trash2, CheckCircle2, Circle, MonitorPlay,
  ExternalLink, Lock, Unlock, Layers, ListMusic
} from 'lucide-react';

const THEME_SELECTOR = '.light,.dark,.sepia,.night,.forest,.ocean,.amoled,.dim,.solarized,.dracula';

const StickyBar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);

  const place = useCallback(() => {
    const slot = slotRef.current;
    const bar = barRef.current;
    if (!slot || !bar) return;
    const r = slot.getBoundingClientRect();
    bar.style.top = `${Math.max(Math.round(r.top), 0)}px`;
    bar.style.left = `${Math.round(r.left)}px`;
    bar.style.width = `${Math.round(r.width)}px`;
    bar.style.visibility = 'visible';
    const h = bar.offsetHeight;
    setHeight((prev) => (prev === h ? prev : h));
  }, []);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    setHost((slot.closest(THEME_SELECTOR) as HTMLElement | null) ?? document.body);
  }, []);

  useLayoutEffect(() => {
    if (!host) return;
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    if (slotRef.current) ro?.observe(slotRef.current);
    if (barRef.current) ro?.observe(barRef.current);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      ro?.disconnect();
    };
  }, [host, place]);

  return (
    <>
      <div ref={slotRef} style={{ height, flexShrink: 0 }} />
      {host && createPortal(
        <div ref={barRef} style={{ position: 'fixed', top: 0, left: 0, zIndex: 1000, visibility: 'hidden' }}>
          {children}
        </div>,
        host
      )}
    </>
  );
};

export interface SelectionActionBarProps {
  count: number;
  allSelected: boolean;
  canRename: boolean;
  canMove: boolean;
  canDelete: boolean;
  canCopy: boolean;
  canWatch: boolean;
  canSlideshow: boolean;
  slideshowKind?: 'image' | 'audio';
  showCopy: boolean;
  isPublicView: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onWatch: () => void;
  onSlideshow: () => void;
  onCancel: () => void;
}

export const SelectionActionBar: React.FC<SelectionActionBarProps> = ({
  count, allSelected, canRename, canMove, canDelete, canCopy, canWatch, canSlideshow,
  slideshowKind = 'image', showCopy, isPublicView,
  onSelectAll, onDeselectAll, onRename, onMove, onCopy, onDelete, onWatch, onSlideshow, onCancel
}) => {
  const isAudioPlaylist = slideshowKind === 'audio';
  const slideshowLabel = isAudioPlaylist ? 'Playlist' : 'Slideshow';
  const slideshowTitle = isAudioPlaylist
    ? (canSlideshow ? 'Open playlist' : 'Select at least 2 audio files')
    : (canSlideshow ? 'Open slideshow' : 'Select at least 1 image (images only)');

  return (
    <StickyBar>
      <motion.div
        className="cloudview-selection-bar"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
      >
        <button
          className="cloudview-selection-bar-cancel"
          onClick={onCancel}
          title="Cancel selection"
        >
          <X size={18} />
        </button>
        <span className="cloudview-selection-bar-count" translate="no">
          {count} selected
        </span>
        <div className="cloudview-selection-bar-actions">
          <button
            className="cloudview-selection-bar-btn"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            title={allSelected ? 'Deselect all' : 'Select all'}
          >
            {allSelected ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
          </button>
          <button
            className="cloudview-selection-bar-btn"
            onClick={onSlideshow}
            disabled={!canSlideshow}
            title={slideshowTitle}
          >
            {isAudioPlaylist ? <ListMusic size={16} /> : <MonitorPlay size={16} />}
            <span>{slideshowLabel}</span>
          </button>
          <button
            className="cloudview-selection-bar-btn"
            onClick={onWatch}
            disabled={!canWatch}
            title={canWatch ? 'Watch in another app' : 'Select 1 video/audio file'}
          >
            <ExternalLink size={16} />
            <span>Watch</span>
          </button>
          {!isPublicView && (
            <>
              <button
                className="cloudview-selection-bar-btn"
                onClick={onRename}
                disabled={!canRename}
                title={canRename ? 'Rename' : 'Select 1 item to rename'}
              >
                <Pencil size={16} />
                <span>Rename</span>
              </button>
              <button
                className="cloudview-selection-bar-btn"
                onClick={onMove}
                disabled={!canMove}
                title={canMove ? 'Move' : 'Cannot move'}
              >
                <FolderInput size={16} />
                <span>Move</span>
              </button>
            </>
          )}
          {showCopy && (
            <button
              className="cloudview-selection-bar-btn"
              onClick={onCopy}
              disabled={!canCopy}
              title={canCopy ? 'Copy' : 'Cannot copy'}
            >
              <Copy size={16} />
              <span>Copy</span>
            </button>
          )}
          {!isPublicView && (
            <button
              className="cloudview-selection-bar-btn cloudview-selection-bar-btn--danger"
              onClick={onDelete}
              disabled={!canDelete}
              title={canDelete ? 'Delete' : 'Select items to delete'}
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          )}
        </div>
      </motion.div>
    </StickyBar>
  );
};

export interface RepoSelectionActionBarProps {
  count: number;
  allSelected: boolean;
  canRename: boolean;
  canDelete: boolean;
  canUpdateVisibility: boolean;
  canSquash?: boolean;
  selectedRepoPrivate?: boolean | null;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRename: () => void;
  onDelete: () => void;
  onUpdateVisibility: () => void;
  onSquash?: () => void;
  onCancel: () => void;
}

export const RepoSelectionActionBar: React.FC<RepoSelectionActionBarProps> = ({
  count, allSelected, canRename, canDelete, canUpdateVisibility, canSquash = false, selectedRepoPrivate = null,
  onSelectAll, onDeselectAll, onRename, onDelete, onUpdateVisibility, onSquash = () => {}, onCancel
}) => {
  const isPrivate = selectedRepoPrivate !== false;
  return (
    <StickyBar>
      <motion.div
        className="cloudview-selection-bar"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
      >
        <button
          className="cloudview-selection-bar-cancel"
          onClick={onCancel}
          title="Cancel selection"
        >
          <X size={18} />
        </button>
        <span className="cloudview-selection-bar-count" translate="no">
          {count} selected
        </span>
        <div className="cloudview-selection-bar-actions">
          <button
            className="cloudview-selection-bar-btn"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            title={allSelected ? 'Deselect all' : 'Select all'}
          >
            {allSelected ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
          </button>
          <button
            className="cloudview-selection-bar-btn"
            onClick={onRename}
            disabled={!canRename}
            title={canRename ? 'Rename' : 'Select 1 repository to rename'}
          >
            <Pencil size={16} />
            <span>Rename</span>
          </button>
          <button
            className="cloudview-selection-bar-btn"
            onClick={onUpdateVisibility}
            disabled={!canUpdateVisibility}
            title={canUpdateVisibility ? (isPrivate ? 'Private - change visibility' : 'Public - change visibility') : 'Select 1 repository'}
          >
            {isPrivate ? <Lock size={16} /> : <Unlock size={16} />}
            <span>Visibility</span>
          </button>
          <button
            className="cloudview-selection-bar-btn"
            onClick={onSquash}
            disabled={!canSquash}
            title={canSquash ? 'Squash history & clean LFS cache' : 'Select repositories to squash'}
          >
            <Layers size={16} />
            <span>Squash</span>
          </button>
          <button
            className="cloudview-selection-bar-btn cloudview-selection-bar-btn--danger"
            onClick={onDelete}
            disabled={!canDelete}
            title={canDelete ? 'Delete' : 'Select repositories to delete'}
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      </motion.div>
    </StickyBar>
  );
};