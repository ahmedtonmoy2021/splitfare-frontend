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
import Avatar from '../components/Avatar';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import RouteRows from '../components/RouteRows';
import Countdown from '../components/Countdown';

export default function MyTrips() {
  const { token, mode } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const isDriver = mode === 'driver';

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

  const [tab, setTab] = useState<'rides' | 'bookings'>('rides');
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

  const fmt = (d: string) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' } as any);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <ScreenHeader title={isDriver ? 'Rides I posted' : 'My bookings'} />

      {loading ? (
        <ActivityIndicator size="large" color="#010E39" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

          {isDriver && (rides.length === 0 ? (
            <Empty text="You haven't posted any rides yet." />
          ) : rides.map((ride) => (
            <Card key={ride._id}>
              <View style={styles.cardTop}>
                <Text style={styles.price}>£{ride.pricePerSeat}/seat</Text>
                <StatusBadge status={ride.status} />
              </View>
              <RouteRows from={ride.origin?.address} to={ride.destination?.address} />
              <Text style={styles.time}>{fmt(ride.departureTime)}</Text>
              <Text style={styles.seats}>{ride.seatsAvailable} of {ride.seatsTotal} seats left</Text>
              <Countdown time={ride.departureTime} />
              <TouchableOpacity style={styles.pickupsBtn} onPress={() => router.push(`/active-ride?rideId=${ride._id}`)}>
                <Ionicons name="map" size={16} color="#010E39" />
                <Text style={styles.pickupsText}>View pickups</Text>
              </TouchableOpacity>
            </Card>
          )))}

          {!isDriver && (bookings.length === 0 ? (
            <Empty text="You haven't booked any rides yet." />
          ) : bookings.map((b) => (
            <Card key={b._id}>
              <View style={styles.cardTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Avatar user={b.ride?.driver} size={36} />
                  <Text style={styles.driver}>{b.ride?.driver?.name || 'Driver'}</Text>
                </View>
                <StatusBadge status={b.status} />
              </View>
              <RouteRows from={b.ride?.origin?.address} to={b.ride?.destination?.address} />
              <Text style={styles.time}>{b.ride?.departureTime && fmt(b.ride.departureTime)}</Text>
              <Text style={styles.seats}>{b.seats} seat{b.seats !== 1 ? 's' : ''} · £{b.totalPrice}</Text>
              {b.ride?.departureTime && <Countdown time={b.ride.departureTime} />}

              {b.status === 'accepted' && (
                <TouchableOpacity style={styles.payBtn} onPress={() => payBooking(b)}>
                  <Ionicons name="card" size={16} color="#fff" />
                  <Text style={styles.payText}>Pay £{b.totalPrice}</Text>
                </TouchableOpacity>
              )}

              {(b.status === 'accepted' || b.status === 'paid') && b.ride?.driver?.phone && (
                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${b.ride.driver.phone}`)}>
                  <Ionicons name="call" size={15} color="#fff" />
                  <Text style={styles.callText}>Call driver</Text>
                </TouchableOpacity>
              )}

              {b.status !== 'rejected' && b.status !== 'pending' && (
                <TouchableOpacity style={styles.msgBtn} onPress={() => router.push(`/chat?bookingId=${b._id}&name=${encodeURIComponent(b.ride?.driver?.name || 'Driver')}`)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color="#010E39" />
                  <Text style={styles.msgText}>Message driver</Text>
                </TouchableOpacity>
              )}
            </Card>
          )))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="car-outline" size={44} color="#ccc" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EAF2FB', paddingHorizontal: 20 },
  tabs: { flexDirection: 'row', backgroundColor: '#f2f2f2', borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#010E39' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#fff' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  price: { fontSize: 17, fontWeight: '700', color: '#010E39' },
  driver: { fontSize: 15, fontWeight: '700', color: '#010E39', marginLeft: 10 },
  time: { fontSize: 13, color: '#888', marginTop: 4, marginLeft: 19 },
  seats: { fontSize: 13, color: '#555', marginTop: 4, marginLeft: 19, fontWeight: '600' },
  pickupsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#010E39' },
  pickupsText: { color: '#010E39', fontWeight: '700', fontSize: 15 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#010E39' },
  payText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#1a7f3c' },
  callText: { color: '#fff', fontWeight: '700' },
  msgBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, padding: 11, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  msgText: { color: '#010E39', fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 15, color: '#777', marginTop: 12, fontWeight: '600' },
});
