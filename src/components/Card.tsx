import { View, StyleSheet } from 'react-native';

export default function Card({ children, style }: any) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 16, padding: 16, marginBottom: 14, backgroundColor: '#fff' },
});
