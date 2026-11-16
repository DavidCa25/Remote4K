import { Redirect } from 'expo-router';
import { ActivityIndicator, Platform, View } from 'react-native';

import { useRemoteStore, useStoreHydrated } from '@/src/store/useRemoteStore';

export default function Index() {
  const hydrated = useStoreHydrated();
  const { bridgeUrl, device } = useRemoteStore();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (Platform.OS !== 'web' && !bridgeUrl) return <Redirect href="/settings" />;
  if (device) return <Redirect href="/remote" />;
  return <Redirect href="/devices" />;
}
