import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Vibración ligera; en web usa navigator.vibrate (Android) y no hace nada en iOS. */
export function tap(strong = false) {
  if (Platform.OS === 'web') {
    try {
      (navigator as any)?.vibrate?.(strong ? 18 : 8);
    } catch {}
    return;
  }
  const p = strong
    ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    : Haptics.selectionAsync();
  p.catch(() => {});
}
