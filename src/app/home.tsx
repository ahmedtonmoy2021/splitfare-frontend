import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/Avatar';
import BottomNav from '../components/BottomNav';
import { colors, fonts, radius, shadow } from '../theme';

export default function Home() {
  const { user, token, mode, setMode, logout } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pendingCount, setPendingCount] = useState(0);

  const firstName = (user?.name || 'there').split(' ')[0];
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

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
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.glow} />

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.date}>{dateLabel}</Text>
            <Text style={styles.hi}>Hi, {firstName}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.8}>
            <Avatar user={user} size={42} />
          </TouchableOpacity>
        </View>

        {!user?.phone && (
          <TouchableOpacity style={styles.warn} onPress={() => router.push('/profile')} activeOpacity={0.85}>
            <Ionicons name="warning-outline" size={16} color={colors.warning} />
            <Text style={styles.warnText}>Add your phone number to post or book rides</Text>
          </TouchableOpacity>
        )}

        <View style={styles.toggle}>
          <TouchableOpacity style={[styles.toggleBtn, styles.toggleActive]} activeOpacity={0.9} onPress={() => { setMode?.('passenger'); router.push('/search'); }}>
            <Text style={styles.toggleTextActive}>Find a ride</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleBtn} activeOpacity={0.9} onPress={() => { setMode?.('driver'); router.push('/post-ride'); }}>
            <Text style={styles.toggleText}>Post a ride</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.searchCard} activeOpacity={0.9} onPress={() => router.push('/search')}>
          <View style={styles.searchRow}>
            <View style={styles.dotBlue} />
            <Text style={styles.searchFrom}>Your location</Text>
          </View>
          <View style={styles.searchDivider} />
          <View style={styles.searchRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.searchTo}>Where to?</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Rides on your route</Text>
          <TouchableOpacity onPress={() => router.push('/search')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyCard}>
          <Ionicons name="car-outline" size={30} color="#c3cbd8" />
          <Text style={styles.emptyTitle}>Where are you headed?</Text>
          <Text style={styles.emptySub}>Enter a destination to see rides sharing your route.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/search')} activeOpacity={0.9}>
            <Text style={styles.emptyBtnText}>Search a ride</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logout} onPress={async () => { await logout(); router.replace('/'); }}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNav active="home" requestCount={pendingCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: -110, right: -130, width: 330, height: 330, borderRadius: 165, backgroundColor: 'rgba(46,123,232,0.14)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22 },
  date: { fontSize: 12.5, fontFamily: fonts.med, color: colors.textMuted },
  hi: { fontSize: 24, fontFamily: fonts.extra, color: colors.ink, letterSpacing: -0.6, marginTop: 2 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff4e5', borderWidth: 1, borderColor: '#ffd9a0', borderRadius: radius.sm, padding: 12, marginHorizontal: 22, marginTop: 16 },
  warnText: { flex: 1, color: colors.warning, fontSize: 13, fontFamily: fonts.semi },
  toggle: { flexDirection: 'row', gap: 5, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: '#dcdad4', borderRadius: radius.xl, padding: 5, marginHorizontal: 22, marginTop: 20 },
  toggleBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.sm, alignItems: 'center' },
  toggleActive: { backgroundColor: colors.ink },
  toggleText: { fontSize: 13.5, fontFamily: fonts.bold, color: '#6b7a90' },
  toggleTextActive: { fontSize: 13.5, fontFamily: fonts.bold, color: '#fff' },
  searchCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 18, marginHorizontal: 22, marginTop: 16, gap: 14, ...shadow.card },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dotBlue: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blue },
  dotGreen: { width: 9, height: 9, borderRadius: 2, backgroundColor: colors.green },
  searchDivider: { height: 1, backgroundColor: colors.borderSoft, marginLeft: 21 },
  searchFrom: { fontSize: 15, fontFamily: fonts.semi, color: colors.ink },
  searchTo: { fontSize: 15, fontFamily: fonts.semi, color: '#aab4c2' },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  seeAll: { fontSize: 12, fontFamily: fonts.semi, color: colors.green },
  emptyCard: { alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 30, paddingHorizontal: 22, marginHorizontal: 22, gap: 6, ...shadow.soft },
  emptyTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink, marginTop: 6 },
  emptySub: { fontSize: 13, fontFamily: fonts.med, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  emptyBtn: { backgroundColor: colors.ink, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 22, marginTop: 12 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontFamily: fonts.bold },
  logout: { alignSelf: 'center', marginTop: 24, paddingVertical: 10, paddingHorizontal: 20 },
  logoutText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 13 },
});
