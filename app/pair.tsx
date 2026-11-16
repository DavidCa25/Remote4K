import AppleLogoSolidIcon from '@/components/AppleLogoSolidIcon';
import RemoteLaunchOverlay from '@/components/RemoteLaunchOverlay';
import ScreenHeader from '@/components/ScreenHeader';
import { finishPair, startPair } from '@/src/services/api';
import { useRemoteStore } from '@/src/store/useRemoteStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PairScreen() {
  const device = useRemoteStore((s) => s.device);

  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState(
    'Ten el Apple TV encendido. Al iniciar, la TV mostrará un código de 4 dígitos.',
  );
  const [deviceProvidesPin, setDeviceProvidesPin] = useState<boolean | null>(null);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!device) return <Redirect href="/devices" />;

  async function handleStart() {
    if (!device) return;
    setBusy(true);
    const data = await startPair(device.id);
    setBusy(false);

    if (!data.ok) {
      setStatus(data.error);
      return;
    }

    setStarted(true);
    setPin('');
    setDeviceProvidesPin(data.device_provides_pin);
    if (data.device_provides_pin) {
      setGeneratedPin(null);
      setStatus('Escribe el código que aparece en la TV');
    } else {
      setGeneratedPin(data.generated_pin ? String(data.generated_pin) : null);
      setStatus('Escribe este código en la TV y después toca Finalizar');
    }
  }

  async function handleFinish() {
    if (!device) return;
    setBusy(true);
    const data = await finishPair(device.id, deviceProvidesPin ? pin : '');
    setBusy(false);

    if (data.ok) {
      setLaunching(true);
      setTimeout(() => router.replace('/remote'), 1600);
      return;
    }
    setStatus(data.error);
    // Si el bridge perdió la sesión hay que reiniciar el emparejamiento.
    if (/emparejamiento en curso|rechazó/i.test(data.error)) setStarted(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#040404', '#0e0e10', '#161619']} style={styles.bg}>
        <Animated.View style={[styles.container, { opacity: fade, transform: [{ translateY: y }] }]}>
          <ScreenHeader back />
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <AppleLogoSolidIcon size={24} color="#fff" />
            </View>
            <Text style={styles.title}>Emparejar Apple TV</Text>
            <Text style={styles.subtitle}>{`${device.name} • ${device.address}`}</Text>
          </View>

          <LinearGradient colors={['#151518', '#101114']} style={styles.card}>
            <Text style={styles.status}>{status}</Text>

            {started && deviceProvidesPin === false && generatedPin && (
              <View style={styles.pinCard}>
                <Text style={styles.pinLabel}>Código para escribir en la TV</Text>
                <Text style={styles.pinValue}>{generatedPin}</Text>
              </View>
            )}

            {started && deviceProvidesPin === true && (
              <TextInput
                value={pin}
                onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                inputMode="numeric"
                autoFocus
                maxLength={4}
                placeholder="PIN de la TV"
                placeholderTextColor="#666"
                style={styles.input}
                onSubmitEditing={handleFinish}
              />
            )}

            <Pressable
              style={[styles.primaryButton, busy && { opacity: 0.6 }]}
              disabled={busy || (started && deviceProvidesPin === true && pin.length < 4)}
              onPress={started ? handleFinish : handleStart}
            >
              {busy ? (
                <ActivityIndicator color="#0c0c0d" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {started ? 'Finalizar emparejamiento' : 'Iniciar emparejamiento'}
                </Text>
              )}
            </Pressable>

            {started && (
              <Pressable onPress={handleStart} disabled={busy} style={styles.linkButton}>
                <Text style={styles.linkText}>Pedir un código nuevo</Text>
              </Pressable>
            )}
          </LinearGradient>
        </Animated.View>

        <RemoteLaunchOverlay visible={launching} title="Construyendo control" />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  bg: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 18,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#17181b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#25262b',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#98989f',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#232429',
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  status: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  pinCard: {
    backgroundColor: '#0d0e11',
    borderWidth: 1,
    borderColor: '#1f2024',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  pinLabel: {
    color: '#8e9097',
    fontSize: 14,
  },
  pinValue: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 8,
  },
  input: {
    backgroundColor: '#0f1013',
    color: '#fff',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#24262c',
    fontSize: 20,
    letterSpacing: 2,
  },
  primaryButton: {
    backgroundColor: '#f2f2f4',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0c0c0d',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkText: {
    color: '#a9a9b0',
    fontSize: 14,
    fontWeight: '600',
  },
});
