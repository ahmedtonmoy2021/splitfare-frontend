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
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import RouteRows from '../components/RouteRows';
import { nearestOnRoute, fmtDistance } from '../utils/geo';

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

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <ScreenHeader title="Ride Requests" />

      {loading ? (
        <ActivityIndicator size="large" color="#010E39" style={{ marginTop: 40 }} />
      ) : bookings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="mail-open-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No requests yet.</Text>
          <Text style={styles.emptySub}>When someone requests your ride, it shows here.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
          {bookings.map((b) => (
            <Card key={b._id}>
              <View style={styles.cardTop}>
                <Avatar user={b.rider} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.riderName}>{b.rider?.name || 'Rider'}</Text>
                  <Text style={styles.meta}>{b.seats} seat{b.seats !== 1 ? 's' : ''} · £{b.totalPrice}</Text>
                </View>
                <StatusBadge status={b.status} />
              </View>

              <RouteRows from={b.ride?.origin?.address} to={b.ride?.destination?.address} />
              <Text style={styles.time}>
                {b.ride?.departureTime && new Date(b.ride.departureTime).toLocaleString()}
              </Text>

              {(() => {
                if (!b.pickup || !b.ride?.routeCoords?.length)
                  return null;
                const mp = nearestOnRoute(b.ride.routeCoords, b.pickup);
                if (!mp) return null;
                return (
                  <View style={styles.meetBox}>
                    <Ionicons name="walk" size={15} color="#1a56c4" />
                    <Text style={styles.meetText}>
                      Pick up on your route — rider walks ~{fmtDistance(mp.distance)}
                    </Text>
                  </View>
                );
              })()}

              {(b.status === 'accepted' || b.status === 'paid') && b.pickup?.address && (
                <View style={styles.riderStops}>
                  <View style={styles.stopLine}>
                    <Ionicons name="person" size={13} color="#22a45d" />
                    <Text style={styles.stopLabel}>Rider pickup</Text>
                  </View>
                  <Text style={styles.stopVal}>{b.pickup.address}</Text>
                  {b.dropoff?.address && (
                    <>
                      <View style={[styles.stopLine, { marginTop: 8 }]}>
                        <Ionicons name="flag" size={13} color="#c0392b" />
                        <Text style={styles.stopLabel}>Rider drop-off</Text>
                      </View>
                      <Text style={styles.stopVal}>{b.dropoff.address}</Text>
                    </>
                  )}
                </View>
              )}

              {b.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => respond(b._id, 'reject')}>
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => respond(b._id, 'accept')}>
                    <Text style={styles.acceptText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              )}

              {b.status === 'accepted' && b.rider?.phone && (
                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${b.rider.phone}`)}>
                  <Ionicons name="call" size={16} color="#fff" />
                  <Text style={styles.callText}>Call {b.rider.phone}</Text>
                </TouchableOpacity>
              )}

              {b.status !== 'rejected' && (
                <TouchableOpacity style={styles.msgBtn} onPress={() => router.push(`/chat?bookingId=${b._id}&name=${encodeURIComponent(b.rider?.name || 'Rider')}`)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#010E39" />
                  <Text style={styles.msgText}>Message rider</Text>
                </TouchableOpacity>
              )}
            </Card>
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EAF2FB', paddingHorizontal: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { fontSize: 16, color: '#555', marginTop: 12, fontWeight: '600' },
  emptySub: { fontSize: 14, color: '#999', marginTop: 4, textAlign: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  riderName: { fontSize: 16, fontWeight: '700', color: '#010E39' },
  meta: { fontSize: 13, color: '#888', marginTop: 2 },
  time: { fontSize: 13, color: '#888', marginTop: 4, marginLeft: 19 },
  meetBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e8f0fe', borderRadius: 10, padding: 10, marginTop: 10 },
  meetText: { flex: 1, fontSize: 13, color: '#1a56c4', fontWeight: '600' },
  riderStops: { backgroundColor: '#f7f7f7', borderRadius: 10, padding: 12, marginTop: 8 },
  stopLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  stopLabel: { fontSize: 12, color: '#888', fontWeight: '700' },
  stopVal: { fontSize: 14, color: '#111', fontWeight: '600', marginLeft: 19, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  rejectBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  rejectText: { color: '#c0392b', fontWeight: '700' },
  acceptBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#010E39', alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: '700' },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: '#1a7f3c' },
  callText: { color: '#fff', fontWeight: '700' },
  msgBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  msgText: { color: '#010E39', fontWeight: '700' },
});
