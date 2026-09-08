import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Avatar({ user, size = 46 }: { user: any; size?: number }) {
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (user?.avatar) {
    return <Image source={{ uri: user.avatar }} style={[shape, { backgroundColor: '#eee' }]} />;
  }

  const icon = user?.gender === 'female' ? 'woman' : user?.gender === 'male' ? 'man' : 'person';
  const bg = user?.gender === 'female' ? '#e0669a' : user?.gender === 'male' ? '#3b7dd8' : '#010E39';

  return (
    <View style={[shape, styles.center, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={size * 0.55} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
