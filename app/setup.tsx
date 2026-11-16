import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useRemoteStore, useStoreHydrated } from '@/src/store/useRemoteStore';

/** Deep link: remote4k://setup?bridge=http://192.168.x.x:8000 (desde la página /install). */
export default function SetupLink() {
  const { bridge } = useLocalSearchParams<{ bridge?: string }>();
  const hydrated = useStoreHydrated();
  const setBridgeUrl = useRemoteStore((s) => s.setBridgeUrl);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof bridge === 'string' && bridge) setBridgeUrl(bridge);
    setDone(true);
  }, [hydrated, bridge, setBridgeUrl]);

  if (done) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
      <ActivityIndicator color="#fff" />
    </View>
  );
}
