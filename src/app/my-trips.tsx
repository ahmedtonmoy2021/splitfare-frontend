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
import BottomNav from '../components/BottomNav';
import { colors, fonts, radius, shadow } from '../theme';

function statusPill(status: string) {
  switch (status) {
    case 'accepted': return { label: 'CONFIRMED', bg: '#e6f4ee', fg: '#0d6b4c' };
    case 'paid': return { label: 'PAID', bg: '#e6f4ee', fg: '#0d6b4c' };
    case 'pending': return { label: 'AWAITING DRIVER', bg: '#fdf1d8', fg: '#8a6100' };
    case 'rejected': return { label: 'DECLINED', bg: '#fdecea', fg: '#c0392b' };
    default: return { label: String(status || '').toUpperCase(), bg: '#eef1f6', fg: '#5c6b81' };
  }
}

function RouteBig({ from, to }: { from?: string; to?: string }) {
  return (
    <View style={styles.routeBig}>
      <Text style={styles.city} numberOfLines={1}>{from || 'Pickup'}</Text>
      <View style={styles.line} />
      <Text style={[styles.city, { textAlign: 'right' }]} numberOfLines={1}>{to || 'Destination'}</Text>
    </View>
  );
}

export default function MyTrips() {
  const { token, mode } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [tab, setTab] = useState<'booked' | 'driving'>(mode === 'driver' ? 'driving' : 'booked');
  const [rides, setRides] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [r, b] = await Promise.all([
        axios.get(`${API_URL}/api/rides/my`, { headers }),
        axios.get(`${API_URL}/api/bookings/my`, { headers }),
      ]);
      setRides(r.data);
      setBookings(b.data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function payBooking(b: any) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.post(`${API_URL}/api/payments/create-intent`, { bookingId: b._id }, { headers });
      const init = await initPaymentSheet({
        merchantDisplayName: 'SplitFare',
        paymentIntentClientSecret: data.clientSecret,
        defaultBillingDetails: { address: { country: 'GB' } },
      });
      if (init.error) return toast.show(init.error.message, 'error');
      const result = await presentPaymentSheet();
      if (result.error) {
        if (result.error.code !== 'Canceled') toast.show(result.error.message, 'error');
        return;
      }
      await axios.post(`${API_URL}/api/payments/confirm`, { bookingId: b._id }, { headers });
      setBookings((prev) => prev.map((x) => (x._id === b._id ? { ...x, status: 'paid' } : x)));
      toast.show('Payment successful 🎉', 'success');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Payment failed', 'error');
    }
  }

  const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 22, paddingBottom: 14 }}>
        <Text style={styles.title}>My trips</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'booked' && styles.tabOn]} onPress={() => setTab('booked')} activeOpacity={0.9}>
          <Text style={tab === 'booked' ? styles.tabTextOn : styles.tabText}>Booked</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'driving' && styles.tabOn]} onPress={() => setTab('driving')} activeOpacity={0.9}>
          <Text style={tab === 'driving' ? styles.tabTextOn : styles.tabText}>As driver</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.ink} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

          {tab === 'driving' && (rides.length === 0 ? (
            <Empty text="You haven't posted any rides yet." />
          ) : rides.map((ride) => (
            <View key={ride._id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.kicker}>YOU'RE DRIVING · {fmtDay(ride.departureTime)}</Text>
                <View style={[styles.pill, { backgroundColor: '#e8f0fc' }]}>
                  <Text style={[styles.pillText, { color: '#1f66cd' }]}>{ride.seatsAvailable}/{ride.seatsTotal} SEATS</Text>
                </View>
              </View>
              <RouteBig from={ride.origin?.address} to={ride.destination?.address} />
              <Text style={styles.meta}>{fmtTime(ride.departureTime)} · £{ride.pricePerSeat}/seat</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push(`/active-ride?rideId=${ride._id}`)} activeOpacity={0.9}>
                <Text style={styles.primaryBtnText}>View pickups</Text>
              </TouchableOpacity>
            </View>
          )))}

          {tab === 'booked' && (bookings.length === 0 ? (
            <Empty text="You haven't booked any rides yet." />
          ) : bookings.map((b) => {
            const p = statusPill(b.status);
            const confirmed = b.status === 'accepted' || b.status === 'paid';
            return (
              <View key={b._id} style={[styles.card, confirmed && styles.cardTopHi]}>
                <View style={styles.cardTop}>
                  <Text style={styles.kicker}>{b.ride?.departureTime ? `${fmtDay(b.ride.departureTime)} · ${fmtTime(b.ride.departureTime)}` : ''}</Text>
                  <View style={[styles.pill, { backgroundColor: p.bg }]}><Text style={[styles.pillText, { color: p.fg }]}>{p.label}</Text></View>
                </View>
                <RouteBig from={b.ride?.origin?.address} to={b.ride?.destination?.address} />
                <Text style={styles.meta}>
                  {b.ride?.driver?.name || 'Driver'} · {b.seats} seat{b.seats !== 1 ? 's' : ''} · £{b.totalPrice}
                  {b.status === 'paid' ? ' · paid' : b.status === 'accepted' ? ' · ready to pay' : ' · not charged yet'}
                </Text>

                {b.status === 'accepted' && (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => payBooking(b)} activeOpacity={0.9}>
                    <Ionicons name="card" size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>  Pay £{b.totalPrice}</Text>
                  </TouchableOpacity>
                )}

                {(b.status === 'accepted' || b.status === 'paid') && (
                  <View style={styles.actionRow}>
                    {b.ride?.driver?.phone && (
                      <TouchableOpacity style={styles.ghostBtn} onPress={() => Linking.openURL(`tel:${b.ride.driver.phone}`)} activeOpacity={0.85}>
                        <Ionicons name="call" size={15} color={colors.ink} />
                        <Text style={styles.ghostText}>Call</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => router.push(`/chat?bookingId=${b._id}&name=${encodeURIComponent(b.ride?.driver?.name || 'Driver')}`)} activeOpacity={0.85}>
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.ink} />
                      <Text style={styles.ghostText}>Message</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }))}
        </ScrollView>
      )}

      <BottomNav active="trips" />
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="car-outline" size={40} color="#c3cbd8" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontFamily: fonts.extra, color: colors.ink, letterSpacing: -0.6 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, marginBottom: 14 },
  tab: { borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: '#dcdad4' },
  tabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontFamily: fonts.bold, fontSize: 12, color: '#6b7a90' },
  tabTextOn: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 17, gap: 13, ...shadow.soft },
  cardTopHi: { borderWidth: 1.5, borderColor: colors.green, shadowColor: colors.green, shadowOpacity: 0.12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 0.6, color: colors.textMuted, flex: 1 },
  pill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  pillText: { fontFamily: fonts.monoBold, fontSize: 10 },
  routeBig: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  city: { fontFamily: fonts.extra, fontSize: 18, color: colors.ink, letterSpacing: -0.4, flexShrink: 1, maxWidth: '42%' },
  line: { flex: 1, height: 1, backgroundColor: '#c8cfda' },
  meta: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textSecondary },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, borderRadius: radius.sm, paddingVertical: 13 },
  primaryBtnText: { color: '#fff', fontFamily: fonts.extra, fontSize: 13.5 },
  actionRow: { flexDirection: 'row', gap: 10 },
  ghostBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6dbe3', borderRadius: radius.sm, paddingVertical: 11 },
  ghostText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 70, gap: 10 },
  emptyText: { fontSize: 14, color: colors.textSecondary, fontFamily: fonts.med },
});
