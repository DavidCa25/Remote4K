import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type SavedDevice = {
  id: string;
  name: string;
  address: string;
};

type RemoteState = {
  /** URL del bridge. Solo se usa en la app nativa; la web usa su propio origen. */
  bridgeUrl: string;
  /** Último Apple TV usado. Al reabrir la app se va directo al control. */
  device: SavedDevice | null;
  setBridgeUrl: (url: string) => void;
  setDevice: (device: SavedDevice | null) => void;
};

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function getStorage(): StateStorage {
  if (Platform.OS !== 'web') return AsyncStorage;
  // En el render estático (Node) no existe window.
  if (typeof window === 'undefined') return noopStorage;
  try {
    return window.localStorage;
  } catch {
    return noopStorage;
  }
}

export function normalizeBridgeUrl(value: string) {
  let url = value.trim().replace(/\/+$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  // Si no trae puerto, el bridge usa 8000 por defecto.
  if (!/:\d+$/.test(url.replace(/^https?:\/\//i, ''))) url = `${url}:8000`;
  return url;
}

export const useRemoteStore = create<RemoteState>()(
  persist(
    (set) => ({
      bridgeUrl: process.env.EXPO_PUBLIC_BRIDGE_URL ?? '',
      device: null,
      setBridgeUrl: (url) => set({ bridgeUrl: normalizeBridgeUrl(url) }),
      setDevice: (device) => set({ device }),
    }),
    {
      name: 'remote4k',
      storage: createJSONStorage(getStorage),
      partialize: (s) => ({ bridgeUrl: s.bridgeUrl, device: s.device }),
    },
  ),
);

/** true cuando el estado guardado ya se cargó (AsyncStorage/localStorage). */
export function useStoreHydrated() {
  const [hydrated, setHydrated] = useState(() => useRemoteStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useRemoteStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useRemoteStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}
