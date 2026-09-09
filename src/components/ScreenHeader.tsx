import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';

export default function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onBack || (() => router.back())} hitSlop={10} style={styles.back}>
        <Ionicons name="arrow-back" size={18} color={colors.ink} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  back: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: '#d6dbe3', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: fonts.extra, color: colors.ink, letterSpacing: -0.3 },
});
