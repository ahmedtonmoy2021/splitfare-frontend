import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/Avatar';
import BottomNav from '../components/BottomNav';
import { nearestOnRoute, fmtDistance } from '../utils/geo';
import { colors, fonts, radius, shadow } from '../theme';

export default function Requests() {
  const { token } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/bookings/for-my-rides`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(res.data);
    } catch {
      toast.show('Could not load requests', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    socket.on('new-request', handler);
    return () => socket.off('new-request', handler);
  }, [socket, load]);

  async function respond(id: string, action: 'accept' | 'reject') {
    try {
      const res = await axios.patch(
        `${API_URL}/api/bookings/${id}`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBookings((prev) => prev.map((b) => (b._id === id ? { ...b, status: res.data.status } : b)));
      toast.show(action === 'accept' ? 'Booking accepted' : 'Booking rejected', action === 'accept' ? 'success' : 'info');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Could not update', 'error');
    }
  }

  const pending = bookings.filter((b) => b.status === 'pending').length;

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 22, paddingBottom: 16 }}>
        <Text style={styles.title}>Requests</Text>
        <Text style={styles.subtitle}>
          {pending > 0 ? `${pending} waiting on you` : 'No pending requests'}
          {bookings.length > 0 ? ` · ${bookings.length} total` : ''}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.ink} style={{ marginTop: 40 }} />
      ) : bookings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="mail-open-outline" size={44} color="#c3cbd8" />
          <Text style={styles.emptyText}>No requests yet.</Text>
          <Text style={styles.emptySub}>When someone requests your ride, it shows here.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
          {bookings.map((b) => {
            const accepted = b.status === 'accepted' || b.status === 'paid';
            const rejected = b.status === 'rejected';
            const meet = b.pickup && b.ride?.routeCoords?.length ? nearestOnRoute(b.ride.routeCoords, b.pickup) : null;
            return (
              <View key={b._id} style={[styles.card, accepted && styles.cardAccepted, rejected && styles.cardMuted]}>
                <View style={styles.riderRow}>
                  <Avatar user={b.rider} size={42} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.riderName} numberOfLines={1}>{b.rider?.name || 'Rider'}</Text>
                    <Text style={styles.riderMeta}>{b.seats} seat{b.seats !== 1 ? 's' : ''} · £{b.totalPrice}</Text>
                  </View>
                  <View style={[styles.pill, accepted ? styles.pillOk : rejected ? styles.pillNo : styles.pillWait]}>
                    <Text style={[styles.pillText, { color: accepted ? '#0d6b4c' : rejected ? '#c0392b' : '#8a6100' }]}>
                      {accepted ? (b.status === 'paid' ? 'PAID' : 'ACCEPTED') : rejected ? 'DECLINED' : 'PENDING'}
                    </Text>
                  </View>
                </View>

                {b.status === 'pending' && meet && (
                  <View style={styles.meetBox}>
                    <Ionicons name="walk" size={15} color={colors.blue} />
                    <Text style={styles.meetText}>Picks up on your route — rider walks ~{fmtDistance(meet.distance)}</Text>
                  </View>
                )}

                {accepted && b.pickup?.address && (
                  <View style={styles.stops}>
                    <Text style={styles.stopKicker}>PICKUP</Text>
                    <Text style={styles.stopVal} numberOfLines={2}>{b.pickup.address}</Text>
                    {b.dropoff?.address && (
                      <>
                        <Text style={[styles.stopKicker, { marginTop: 8 }]}>DROP-OFF</Text>
                        <Text style={styles.stopVal} numberOfLines={2}>{b.dropoff.address}</Text>
                      </>
                    )}
                  </View>
                )}

                {b.status === 'pending' && (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.decline} onPress={() => respond(b._id, 'reject')} activeOpacity={0.85}>
                      <Text style={styles.declineText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.accept} onPress={() => respond(b._id, 'accept')} activeOpacity={0.9}>
                      <Text style={styles.acceptText}>Accept · reveal contact</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {accepted && (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.ghost} onPress={() => router.push(`/chat?bookingId=${b._id}&name=${encodeURIComponent(b.rider?.name || 'Rider')}`)} activeOpacity={0.85}>
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.ink} />
                      <Text style={styles.ghostText}>Message</Text>
                    </TouchableOpacity>
                    {b.rider?.phone && (
                      <TouchableOpacity style={styles.ghost} onPress={() => Linking.openURL(`tel:${b.rider.phone}`)} activeOpacity={0.85}>
                        <Ionicons name="call" size={15} color={colors.ink} />
                        <Text style={styles.ghostText}>Call</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          <Text style={styles.liveNote}>Live · updates automatically</Text>
        </ScrollView>
      )}

      <BottomNav active="requests" requestCount={pending} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontFamily: fonts.extra, color: colors.ink, letterSpacing: -0.6 },
  subtitle: { fontSize: 12.5, fontFamily: fonts.med, color: '#6b7a90', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, gap: 8 },
  emptyText: { fontSize: 15, color: colors.ink, fontFamily: fonts.bold, marginTop: 6 },
  emptySub: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.med, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 16, gap: 13, ...shadow.soft },
  cardAccepted: { backgroundColor: '#f2f7fe', borderColor: '#c2d7f6' },
  cardMuted: { opacity: 0.7 },
  riderRow: { flexDirection: 'row', alignItems: 'center' },
  riderName: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  riderMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, marginTop: 3 },
  pill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  pillWait: { backgroundColor: '#fdf1d8' },
  pillOk: { backgroundColor: '#e6f4ee' },
  pillNo: { backgroundColor: '#fdecea' },
  pillText: { fontFamily: fonts.monoBold, fontSize: 10 },
  meetBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f7fa', borderRadius: radius.sm, padding: 11 },
  meetText: { flex: 1, fontSize: 12.5, color: colors.textSecondary, fontFamily: fonts.med },
  stops: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#c2d7f6', borderRadius: radius.sm, padding: 12 },
  stopKicker: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.textMuted },
  stopVal: { fontSize: 13.5, color: colors.ink, fontFamily: fonts.semi, marginTop: 3, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  decline: { flex: 1, borderWidth: 1, borderColor: '#cfd6e0', borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center' },
  declineText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  accept: { flex: 2, backgroundColor: colors.green, borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center' },
  acceptText: { fontFamily: fonts.extra, fontSize: 13.5, color: '#fff' },
  ghost: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#c2d7f6', borderRadius: radius.sm, paddingVertical: 11 },
  ghostText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  liveNote: { textAlign: 'center', fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, paddingVertical: 8 },
});
