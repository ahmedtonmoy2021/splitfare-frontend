import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function PrimaryButton({ title, onPress, loading, disabled, style }: any) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: '#010E39', borderRadius: 12, padding: 16, alignItems: 'center' },
  disabled: { backgroundColor: '#ccc' },
  text: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
