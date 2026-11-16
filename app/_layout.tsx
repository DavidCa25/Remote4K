import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#000', card: '#000' },
};

export default function RootLayout() {
  // En web la app se pre-renderiza en Node; se monta solo en el navegador para
  // que tamaños de pantalla y estado guardado sean los reales.
  const [mounted, setMounted] = useState(Platform.OS !== 'web');
  useEffect(() => {
    setMounted(true);
    if (Platform.OS === 'web' && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (!mounted) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
          animation: 'fade',
        }}
      />
    </ThemeProvider>
  );
}
