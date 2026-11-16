import {
  BackIcon,
  GearIcon,
  HomeIcon,
  KeyboardIcon,
  ListIcon,
  MuteIcon,
  PlayPauseIcon,
  PowerIcon,
} from '@/components/RemoteIcons';
import { tap } from '@/src/lib/haptics';
import { connectDevice, sendCommand, sendText } from '@/src/services/api';
import { useRemoteStore } from '@/src/store/useRemoteStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Link = 'connecting' | 'ok' | 'error';
type Zone = 'up' | 'down' | 'left' | 'right' | 'select';

// Medidas de diseño (escala 1 = control de 290 px de ancho).
const DESIGN_W = 290;
const DESIGN_H = 664;
const TOP_BAR = 52;

export default function RemoteScreen() {
  const device = useRemoteStore((s) => s.device);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const s = Math.min(
    (width - 32) / DESIGN_W,
    (height - insets.top - insets.bottom - TOP_BAR - 20) / DESIGN_H,
    1.3,
  );
  const st = useMemo(() => makeStyles(s), [s]);

  const [link, setLink] = useState<Link>('connecting');
  const [toast, setToast] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // --- Envío de comandos en orden (una cola), sin acumular repeticiones ----
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const send = useCallback(
    (command: string, isRepeat = false) => {
      if (!device) return;
      if (isRepeat && pending.current > 1) return;
      tap(command === 'select' || command === 'power');
      pending.current += 1;
      queue.current = queue.current.then(async () => {
        const res = await sendCommand(device.id, command);
        pending.current -= 1;
        if (res.ok) {
          setLink('ok');
        } else {
          setLink('error');
          showToast(res.error);
        }
      });
    },
    [device, showToast],
  );

  useEffect(() => {
    if (!device) return;
    let alive = true;
    setLink('connecting');
    connectDevice(device.id).then((res) => {
      if (!alive) return;
      setLink(res.ok ? 'ok' : 'error');
      if (!res.ok) showToast(res.error);
    });
    return () => {
      alive = false;
    };
  }, [device, showToast]);

  if (!device) return <Redirect href="/devices" />;

  return (
    <View style={[st.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient colors={['#050505', '#101010', '#181818']} style={StyleSheet.absoluteFill} />

      <View style={st.topBar}>
        <IconButton label="Apple TVs" onPress={() => router.replace('/devices')}>
          <ListIcon size={20} color="#d6d6db" />
        </IconButton>
        <Text style={st.deviceName} numberOfLines={1}>
          {device.name}
        </Text>
        <View style={st.topBarRight}>
          <IconButton label="Teclado" onPress={() => setKeyboardOpen(true)}>
            <KeyboardIcon size={22} color="#d6d6db" />
          </IconButton>
          <IconButton label="Ajustes" onPress={() => router.push('/settings')}>
            <GearIcon size={21} color="#d6d6db" />
          </IconButton>
        </View>
      </View>

      <View style={st.remoteShell}>
        <LinearGradient
          colors={['#dedee1', '#cccccf', '#b8b8bc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={st.remoteBody}
        >
          <View style={st.topRow}>
            <StatusPill link={link} style={st.indicatorPill} />
            <Pressable
              accessibilityLabel="Encender / apagar"
              onPress={() => send('power')}
              style={({ pressed }) => [st.powerButton, pressed && st.pressedLight]}
            >
              <PowerIcon size={18 * s} color="#1c1c1e" />
            </Pressable>
          </View>

          <View style={st.wheelWrap}>
            <ClickPad s={s} st={st} send={send} />
          </View>

          <View style={st.row}>
            <RoundButton
              st={st}
              label="Atrás"
              onPress={() => send('menu')}
              onLongPress={() => send('top_menu')}
            >
              <BackIcon size={30 * s} />
            </RoundButton>
            <RoundButton
              st={st}
              label="Inicio"
              onPress={() => send('home')}
              onLongPress={() => send('home_hold')}
            >
              <HomeIcon size={33 * s} color="#ffffff" />
            </RoundButton>
          </View>

          <View style={st.bottomSection}>
            <View style={st.leftColumn}>
              <RoundButton st={st} label="Reproducir / pausa" onPress={() => send('play_pause')}>
                <PlayPauseIcon size={32 * s} />
              </RoundButton>
              <RoundButton st={st} label="Silenciar" onPress={() => send('mute')}>
                <MuteIcon size={28 * s} />
              </RoundButton>
            </View>

            <LinearGradient colors={['#141414', '#050505']} style={st.volumePill}>
              <RepeatPressable
                label="Subir volumen"
                onFire={(repeat) => send('volume_up', repeat)}
                style={st.volumeHalf}
                pressedStyle={st.volumeHalfPressed}
              >
                <Text style={st.volumeSymbol}>+</Text>
              </RepeatPressable>
              <View style={st.volumeDivider} pointerEvents="none" />
              <RepeatPressable
                label="Bajar volumen"
                onFire={(repeat) => send('volume_down', repeat)}
                style={st.volumeHalf}
                pressedStyle={st.volumeHalfPressed}
              >
                <Text style={st.volumeSymbol}>−</Text>
              </RepeatPressable>
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>

      {toast && (
        <Pressable
          style={[st.toast, { top: insets.top + TOP_BAR + 4 }]}
          onPress={() => setToast(null)}
        >
          <Text style={st.toastText}>{toast}</Text>
        </Pressable>
      )}

      <KeyboardSheet
        visible={keyboardOpen}
        deviceId={device.id}
        onClose={() => setKeyboardOpen(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Clickpad: toca el aro para mover, el centro para seleccionar, desliza como
// en el touchpad del Siri Remote. Mantener una dirección la repite y mantener
// el centro hace "mantener seleccionado" (menús contextuales).
// ---------------------------------------------------------------------------

function ClickPad({
  s,
  st,
  send,
}: {
  s: number;
  st: ReturnType<typeof makeStyles>;
  send: (command: string, isRepeat?: boolean) => void;
}) {
  const [pressed, setPressed] = useState<Zone | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  const wheel = 235 * s;
  const center = 113 * s;

  const responder = useMemo(() => {
    let zone: Zone | null = null;
    let moved = false;
    let held = false;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let repeatTimer: ReturnType<typeof setInterval> | null = null;

    const clear = () => {
      if (holdTimer) clearTimeout(holdTimer);
      if (repeatTimer) clearInterval(repeatTimer);
      holdTimer = null;
      repeatTimer = null;
    };

    const zoneAt = (x: number, y: number): Zone => {
      const dx = x - wheel / 2;
      const dy = y - wheel / 2;
      if (Math.hypot(dx, dy) < center / 2) return 'select';
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
      return dy > 0 ? 'down' : 'up';
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        clear();
        moved = false;
        held = false;
        zone = zoneAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
        setPressed(zone);
        const z = zone;
        if (z === 'select') {
          holdTimer = setTimeout(() => {
            held = true;
            sendRef.current('select_hold');
          }, 700);
        } else {
          holdTimer = setTimeout(() => {
            held = true;
            sendRef.current(z);
            repeatTimer = setInterval(() => sendRef.current(z, true), 150);
          }, 380);
        }
      },
      onPanResponderMove: (_e, g) => {
        if (!held && !moved && Math.hypot(g.dx, g.dy) > 16 * s) {
          moved = true;
          clear();
          setPressed(null);
        }
      },
      onPanResponderRelease: (_e, g) => {
        clear();
        setPressed(null);
        if (held) return;
        if (moved) {
          const horizontal = Math.abs(g.dx) > Math.abs(g.dy);
          const dir: Zone = horizontal ? (g.dx > 0 ? 'right' : 'left') : g.dy > 0 ? 'down' : 'up';
          const distance = Math.max(Math.abs(g.dx), Math.abs(g.dy));
          const steps = Math.min(4, 1 + Math.floor(distance / (wheel * 0.45)));
          for (let i = 0; i < steps; i++) sendRef.current(dir);
          return;
        }
        if (zone) sendRef.current(zone);
      },
      onPanResponderTerminate: () => {
        clear();
        setPressed(null);
      },
    });
  }, [s, wheel, center]);

  return (
    <View
      {...responder.panHandlers}
      style={st.wheelTouch}
      accessibilityRole="adjustable"
      accessibilityLabel="Touchpad"
    >
      <LinearGradient colors={['#161616', '#040404']} style={st.wheelOuter} pointerEvents="none">
        {(['up', 'left', 'right', 'down'] as const).map((d) => (
          <View
            key={d}
            pointerEvents="none"
            style={[st.directionDot, st[`dot_${d}`], pressed === d && st.directionDotActive]}
          />
        ))}
        {pressed && pressed !== 'select' && (
          <View pointerEvents="none" style={[st.ringGlow, st[`glow_${pressed}`]]} />
        )}
        <View
          pointerEvents="none"
          style={[st.wheelCenter, pressed === 'select' && st.centerPressed]}
        />
      </LinearGradient>
    </View>
  );
}

function RoundButton({
  st,
  label,
  onPress,
  onLongPress,
  children,
}: {
  st: ReturnType<typeof makeStyles>;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={600}
      style={({ pressed }) => [st.blackButton, pressed && st.pressed]}
    >
      {children}
    </Pressable>
  );
}

/** Dispara al tocar y, si se mantiene, repite (volumen). */
function RepeatPressable({
  label,
  onFire,
  style,
  pressedStyle,
  children,
}: {
  label: string;
  onFire: (repeat: boolean) => void;
  style: any;
  pressedStyle: any;
  children: React.ReactNode;
}) {
  const state = useRef<{ i?: ReturnType<typeof setInterval>; repeating: boolean }>({
    repeating: false,
  });
  const stop = () => clearInterval(state.current.i);
  useEffect(() => stop, []);
  return (
    <Pressable
      accessibilityLabel={label}
      delayLongPress={400}
      onPressIn={() => {
        stop();
        state.current.repeating = false;
      }}
      onPress={() => {
        if (!state.current.repeating) onFire(false);
      }}
      onLongPress={() => {
        state.current.repeating = true;
        onFire(false);
        state.current.i = setInterval(() => onFire(true), 180);
      }}
      onPressOut={stop}
      style={({ pressed }) => [style, pressed && pressedStyle]}
    >
      {children}
    </Pressable>
  );
}

function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [topBarStyles.iconButton, pressed && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
  );
}

function StatusPill({ link, style }: { link: Link; style: any }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (link !== 'connecting') {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [link, opacity]);

  const color = link === 'ok' ? '#f5f5f7' : link === 'error' ? '#ff6b5e' : '#9a9aa0';
  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: link === 'ok' ? 0.95 : 0.4,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Teclado: escribe en el campo de texto que esté abierto en la TV.
// ---------------------------------------------------------------------------

function KeyboardSheet({
  visible,
  deviceId,
  onClose,
}: {
  visible: boolean;
  deviceId: string;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      setError(null);
    }
  }, [visible]);

  function onChange(value: string) {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await sendText(deviceId, value);
      setError(res.ok ? null : res.error);
    }, 300);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={sheet.backdrop} onPress={onClose}>
        <Pressable style={sheet.card} onPress={() => {}}>
          <Text style={sheet.title}>Teclado</Text>
          <Text style={sheet.help}>
            Abre un campo de búsqueda en la TV y escribe aquí; el texto aparece en vivo.
          </Text>
          <TextInput
            value={text}
            onChangeText={onChange}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Escribe…"
            placeholderTextColor="#666"
            style={sheet.input}
            returnKeyType="done"
            onSubmitEditing={onClose}
          />
          {error && <Text style={sheet.error}>{error}</Text>}
          <Pressable style={sheet.button} onPress={onClose}>
            <Text style={sheet.buttonText}>Listo</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const topBarStyles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17181b',
    borderWidth: 1,
    borderColor: '#25262b',
  },
});

function makeStyles(s: number) {
  const W = DESIGN_W * s;
  const wheel = 235 * s;
  const center = 113 * s;
  const btn = 82 * s;
  const ring = (wheel - center) / 2;

  const dot = 7 * s;
  const dotInset = 16 * s;

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
    topBar: {
      height: TOP_BAR,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      gap: 10,
    },
    topBarRight: { flexDirection: 'row', gap: 10 },
    deviceName: { flex: 1, color: '#d6d6db', fontSize: 15, fontWeight: '600', textAlign: 'center' },
    remoteShell: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    remoteBody: {
      width: W,
      height: DESIGN_H * s,
      borderRadius: 38 * s,
      paddingTop: 18 * s,
      paddingHorizontal: 18 * s,
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 18 },
      elevation: 18,
      borderWidth: 1,
      borderColor: '#d9d9dc',
    },
    topRow: {
      height: 42 * s,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    indicatorPill: {
      position: 'absolute',
      left: (W - 36 * s) / 2 - 10 * s,
      width: 20 * s,
      height: 7 * s,
      borderRadius: 999,
    },
    powerButton: {
      width: 42 * s,
      height: 42 * s,
      borderRadius: 21 * s,
      borderWidth: 1.2,
      borderColor: '#3c3c40',
      backgroundColor: '#efeff1',
      alignItems: 'center',
      justifyContent: 'center',
    },
    wheelWrap: { alignItems: 'center', marginTop: 24 * s },
    wheelTouch: {
      width: wheel,
      height: wheel,
      borderRadius: wheel / 2,
      // Evita scroll/zoom del navegador mientras se usa el touchpad.
      touchAction: 'none',
      userSelect: 'none',
    } as any,
    wheelOuter: {
      width: wheel,
      height: wheel,
      borderRadius: wheel / 2,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.38,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 11,
    },
    wheelCenter: {
      width: center,
      height: center,
      borderRadius: center / 2,
      backgroundColor: '#111111',
      borderWidth: 1,
      borderColor: '#1d1d1d',
    },
    centerPressed: { backgroundColor: '#1d1d1f', transform: [{ scale: 0.96 }] },
    directionDot: {
      position: 'absolute',
      width: dot,
      height: dot,
      borderRadius: dot / 2,
      backgroundColor: '#f2f2f4',
      zIndex: 2,
    },
    directionDotActive: { transform: [{ scale: 1.5 }] },
    dot_up: { top: dotInset, left: (wheel - dot) / 2 },
    dot_down: { bottom: dotInset, left: (wheel - dot) / 2 },
    dot_left: { left: dotInset, top: (wheel - dot) / 2 },
    dot_right: { right: dotInset, top: (wheel - dot) / 2 },
    ringGlow: {
      position: 'absolute',
      width: ring * 1.6,
      height: ring * 1.6,
      borderRadius: ring,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    glow_up: { top: -ring * 0.3, left: (wheel - ring * 1.6) / 2 },
    glow_down: { bottom: -ring * 0.3, left: (wheel - ring * 1.6) / 2 },
    glow_left: { left: -ring * 0.3, top: (wheel - ring * 1.6) / 2 },
    glow_right: { right: -ring * 0.3, top: (wheel - ring * 1.6) / 2 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 30 * s,
      paddingHorizontal: 10 * s,
    },
    bottomSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 22 * s,
      paddingHorizontal: 10 * s,
      alignItems: 'flex-start',
    },
    leftColumn: { gap: 18 * s },
    blackButton: {
      width: btn,
      height: btn,
      borderRadius: btn / 2,
      backgroundColor: '#0c0c0d',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 7,
    },
    pressed: { opacity: 0.82, transform: [{ scale: 0.95 }] },
    pressedLight: { opacity: 0.88, transform: [{ scale: 0.94 }] },
    volumePill: {
      width: btn,
      height: btn * 2 + 18 * s,
      borderRadius: btn / 2,
      alignItems: 'center',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 7,
    },
    volumeHalf: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
    volumeHalfPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
    volumeDivider: {
      position: 'absolute',
      top: '50%',
      width: 24 * s,
      height: 1,
      backgroundColor: '#5a5a5f',
    },
    volumeSymbol: { color: '#fff', fontSize: 32 * s, fontWeight: '500', lineHeight: 36 * s },
    toast: {
      position: 'absolute',
      left: 16,
      right: 16,
      alignSelf: 'center',
      maxWidth: 480,
      backgroundColor: 'rgba(40,20,20,0.95)',
      borderColor: '#5c2a26',
      borderWidth: 1,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    toastText: { color: '#ffd9d5', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  });
}

const sheet = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 90,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#141518',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#25262b',
    padding: 20,
    gap: 12,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  help: { color: '#98989f', fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: '#0f1013',
    color: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#24262c',
    fontSize: 18,
  },
  error: { color: '#ff7b72', fontSize: 14, lineHeight: 20 },
  button: {
    backgroundColor: '#f2f2f4',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#0c0c0d', fontSize: 16, fontWeight: '700' },
});
