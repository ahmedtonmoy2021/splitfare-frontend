import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Avatar from '../components/Avatar';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import RouteRows from '../components/RouteRows';

export default function Search() {
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const timer = useRef<any>(null);

  const [step, setStep] = useState<'search' | 'results'>('search');
  const [origin, setOrigin] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [activeField, setActiveField] = useState<'from' | 'to'>('to');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [seatSel, setSeatSel] = useState<{ [id: string]: number }>({});
  const [bookingStatus, setBookingStatus] = useState<{ [rideId: string]: string }>({});

  function getSeats(ride: any) {
    return seatSel[ride._id] || 1;
  }
  function changeSeats(ride: any, delta: number) {
    const current = getSeats(ride);
    const next = Math.min(Math.max(1, current + delta), ride.seatsAvailable);
    setSeatSel((prev) => ({ ...prev, [ride._id]: next }));
  }

  function statusStyle(status: string): any {
    switch (status) {
      case 'accepted':
      case 'paid':
        return { pill: { backgroundColor: '#e6f6ec' }, fg: '#1a7f3c', icon: 'checkmark-circle', label: status === 'paid' ? 'Paid' : 'Accepted' };
      case 'rejected':
        return { pill: { backgroundColor: '#fdecea' }, fg: '#c0392b', icon: 'close-circle', label: 'Rejected' };
      default: return { pill: { backgroundColor: '#fff4e5' }, fg: '#a35b00', icon: 'time', label: 'Requested' };
    }
  }

  const biasRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.granted) {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          biasRef.current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        } catch {}
      }
    })();
  }, []);

  function onSearchChange(text: string, field: 'from' | 'to') {
    if (field === 'from') setFromText(text);
    else setToText(text);
    setActiveField(field);
    if (timer.current) clearTimeout(timer.current);
    if (text.length < 3) return setSuggestions([]);
    timer.current = setTimeout(async () => {
      try {
        const bias = field === 'to' && origin ? `&lat=${origin.latitude}&lon=${origin.longitude}` : '';
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=8&lang=en&bbox=-8.65,49.8,1.77,60.9${bias}`
        );
        const json = await res.json();
        setSuggestions(
          json.features.map((f: any) => ({
            label: [f.properties.name, f.properties.city, f.properties.country].filter(Boolean).join(', '),
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
          }))
        );
      } catch {
        setSuggestions([]);
      }
    }, 400);
  }

  function selectPlace(item: any) {
    const coord = { latitude: item.lat, longitude: item.lon };
    let o = origin, d = destination;
    if (activeField === 'from') { o = coord; setOrigin(coord); setFromText(item.label); }
    else { d = coord; setDestination(coord); setToText(item.label); }
    setSuggestions([]);
    if (o && d) searchRides(o, d);
  }

  async function useMyLocation() {
    const loc = await Location.getCurrentPositionAsync({});
    const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setOrigin(coord);
    setFromText('My current location');
    setSuggestions([]);
    if (destination) searchRides(coord, destination);
  }

  async function searchRides(o: any, d: any) {
    setLoading(true);
    setStep('results');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [res, myBookings] = await Promise.all([
        axios.get(`${API_URL}/api/rides/search`, {
          params: { originLng: o.longitude, originLat: o.latitude, destLng: d.longitude, destLat: d.latitude },
          headers,
        }),
        axios.get(`${API_URL}/api/bookings/my`, { headers }),
      ]);
      setRides(res.data);
      const map: { [k: string]: string } = {};
      myBookings.data.forEach((b: any) => {
        const rid = b.ride?._id || b.ride;
        if (rid) map[rid] = b.status;
      });
      setBookingStatus(map);
    } catch (err: any) {
      toast.show('Could not search rides', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function requestBooking(ride: any) {
    try {
      await axios.post(
        `${API_URL}/api/bookings`,
        {
          rideId: ride._id,
          seats: getSeats(ride),
          pickup: origin ? { lng: origin.longitude, lat: origin.latitude, address: fromText } : undefined,
          dropoff: destination ? { lng: destination.longitude, lat: destination.latitude, address: toText } : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBookingStatus((prev) => ({ ...prev, [ride._id]: 'pending' }));
      toast.show(`Request sent — ${getSeats(ride)} seat(s). The driver will confirm.`, 'success');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Could not send request', 'error');
    }
  }

  if (step === 'search') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
        <ScreenHeader title="Find a Ride" />

        <View style={styles.searchInner}>
          <View style={styles.connectorCol}>
            <View style={styles.originDot} />
            <View style={styles.connectorLine} />
            <View style={styles.destSquare} />
          </View>
          <View style={styles.inputsCol}>
            <View style={[styles.inputField, activeField === 'from' && styles.inputFieldActive]}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Pickup location"
                placeholderTextColor="#999"
                value={fromText}
                onFocus={() => setActiveField('from')}
                onChangeText={(t) => onSearchChange(t, 'from')}
              />
              <TouchableOpacity onPress={useMyLocation}>
                <Ionicons name="locate" size={20} color="#010E39" />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputField, activeField === 'to' && styles.inputFieldActive]}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Where to?"
                placeholderTextColor="#999"
                value={toText}
                autoFocus
                onFocus={() => setActiveField('to')}
                onChangeText={(t) => onSearchChange(t, 'to')}
              />
            </View>
          </View>
        </View>

        <ScrollView style={styles.suggestList} keyboardShouldPersistTaps="handled">
          {activeField === 'from' && (
            <TouchableOpacity style={styles.suggestItem} onPress={useMyLocation}>
              <View style={styles.suggestIconWrap}><Ionicons name="navigate" size={17} color="#010E39" /></View>
              <Text style={[styles.suggestText, { fontWeight: '600' }]}>Use my current location</Text>
            </TouchableOpacity>
          )}
          {suggestions.map((s, i) => (
            <TouchableOpacity key={i} style={styles.suggestItem} onPress={() => selectPlace(s)}>
              <View style={styles.suggestIconWrap}><Ionicons name="location-outline" size={18} color="#666" /></View>
              <Text style={styles.suggestText} numberOfLines={1}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <ScreenHeader title="Available rides" onBack={() => setStep('search')} />

      <View style={styles.routeChip}>
        <Text style={styles.routeChipText} numberOfLines={1}>{fromText}  →  {toText}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#010E39" style={{ marginTop: 40 }} />
      ) : rides.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="car-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No rides found on this route yet.</Text>
          <Text style={styles.emptySub}>Try again later or adjust your locations.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, marginTop: 12 }}>
          {rides.map((ride) => (
            <Card key={ride._id}>
              <View style={styles.rideTop}>
                <Avatar user={ride.driver} size={42} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.driverName}>{ride.driver?.name || 'Driver'}</Text>
                  <Text style={styles.rideMeta}>
                    {new Date(ride.departureTime).toLocaleDateString()} · {new Date(ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.price}>£{ride.pricePerSeat}</Text>
              </View>

              <RouteRows from={ride.origin?.address} to={ride.destination?.address} />

              <View style={styles.rideBottom}>
                {bookingStatus[ride._id] ? (
                  <>
                    <Text style={styles.seatsText}>{ride.seatsAvailable} seat{ride.seatsAvailable !== 1 ? 's' : ''} left</Text>
                    <View style={[styles.statusPill, statusStyle(bookingStatus[ride._id]).pill]}>
                      <Ionicons name={statusStyle(bookingStatus[ride._id]).icon} size={15} color={statusStyle(bookingStatus[ride._id]).fg} />
                      <Text style={[styles.statusPillText, { color: statusStyle(bookingStatus[ride._id]).fg }]}>
                        {statusStyle(bookingStatus[ride._id]).label}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View>
                      <Text style={styles.seatsText}>{ride.seatsAvailable} seat{ride.seatsAvailable !== 1 ? 's' : ''} left</Text>
                      <View style={styles.stepper}>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => changeSeats(ride, -1)}>
                          <Ionicons name="remove" size={16} color="#010E39" />
                        </TouchableOpacity>
                        <Text style={styles.stepValue}>{getSeats(ride)}</Text>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => changeSeats(ride, 1)}>
                          <Ionicons name="add" size={16} color="#010E39" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.requestBtn} onPress={() => requestBooking(ride)}>
                      <Text style={styles.requestText}>Request · £{ride.pricePerSeat * getSeats(ride)}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backChevron: { fontSize: 32, color: '#010E39', marginRight: 12, marginTop: -4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#010E39' },
  searchInner: { flexDirection: 'row', alignItems: 'center' },
  connectorCol: { width: 16, alignItems: 'center', marginRight: 10, height: 96, justifyContent: 'center' },
  originDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#010E39' },
  connectorLine: { width: 2, flex: 1, backgroundColor: '#ccc', marginVertical: 4 },
  destSquare: { width: 11, height: 11, borderRadius: 2, backgroundColor: '#010E39' },
  inputsCol: { flex: 1 },
  inputField: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, height: 44, marginBottom: 8, borderWidth: 1.5, borderColor: 'transparent' },
  inputFieldActive: { borderColor: '#010E39' },
  fieldInput: { flex: 1, fontSize: 15, color: '#222', paddingVertical: 0 },
  suggestList: { flex: 1, marginTop: 10 },
  suggestItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f2f2f2', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  suggestText: { fontSize: 15, color: '#333', flex: 1 },
  routeChip: { backgroundColor: '#f2f2f2', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  routeChipText: { fontSize: 14, color: '#333', fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { fontSize: 16, color: '#555', marginTop: 12, fontWeight: '600' },
  emptySub: { fontSize: 14, color: '#999', marginTop: 4 },
  rideCard: { borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 16, padding: 16, marginBottom: 14, backgroundColor: '#fff' },
  rideTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#010E39', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  driverName: { fontSize: 16, fontWeight: '700', color: '#010E39' },
  rideMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  price: { fontSize: 20, fontWeight: '700', color: '#010E39' },
  rideRoute: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  rideAddr: { fontSize: 14, color: '#444', marginLeft: 10, flex: 1 },
  rideBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  seatsText: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 16, fontWeight: '700', color: '#010E39', minWidth: 18, textAlign: 'center' },
  requestBtn: { backgroundColor: '#010E39', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  statusPillText: { fontSize: 14, fontWeight: '700' },
  requestText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
