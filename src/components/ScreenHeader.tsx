import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onBack || (() => router.back())} hitSlop={10}>
        <Text style={styles.chevron}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  chevron: { fontSize: 32, color: '#010E39', marginRight: 12, marginTop: -4 },
  title: { fontSize: 20, fontWeight: '700', color: '#010E39' },
});
