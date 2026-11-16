import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    StyleSheet,
    View
} from 'react-native';

const { width, height } = Dimensions.get('window');

type Props = {
  visible: boolean;
  title?: string;
  onComplete?: () => void;
};

export default function RemoteLaunchOverlay({
  visible,
  onComplete,
}: Props) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const bodyScale = useRef(new Animated.Value(0.82)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const wheelY = useRef(new Animated.Value(40)).current;
  const wheelOpacity = useRef(new Animated.Value(0)).current;
  const buttonsY = useRef(new Animated.Value(28)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const volumeX = useRef(new Animated.Value(26)).current;
  const volumeOpacity = useRef(new Animated.Value(0)).current;
  const shineX = useRef(new Animated.Value(-220)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    backdrop.setValue(0);
    bodyScale.setValue(0.82);
    bodyOpacity.setValue(0);
    wheelY.setValue(40);
    wheelOpacity.setValue(0);
    buttonsY.setValue(28);
    buttonsOpacity.setValue(0);
    volumeX.setValue(26);
    volumeOpacity.setValue(0);
    shineX.setValue(-220);
    textOpacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bodyOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(bodyScale, {
          toValue: 1,
          damping: 14,
          stiffness: 180,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(wheelOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wheelY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(buttonsY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(volumeOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(volumeX, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(shineX, {
        toValue: 260,
        duration: 520,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onComplete?.();
      }
    });
  }, [visible, onComplete]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: backdrop }]}>
      <LinearGradient
        colors={['rgba(0,0,0,0.86)', 'rgba(8,8,10,0.94)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.remoteWrap,
            {
              opacity: bodyOpacity,
              transform: [{ scale: bodyScale }],
            },
          ]}
        >
          <LinearGradient
            colors={['#e2e2e5', '#cccccf', '#b7b7bb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.remoteBody}
          >
            <Animated.View
              style={[
                styles.shine,
                {
                  transform: [{ translateX: shineX }, { rotate: '18deg' }],
                },
              ]}
            />

            <View style={styles.topBar}>
              <View style={styles.indicatorPill} />
              <View style={styles.powerButton} />
            </View>

            <Animated.View
              style={[
                styles.wheelContainer,
                {
                  opacity: wheelOpacity,
                  transform: [{ translateY: wheelY }],
                },
              ]}
            >
              <View style={styles.wheelOuter}>
                <View style={styles.wheelCenter} />
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.middleButtons,
                {
                  opacity: buttonsOpacity,
                  transform: [{ translateY: buttonsY }],
                },
              ]}
            >
              <View style={styles.roundButton} />
              <View style={styles.roundButton} />
            </Animated.View>

            <Animated.View
              style={[
                styles.bottomSection,
                {
                  opacity: buttonsOpacity,
                  transform: [{ translateY: buttonsY }],
                },
              ]}
            >
              <View style={styles.leftButtonsColumn}>
                <View style={styles.roundButton} />
                <View style={styles.roundButton} />
              </View>

              <Animated.View
                style={[
                  styles.volumePill,
                  {
                    opacity: volumeOpacity,
                    transform: [{ translateX: volumeX }],
                  },
                ]}
              />
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const REMOTE_WIDTH = Math.min(width * 0.55, 220);
const REMOTE_HEIGHT = Math.min(height * 0.56, 470);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteBody: {
    width: REMOTE_WIDTH,
    height: REMOTE_HEIGHT,
    borderRadius: 34,
    paddingHorizontal: 18,
    paddingTop: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d7d7db',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  shine: {
    position: 'absolute',
    top: -50,
    width: 54,
    height: REMOTE_HEIGHT + 120,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  indicatorPill: {
    width: 18,
    height: 6,
    borderRadius: 5,
    backgroundColor: '#202124',
    marginLeft: 70,
  },
  powerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#efeff1',
    borderWidth: 1,
    borderColor: '#3d3e43',
  },
  wheelContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  wheelOuter: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: '#0b0b0d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelCenter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#161618',
  },
  middleButtons: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  roundButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0c0c0d',
  },
  bottomSection: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    paddingHorizontal: 10,
  },
  leftButtonsColumn: {
    gap: 16,
  },
  volumePill: {
    width: 56,
    height: 152,
    borderRadius: 28,
    backgroundColor: '#0c0c0d',
  },
  label: {
    marginTop: 26,
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});