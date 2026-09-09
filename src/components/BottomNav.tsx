import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';

type Key = 'home' | 'trips' | 'requests' | 'profile';

const ITEMS: { key: Key; label: string; icon: any; route: string }[] = [
  { key: 'home', label: 'Home', icon: 'home', route: '/home' },
  { key: 'trips', label: 'Trips', icon: 'briefcase', route: '/my-trips' },
  { key: 'requests', label: 'Requests', icon: 'notifications', route: '/requests' },
  { key: 'profile', label: 'Profile', icon: 'person', route: '/profile' },
];

export default function BottomNav({ active, requestCount = 0 }: { active: Key; requestCount?: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
      {ITEMS.map((item) => {
        const on = item.key === active;
        const color = on ? colors.green : '#9aa8bb';
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => { if (!on) router.push(item.route as any); }}>
            <View>
              <Ionicons name={on ? item.icon : (`${item.icon}-outline` as any)} size={22} color={color} />
              {item.key === 'requests' && requestCount > 0 && <View style={styles.dot} />}
            </View>
            <Text style={[styles.label, { color, fontFamily: on ? fonts.bold : fonts.semi }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, paddingHorizontal: 30 },
  item: { alignItems: 'center', gap: 5, flex: 1 },
  label: { fontSize: 10 },
  dot: { position: 'absolute', top: -3, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
});
