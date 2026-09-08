import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/Avatar';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { user, token, mode, setMode, logout } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const isDriver = mode === 'driver';

  useEffect(() => {
    if (!socket) return;
    const handler = () => setPendingCount((c) => c + 1);
    socket.on('new-request', handler);
    return () => socket.off('new-request', handler);
  }, [socket]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      axios
        .get(`${API_URL}/api/bookings/for-my-rides`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => setPendingCount(res.data.filter((b: any) => b.status === 'pending').length))
        .catch(() => {});
    }, [token])
  );

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <Text style={styles.greetingSmall}>{greeting()},</Text>
          <Text style={styles.greeting} numberOfLines={1}>{user?.name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{isDriver ? 'Share your journey' : 'Where are you going today?'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Avatar user={user} size={46} />
        </TouchableOpacity>
      </View>

      {!user?.phone && (
        <TouchableOpacity style={styles.phoneWarn} onPress={() => router.push('/profile')}>
          <Ionicons name="warning-outline" size={16} color="#a35b00" />
          <Text style={styles.phoneWarnText}>Add your phone number to post or book rides</Text>
        </TouchableOpacity>
      )}

      {isDriver ? (
        <>
          <TouchableOpacity style={styles.postBtn} onPress={() => router.push('/post-ride')}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.postText}>Post a Ride</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/requests')}>
            <View style={styles.linkLeft}>
              <Ionicons name="notifications-outline" size={20} color="#010E39" />
              <Text style={styles.linkText}>Ride Requests</Text>
              {pendingCount > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{pendingCount}</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#bbb" />
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.postBtn} onPress={() => router.push('/search')}>
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={styles.postText}>Find a Ride</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/my-trips')}>
        <View style={styles.linkLeft}>
          <Ionicons name="briefcase-outline" size={20} color="#010E39" />
          <Text style={styles.linkText}>My Trips</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#bbb" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={async () => { await logout(); router.replace('/'); }}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 80, backgroundColor: '#EAF2FB' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topLeft: { flex: 1, marginRight: 12 },
  greetingSmall: { fontSize: 15, color: '#000', fontWeight: '500' },
  greeting: { fontSize: 26, fontWeight: 'bold', color: '#000' },
  subtitle: { fontSize: 16, color: '#888', marginTop: 8 },
  profileBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#010E39', alignItems: 'center', justifyContent: 'center' },
  profileText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  modeToggle: { flexDirection: 'row', backgroundColor: '#f2f2f2', borderRadius: 14, padding: 4, marginTop: 24 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center' },
  modeActive: { backgroundColor: '#010E39' },
  modeText: { fontSize: 15, fontWeight: '700', color: '#666' },
  modeTextActive: { fontSize: 15, fontWeight: '700', color: '#fff' },
  phoneWarn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff4e5', borderRadius: 10, padding: 12, marginTop: 20, borderWidth: 1, borderColor: '#ffd9a0' },
  phoneWarnText: { flex: 1, color: '#a35b00', fontSize: 13, fontWeight: '600' },
  postBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#010E39', padding: 16, borderRadius: 12, marginTop: 30 },
  postText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, marginTop: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkText: { fontSize: 16, fontWeight: '600', color: '#010E39' },
  linkArrow: { fontSize: 22, color: '#bbb' },
  countBadge: { backgroundColor: '#c0392b', minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  logoutBtn: { marginTop: 40, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  logoutText: { color: '#010E39', fontWeight: '800' },
});