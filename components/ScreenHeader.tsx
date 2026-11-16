import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  back?: boolean;
  right?: { label: string; onPress: () => void };
};

/** Barra superior mínima: "‹ Atrás" a la izquierda y una acción opcional a la derecha. */
export default function ScreenHeader({ back, right }: Props) {
  return (
    <View style={styles.row}>
      {back ? (
        <Pressable
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/devices'))}
        >
          <Text style={styles.link}>‹ Atrás</Text>
        </Pressable>
      ) : (
        <View />
      )}
      {right ? (
        <Pressable hitSlop={12} onPress={right.onPress}>
          <Text style={styles.link}>{right.label}</Text>
        </Pressable>
      ) : (
        <View />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40,
    marginBottom: 6,
  },
  link: {
    color: '#a9a9b0',
    fontSize: 16,
    fontWeight: '600',
  },
});
