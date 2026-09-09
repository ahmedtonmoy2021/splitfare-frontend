import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking, Share } from 'react-native';
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
import { colors, fonts, radius, shadow } from '../theme';

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#000000' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
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
          if (pts.length) mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: 100, right: 60, bottom: 360, left: 60 }, animated: true });
        }, 500);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [rideId]);

  const routeLine = ride?.routeCoords?.map((c: number[]) => ({ latitude: c[1], longitude: c[0] })) || [];
  const fromLabel = ride?.origin?.address || 'Pickup';
  const toLabel = ride?.destination?.address || 'Destination';

  async function shareTrip() {
    try {
      await Share.share({ message: `I'm on a SplitFare ride: ${fromLabel} → ${toLabel}.` });
    } catch {}
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: 51.4816, longitude: -3.1791, latitudeDelta: 0.3, longitudeDelta: 0.3 }}
        showsUserLocation>
        {routeLine.length > 0 && <Polyline coordinates={routeLine} strokeWidth={4} strokeColor={colors.ink} />}
        {stops.map((s, i) =>
          s.meet ? (
            <Marker key={s._id} coordinate={{ latitude: s.meet.lat, longitude: s.meet.lng }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.numPin}><Text style={styles.numText}>{i + 1}</Text></View>
            </Marker>
          ) : null
        )}
      </MapView>

      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()} activeOpacity={0.85}>
        <Ionicons name="arrow-back" size={18} color={colors.ink} />
      </TouchableOpacity>

      <View style={[styles.badge, { top: insets.top + 8 }]}>
        <Text style={styles.badgeKicker}>ACTIVE RIDE</Text>
        <Text style={styles.badgeRoute} numberOfLines={1}>{fromLabel} → {toLabel}</Text>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Pickup points</Text>
        <Text style={styles.sub}>Nearest to you first — riders wait on your route</Text>

        {loading ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 20 }} />
        ) : stops.length === 0 ? (
          <Text style={styles.empty}>No confirmed riders yet.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
            {stops.map((s, i) => {
              const paid = s.status === 'paid';
              return (
                <View key={s._id} style={styles.stopCard}>
                  <View style={styles.orderNum}><Text style={styles.orderNumText}>{i + 1}</Text></View>
                  <Avatar user={s.rider} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.riderName} numberOfLines={1}>{s.rider?.name || 'Rider'}</Text>
                      {paid && (
                        <View style={styles.paidTag}>
                          <Ionicons name="checkmark-circle" size={12} color={colors.green} />
                          <Text style={styles.paidTagText}>Paid</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.stopMeta}>
                      {s.seats} seat{s.seats !== 1 ? 's' : ''}{s.meet ? ` · walks ~${fmtDistance(s.meet.distance)}` : ''}
                    </Text>
                  </View>
                  {paid && (
                    <View style={styles.contactRow}>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/chat?bookingId=${s._id}&name=${encodeURIComponent(s.rider?.name || 'Rider')}`)} activeOpacity={0.85}>
                        <Ionicons name="chatbubble-ellipses" size={15} color={colors.ink} />
                      </TouchableOpacity>
                      {s.rider?.phone && (
                        <TouchableOpacity style={[styles.iconBtn, styles.callBtn]} onPress={() => Linking.openURL(`tel:${s.rider.phone}`)} activeOpacity={0.85}>
                          <Ionicons name="call" size={15} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.shareBtn} onPress={shareTrip} activeOpacity={0.9}>
          <Ionicons name="share-outline" size={17} color={colors.ink} />
          <Text style={styles.shareText}>Share trip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e8e8e8' },
  backBtn: { position: 'absolute', left: 16, backgroundColor: '#fff', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d6dbe3', ...shadow.soft },
  badge: { position: 'absolute', left: 66, right: 16, backgroundColor: colors.ink, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, ...shadow.card },
  badgeKicker: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: '#6ee0ae' },
  badgeRoute: { fontFamily: fonts.bold, fontSize: 14, color: '#fff', marginTop: 3 },
  numPin: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  numText: { color: '#fff', fontFamily: fonts.extra, fontSize: 13 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 14 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d6dbe3', alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontFamily: fonts.extra, color: colors.ink, letterSpacing: -0.4 },
  sub: { fontSize: 12.5, color: colors.textSecondary, fontFamily: fonts.med, marginTop: 3, marginBottom: 14 },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 16, fontFamily: fonts.med },
  stopCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, marginBottom: 10, gap: 4, ...shadow.soft },
  orderNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  orderNumText: { color: '#fff', fontFamily: fonts.extra, fontSize: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  riderName: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink, flexShrink: 1 },
  paidTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e6f4ee', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  paidTagText: { fontFamily: fonts.bold, fontSize: 10, color: colors.green },
  stopMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, marginTop: 3 },
  contactRow: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6dbe3', alignItems: 'center', justifyContent: 'center' },
  callBtn: { backgroundColor: colors.green, borderColor: colors.green },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6dbe3', borderRadius: radius.md, paddingVertical: 15, marginTop: 6 },
  shareText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
});
