// src/react/hook/useplaylist.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type RepeatMode = 'off' | 'all' | 'one';

const sequential = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

// Fisher-Yates, `first` selalu jadi urutan pertama.
const shuffled = (n: number, first: number): number[] => {
  if (n <= 0) return [];
  const rest = sequential(n).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [first, ...rest];
};

export const usePlaylist = (length: number, startIndex = 0) => {
  const [index, setIndex] = useState(startIndex);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [order, setOrder] = useState<number[]>(() => sequential(length));

  // reset() harus stabil (dipakai di efek buka/tutup), jadi shuffle dibaca lewat ref.
  const shuffleRef = useRef(shuffle);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  const pos = order.indexOf(index);
  const hasPrev = pos > 0 || repeat === 'all';
  const hasNext = pos < order.length - 1 || repeat === 'all';
  // Track berikutnya yang pasti (dipakai buat prefetch). null kalau belum pasti.
  const nextIndex = useMemo(
    () => (pos >= 0 && pos < order.length - 1 ? order[pos + 1] : null),
    [pos, order]
  );

  const reset = useCallback((len: number, start: number) => {
    setIndex(start);
    setOrder(shuffleRef.current ? shuffled(len, start) : sequential(len));
  }, []);

  const goNext = useCallback((): boolean => {
    if (pos >= 0 && pos < order.length - 1) {
      setIndex(order[pos + 1]);
      return true;
    }
    if (repeat === 'all' && order.length > 0) {
      if (shuffle && order.length > 1) {
        let pick = index;
        while (pick === index) pick = Math.floor(Math.random() * order.length);
        setOrder(shuffled(order.length, pick));
        setIndex(pick);
      } else {
        setIndex(order[0]);
      }
      return true;
    }
    return false;
  }, [pos, order, repeat, shuffle, index]);

  const goPrev = useCallback((): boolean => {
    if (pos > 0) {
      setIndex(order[pos - 1]);
      return true;
    }
    if (repeat === 'all' && order.length > 0) {
      setIndex(order[order.length - 1]);
      return true;
    }
    return false;
  }, [pos, order, repeat]);

  const jumpTo = useCallback((i: number) => setIndex(i), []);

  const toggleShuffle = useCallback(() => {
    const next = !shuffle;
    setShuffle(next);
    setOrder(next ? shuffled(length, index) : sequential(length));
  }, [shuffle, length, index]);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));
  }, []);

  return {
    index,
    order,
    shuffle,
    repeat,
    hasPrev,
    hasNext,
    nextIndex,
    reset,
    goNext,
    goPrev,
    jumpTo,
    toggleShuffle,
    cycleRepeat,
  };
};
