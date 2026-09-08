import { View, Text, StyleSheet } from 'react-native';

const COLORS: any = {
  pending: { bg: '#fff4e5', text: '#a35b00' },
  accepted: { bg: '#e6f6ec', text: '#1a7f3c' },
  rejected: { bg: '#fdecea', text: '#c0392b' },
  paid: { bg: '#e8f0fe', text: '#1a56c4' },
  cancelled: { bg: '#f0f0f0', text: '#777' },
  active: { bg: '#e6f6ec', text: '#1a7f3c' },
  full: { bg: '#fff4e5', text: '#a35b00' },
  completed: { bg: '#f0f0f0', text: '#777' },
};

export default function StatusBadge({ status }: { status: string }) {
  const c = COLORS[status] || COLORS.pending;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  text: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
});
