import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { nearestOnRoute, haversine, fmtDistance } from '../utils/geo';

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e6f2' }] },
];

export default function ActiveRide() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<any>(null);

  const [ride, setRide] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/bookings/for-ride/${rideId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRide(data.ride);

        let driverLoc: any = null;
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const loc = await Location.getCurrentPositionAsync({});
          driverLoc = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        }

        const withMeet = data.bookings.map((b: any) => {
          const mp = b.pickup && data.ride.routeCoords?.length ? nearestOnRoute(data.ride.routeCoords, b.pickup) : null;
          const distFromDriver = driverLoc && mp ? haversine(driverLoc.lat, driverLoc.lng, mp.lat, mp.lng) : Infinity;
          return { ...b, meet: mp, distFromDriver };
        });
        withMeet.sort((a: any, bb: any) => a.distFromDriver - bb.distFromDriver);
        setStops(withMeet);

        setTimeout(() => {
          const pts = withMeet.filter((s: any) => s.meet).map((s: any) => ({ latitude: s.meet.lat, longitude: s.meet.lng }));
          if (driverLoc) pts.push({ latitude: driverLoc.lat, longitude: driverLoc.lng });
          if (pts.length) mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: 100, right: 60, bottom: 320, left: 60 }, animated: true });
        }, 500);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [rideId]);

  const routeLine = ride?.routeCoords?.map((c: number[]) => ({ latitude: c[1], longitude: c[0] })) || [];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: 51.4816, longitude: -3.1791, latitudeDelta: 0.3, longitudeDelta: 0.3 }}
        showsUserLocation>
        {routeLine.length > 0 && <Polyline coordinates={routeLine} strokeWidth={4} strokeColor="#010E39" />}
        {stops.map((s, i) =>
          s.meet ? (
            <Marker key={s._id} coordinate={{ latitude: s.meet.lat, longitude: s.meet.lng }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.numPin}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
            </Marker>
          ) : null
        )}
      </MapView>

      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <Text style={styles.backChevron}>‹</Text>
      </TouchableOpacity>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Pickup order</Text>
        <Text style={styles.sub}>Nearest to you first — riders wait on your route</Text>

        {loading ? (
          <ActivityIndicator color="#010E39" style={{ marginTop: 20 }} />
        ) : stops.length === 0 ? (
          <Text style={styles.empty}>No confirmed riders yet.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 280 }}>
            {stops.map((s, i) => (
              <View key={s._id} style={styles.stopRow}>
                <View style={styles.orderNum}><Text style={styles.orderNumText}>{i + 1}</Text></View>
                <Avatar user={s.rider} size={38} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.riderName}>{s.rider?.name || 'Rider'}</Text>
                  <Text style={styles.stopMeta}>
                    {s.seats} seat{s.seats !== 1 ? 's' : ''}
                    {s.meet ? ` · rider walks ~${fmtDistance(s.meet.distance)}` : ''}
                    {s.status === 'paid' ? ' · Paid' : ' · Unpaid'}
                  </Text>
                </View>
                {s.rider?.phone && (
                  <TouchableOpacity style={styles.callMini} onPress={() => Linking.openURL(`tel:${s.rider.phone}`)}>
                    <Ionicons name="call" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e8e8e8' },
  backBtn: { position: 'absolute', left: 16, backgroundColor: '#fff', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  backChevron: { fontSize: 30, color: '#010E39', marginTop: -3 },
  numPin: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a56c4', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  numText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#010E39' },
  sub: { fontSize: 13, color: '#888', marginTop: 2, marginBottom: 12 },
  empty: { color: '#888', textAlign: 'center', marginTop: 16 },
  stopRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  orderNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1a56c4', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  orderNumText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  riderName: { fontSize: 15, fontWeight: '700', color: '#010E39' },
  stopMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  callMini: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a7f3c', alignItems: 'center', justifyContent: 'center' },
});
