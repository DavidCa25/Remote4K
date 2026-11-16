import AppleLogoSolidIcon from '@/components/AppleLogoSolidIcon';
import RemoteLaunchOverlay from '@/components/RemoteLaunchOverlay';
import ScreenHeader from '@/components/ScreenHeader';
import { fetchDevices, type BridgeDevice } from '@/src/services/api';
import { useRemoteStore } from '@/src/store/useRemoteStore';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DevicesScreen() {
  const [devices, setDevices] = useState<BridgeDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(20)).current;

  const setDevice = useRemoteStore((s) => s.setDevice);

  async function loadDevices() {
    setLoading(true);
    setError(null);
    const res = await fetchDevices();
    if (res.ok) {
      setDevices(res.devices);
    } else {
      setDevices([]);
      setError(res.error);
    }
    setLoading(false);
  }

  function handleSelectDevice(device: BridgeDevice) {
    setDevice({ id: device.id, name: device.name, address: device.address });

    if (!device.paired) {
      router.push('/pair');
      return;
    }
    setLaunching(true);
    setTimeout(() => router.replace('/remote'), 1600);
  }

  useEffect(() => {
    loadDevices();
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#040404', '#0e0e10', '#161619']} style={styles.bg}>
        <Animated.View
          style={[styles.container, { opacity: fade, transform: [{ translateY: y }] }]}
        >
          <ScreenHeader right={{ label: 'Ajustes', onPress: () => router.push('/settings') }} />

          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <AppleLogoSolidIcon size={24} color="#fff" />
            </View>
            <Text style={styles.title}>Apple TV</Text>
            <Text style={styles.subtitle}>Selecciona un dispositivo para abrir el control</Text>
          </View>

          <Pressable style={styles.refreshBtn} onPress={loadDevices} disabled={loading}>
            <Text style={styles.refreshText}>Buscar de nuevo</Text>
          </Pressable>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.loadingText}>Buscando Apple TV...</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sin conexión con el bridge</Text>
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          ) : devices.length === 0 ? (
            <View style={styles.emptyCard}>
              <AppleLogoSolidIcon size={28} color="#d0d0d5" opacity={0.9} />
              <Text style={styles.emptyTitle}>No se encontró ningún Apple TV</Text>
              <Text style={styles.emptyText}>
                Verifica que esté encendido y en la misma red que la PC del bridge.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
              {devices.map((device) => (
                <Pressable key={device.id} onPress={() => handleSelectDevice(device)}>
                  <LinearGradient colors={['#151518', '#101114']} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardIconWrap}>
                        <AppleLogoSolidIcon size={20} color="#fff" />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle}>{device.name}</Text>
                        <Text style={styles.cardSub}>{device.address}</Text>
                      </View>
                      <View
                        style={[
                          styles.deviceDot,
                          device.paired ? styles.deviceDotReady : styles.deviceDotNeedsPair,
                        ]}
                      />
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.cardMeta}>
                        {device.deep_sleep ? 'En reposo' : 'Disponible'}
                      </Text>
                      <View style={[styles.badge, device.paired ? styles.badgeReady : styles.badgePair]}>
                        <Text style={styles.badgeText}>
                          {device.paired ? 'Abrir control' : 'Emparejar'}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Animated.View>

        <RemoteLaunchOverlay visible={launching} />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  bg: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 10, maxWidth: 520, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginBottom: 18 },
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
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: '#98989f',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },
  refreshBtn: {
    backgroundColor: '#1a1b1f',
    borderWidth: 1,
    borderColor: '#2a2b30',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  centerBox: {
    marginTop: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#9a9aa0',
    fontSize: 14,
  },
  emptyCard: {
    marginTop: 20,
    backgroundColor: '#121316',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#1f2024',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#9a9aa0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 30,
    gap: 14,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#232429',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0b0c0e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardSub: {
    color: '#a0a2aa',
    fontSize: 13,
    marginTop: 2,
  },
  deviceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  deviceDotReady: {
    backgroundColor: '#39d353',
  },
  deviceDotNeedsPair: {
    backgroundColor: '#ffb347',
  },
  cardFooter: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    color: '#8e9097',
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeReady: {
    backgroundColor: '#1d2c21',
  },
  badgePair: {
    backgroundColor: '#2c2418',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});