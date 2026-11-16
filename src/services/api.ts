import { Platform } from 'react-native';

import { useRemoteStore } from '@/src/store/useRemoteStore';

/**
 * En la web/PWA la app la sirve el propio bridge, así que se usa el mismo
 * origen (rutas relativas). En la app nativa se usa la URL configurada.
 * EXPO_PUBLIC_BRIDGE_URL permite apuntar a otro bridge durante el desarrollo.
 */
export function getBridgeUrl() {
  if (Platform.OS === 'web') return process.env.EXPO_PUBLIC_BRIDGE_URL ?? '';
  return useRemoteStore.getState().bridgeUrl;
}

export type BridgeDevice = {
  id: string;
  name: string;
  address: string;
  deep_sleep: boolean;
  paired: boolean;
  protocols: string[];
};

export type ApiResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function request<T>(
  path: string,
  options: { body?: unknown; timeoutMs?: number; baseUrl?: string } = {},
): Promise<ApiResult<T>> {
  const base = options.baseUrl ?? getBridgeUrl();
  if (Platform.OS !== 'web' && !base) {
    return { ok: false, error: 'Configura la dirección del bridge en Ajustes' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
  try {
    const res = await fetch(`${base}${path}`, {
      method: options.body === undefined ? 'GET' : 'POST',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (data && typeof data.ok === 'boolean') return data;
    return { ok: false, error: `Respuesta inesperada del bridge (${res.status})` };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { ok: false, error: 'El bridge tardó demasiado en responder' };
    }
    return {
      ok: false,
      error: 'No hay conexión con el bridge. ¿La PC está encendida y en la misma red?',
    };
  } finally {
    clearTimeout(timer);
  }
}

export const checkBridge = (baseUrl?: string) =>
  request<{ service: string }>('/api/health', { baseUrl, timeoutMs: 4000 });

export const fetchDevices = () =>
  request<{ devices: BridgeDevice[] }>('/api/devices', { timeoutMs: 20000 });

export const startPair = (id: string) =>
  request<{ device_provides_pin: boolean; generated_pin: number | null; protocol: string }>(
    '/api/pair/start',
    { body: { id }, timeoutMs: 20000 },
  );

export const finishPair = (id: string, pin: string) =>
  request('/api/pair/finish', { body: { id, pin }, timeoutMs: 20000 });

export const connectDevice = (id: string) =>
  request('/api/connect', { body: { id }, timeoutMs: 20000 });

export const sendCommand =(id: string, command: string) =>
  request('/api/command', { body: { id, command }, timeoutMs: 15000 });

export const sendText = (id: string, text: string) =>
  request('/api/text', { body: { id, text }, timeoutMs: 15000 });

export const forgetDevice = (id: string) => request('/api/forget', { body: { id } });
