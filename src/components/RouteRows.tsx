import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RouteRows({ from, to }: { from?: string; to?: string }) {
  return (
    <View>
      <View style={styles.row}>
        <Ionicons name="ellipse" size={9} color="#22a45d" />
        <Text style={styles.addr} numberOfLines={1}>{from}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="square" size={9} color="#010E39" />
        <Text style={styles.addr} numberOfLines={1}>{to}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  addr: { fontSize: 14, color: '#444', marginLeft: 10, flex: 1 },
});
