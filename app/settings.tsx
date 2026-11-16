import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '@/components/ScreenHeader';
import { checkBridge, forgetDevice, getBridgeUrl } from '@/src/services/api';
import { normalizeBridgeUrl, useRemoteStore } from '@/src/store/useRemoteStore';

export default function SettingsScreen() {
  const { bridgeUrl, setBridgeUrl, device, setDevice } = useRemoteStore();
  const isWeb = Platform.OS === 'web';
  const [draft, setDraft] = useState(bridgeUrl);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveAndTest() {
    const url = normalizeBridgeUrl(draft);
    if (!url) {
      setStatus({ ok: false, text: 'Escribe la IP de la PC donde corre el bridge' });
      return;
    }
    setBusy(true);
    setStatus(null);
    const res = await checkBridge(url);
    setBusy(false);
    if (res.ok) {
      setBridgeUrl(url);
      setDraft(url);
      setStatus({ ok: true, text: 'Conectado al bridge' });
      setTimeout(() => router.replace('/'), 500);
    } else {
      setStatus({ ok: false, text: `No responde ${url}. ${res.error}` });
    }
  }

  async function handleForget() {
    if (!device) return;
    setBusy(true);
    await forgetDevice(device.id);
    setBusy(false);
    setDevice(null);
    router.replace('/devices');
  }

  const installUrl = `${isWeb ? '' : getBridgeUrl()}/install`;

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#040404', '#0e0e10', '#161619']} style={styles.bg}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ScreenHeader back={!!bridgeUrl || isWeb} />
          <Text style={styles.title}>Ajustes</Text>

          {!isWeb && (
            <LinearGradient colors={['#151518', '#101114']} style={styles.card}>
              <Text style={styles.cardTitle}>Bridge</Text>
              <Text style={styles.help}>
                IP de la PC donde corre el bridge (aparece al iniciarlo). Ej: 192.168.1.50
              </Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="192.168.1.50:8000"
                placeholderTextColor="#666"
                style={styles.input}
                onSubmitEditing={saveAndTest}
              />
              <Pressable style={styles.primaryButton} onPress={saveAndTest} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#0c0c0d" />
                ) : (
                  <Text style={styles.primaryButtonText}>Guardar y probar</Text>
                )}
              </Pressable>
              {status && (
                <Text style={[styles.status, { color: status.ok ? '#39d353' : '#ff7b72' }]}>
                  {status.text}
                </Text>
              )}
            </LinearGradient>
          )}

          <LinearGradient colors={['#151518', '#101114']} style={styles.card}>
            <Text style={styles.cardTitle}>Apple TV</Text>
            <Text style={styles.help}>
              {device ? `${device.name} • ${device.address}` : 'Ningún Apple TV seleccionado'}
            </Text>
            <Pressable style={styles.secondaryButton} onPress={() => router.replace('/devices')}>
              <Text style={styles.secondaryButtonText}>Cambiar de Apple TV</Text>
            </Pressable>
            {device && (
              <Pressable style={styles.secondaryButton} onPress={handleForget} disabled={busy}>
                <Text style={[styles.secondaryButtonText, { color: '#ff7b72' }]}>
                  Olvidar emparejamiento
                </Text>
              </Pressable>
            )}
          </LinearGradient>

          {(isWeb || bridgeUrl) && (
            <LinearGradient colors={['#151518', '#101114']} style={styles.card}>
              <Text style={styles.cardTitle}>Instalar en otro celular</Text>
              <Text style={styles.help}>
                Abre la página de instalación para ver el QR y las instrucciones.
              </Text>
              <Pressable
                style={styles.secondaryButton}
                onPress={() =>
                  isWeb ? window.location.assign('/install') : Linking.openURL(installUrl)
                }
              >
                <Text style={styles.secondaryButtonText}>Abrir página de instalación</Text>
              </Pressable>
            </LinearGradient>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  bg: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 10, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { color: '#fff', fontSize: 31, fontWeight: '700', marginBottom: 4 },
  card: { borderRadius: 24, borderWidth: 1, borderColor: '#232429', padding: 18, gap: 12 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  help: { color: '#98989f', fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: '#0f1013',
    color: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#24262c',
    fontSize: 17,
  },
  primaryButton: {
    backgroundColor: '#f2f2f4',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#0c0c0d', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#1a1b1f',
    borderWidth: 1,
    borderColor: '#2a2b30',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  status: { fontSize: 14, lineHeight: 20 },
});
