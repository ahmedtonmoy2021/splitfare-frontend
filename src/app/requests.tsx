import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
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

function statusInfo(status: string) {
  switch (status) {
    case 'accepted': return { label: 'ACCEPTED', bg: '#e6f4ee', fg: '#0d6b4c', note: 'Accepted! Pay to confirm your seat.' };
    case 'paid': return { label: 'PAID', bg: '#e6f4ee', fg: '#0d6b4c', note: 'Paid · your seat is confirmed.' };
    case 'rejected': return { label: 'DECLINED', bg: '#fdecea', fg: '#c0392b', note: 'The driver declined this request.' };
    default: return { label: 'PENDING', bg: '#fdf1d8', fg: '#8a6100', note: 'Waiting for the driver to accept.' };
  }
}

export default function Requests() {
  const { token, mode } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const isDriver = mode === 'driver';

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const url = isDriver ? '/api/bookings/for-my-rides' : '/api/bookings/my';
      const res = await axios.get(`${API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } });
      setItems(res.data);
    } catch {
      toast.show('Could not load requests', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, isDriver]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    socket.on('new-request', handler);
    socket.on('booking-updated', handler);
    return () => { socket.off('new-request', handler); socket.off('booking-updated', handler); };
  }, [socket, load]);

  async function respond(id: string, action: 'accept' | 'reject') {
    try {
      const res = await axios.patch(`${API_URL}/api/bookings/${id}`, { action }, { headers: { Authorization: `Bearer ${token}` } });
      setItems((prev) => prev.map((b) => (b._id === id ? { ...b, status: res.data.status } : b)));
      toast.show(action === 'accept' ? 'Booking accepted' : 'Booking rejected', action === 'accept' ? 'success' : 'info');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Could not update', 'error');
    }
  }

  async function payBooking(b: any) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.post(`${API_URL}/api/payments/create-intent`, { bookingId: b._id }, { headers });
      const init = await initPaymentSheet({ merchantDisplayName: 'SplitFare', paymentIntentClientSecret: data.clientSecret, defaultBillingDetails: { address: { country: 'GB' } } });
      if (init.error) return toast.show(init.error.message, 'error');
      const result = await presentPaymentSheet();
      if (result.error) { if (result.error.code !== 'Canceled') toast.show(result.error.message, 'error'); return; }
      await axios.post(`${API_URL}/api/payments/confirm`, { bookingId: b._id }, { headers });
      setItems((prev) => prev.map((x) => (x._id === b._id ? { ...x, status: 'paid' } : x)));
      toast.show('Payment successful 🎉', 'success');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Payment failed', 'error');
    }
  }

  const pending = items.filter((b) => b.status === 'pending').length;

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 22, paddingBottom: 16 }}>
        <Text style={styles.title}>{isDriver ? 'Requests' : 'My requests'}</Text>
        <Text style={styles.subtitle}>
          {isDriver
            ? (pending > 0 ? `${pending} waiting on you` : 'Requests on rides you posted')
            : 'Status of rides you requested'}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.ink} /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="mail-open-outline" size={44} color="#c3cbd8" />
          <Text style={styles.emptyText}>{isDriver ? 'No requests yet.' : "You haven't requested any rides yet."}</Text>
          <Text style={styles.emptySub}>{isDriver ? 'When someone requests your ride, it shows here.' : 'Requests you send to drivers show here.'}</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

          {isDriver
            ? items.map((b) => {
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

                    {b.status === 'pending' && (
                      <View style={styles.actions}>
                        <TouchableOpacity style={styles.decline} onPress={() => respond(b._id, 'reject')} activeOpacity={0.85}>
                          <Text style={styles.declineText}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.accept} onPress={() => respond(b._id, 'accept')} activeOpacity={0.9}>
                          <Text style={styles.acceptText}>Accept</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {b.status === 'accepted' && (
                      <View style={styles.waitBox}>
                        <Ionicons name="time-outline" size={15} color={colors.warning} />
                        <Text style={styles.waitText}>Accepted — waiting for the rider's payment. Contact unlocks after payment.</Text>
                      </View>
                    )}

                    {b.status === 'paid' && (
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
              })
            : items.map((b) => {
                const s = statusInfo(b.status);
                const confirmed = b.status === 'accepted' || b.status === 'paid';
                return (
                  <View key={b._id} style={[styles.card, confirmed && styles.cardAccepted]}>
                    <View style={styles.riderRow}>
                      <Avatar user={b.ride?.driver} size={42} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.riderName} numberOfLines={1}>{b.ride?.driver?.name || 'Driver'}</Text>
                        <Text style={styles.riderMeta}>{b.seats} seat{b.seats !== 1 ? 's' : ''} · £{b.totalPrice}</Text>
                      </View>
                      <View style={[styles.pill, { backgroundColor: s.bg }]}><Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text></View>
                    </View>

                    <Text style={styles.route} numberOfLines={1}>{b.ride?.origin?.address || 'Pickup'}  →  {b.ride?.destination?.address || 'Destination'}</Text>
                    <Text style={styles.note}>{s.note}</Text>

                    {b.status === 'accepted' && (
                      <TouchableOpacity style={styles.pay} onPress={() => payBooking(b)} activeOpacity={0.9}>
                        <Ionicons name="card" size={16} color="#fff" />
                        <Text style={styles.payText}>  Pay £{b.totalPrice}</Text>
                      </TouchableOpacity>
                    )}

                    {b.status === 'paid' && (
                      <View style={styles.actions}>
                        <TouchableOpacity style={styles.ghost} onPress={() => router.push(`/chat?bookingId=${b._id}&name=${encodeURIComponent(b.ride?.driver?.name || 'Driver')}`)} activeOpacity={0.85}>
                          <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.ink} />
                          <Text style={styles.ghostText}>Message</Text>
                        </TouchableOpacity>
                        {b.ride?.driver?.phone && (
                          <TouchableOpacity style={styles.ghost} onPress={() => Linking.openURL(`tel:${b.ride.driver.phone}`)} activeOpacity={0.85}>
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

      <BottomNav active="requests" requestCount={isDriver ? pending : 0} />
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
  route: { fontFamily: fonts.semi, fontSize: 13, color: colors.textSecondary },
  note: { fontFamily: fonts.med, fontSize: 12.5, color: colors.ink },
  pill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  pillWait: { backgroundColor: '#fdf1d8' },
  pillOk: { backgroundColor: '#e6f4ee' },
  pillNo: { backgroundColor: '#fdecea' },
  pillText: { fontFamily: fonts.monoBold, fontSize: 10 },
  meetBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f7fa', borderRadius: radius.sm, padding: 11 },
  meetText: { flex: 1, fontSize: 12.5, color: colors.textSecondary, fontFamily: fonts.med },
  waitBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fdf1d8', borderRadius: radius.sm, padding: 11 },
  waitText: { flex: 1, fontSize: 12, color: '#8a6100', fontFamily: fonts.semi, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 10 },
  decline: { flex: 1, borderWidth: 1, borderColor: '#cfd6e0', borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center' },
  declineText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  accept: { flex: 2, backgroundColor: colors.green, borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center' },
  acceptText: { fontFamily: fonts.extra, fontSize: 13.5, color: '#fff' },
  pay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green, borderRadius: radius.sm, paddingVertical: 13 },
  payText: { color: '#fff', fontFamily: fonts.extra, fontSize: 13.5 },
  ghost: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#c2d7f6', borderRadius: radius.sm, paddingVertical: 11 },
  ghostText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  liveNote: { textAlign: 'center', fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, paddingVertical: 8 },
});
