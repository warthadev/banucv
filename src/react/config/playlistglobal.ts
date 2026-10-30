// src/react/config/playlistglobal.ts
export interface GlobalPlaylistTrack {
  id: string;
  name: string;
  url: string;
  thumbUrl?: string;
  token?: string;
}

export const openGlobalPlaylist = (tracks: GlobalPlaylistTrack[], initialIndex = 0): void => {
  window.dispatchEvent(new CustomEvent('playlist:open', {
    detail: { tracks, initialIndex },
  }));
};

export const pauseGlobalPlaylist = (): void => {
  window.dispatchEvent(new Event('playlist:pause'));
};
