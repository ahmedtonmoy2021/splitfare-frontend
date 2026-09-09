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
import { colors, fonts, radius, shadow } from '../theme';

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

        {origin && destination && (
          <TouchableOpacity style={[styles.findBtn, { marginBottom: insets.bottom + 16 }]} onPress={() => searchRides(origin, destination)} activeOpacity={0.9}>
            <Text style={styles.findBtnText}>Find rides</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const sorted = [...rides].sort((a, b) => a.pricePerSeat - b.pricePerSeat);

  return (
    <View style={styles.r_screen}>
      <View style={[styles.r_header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.r_back} onPress={() => setStep('search')} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.r_route} numberOfLines={1}>{fromText}  →  {toText}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.ink} style={{ marginTop: 40 }} />
      ) : sorted.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="car-outline" size={48} color="#c3cbd8" />
          <Text style={styles.emptyText}>No rides found on this route yet.</Text>
          <Text style={styles.emptySub}>Try again later or adjust your locations.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.r_count}>{sorted.length} RIDE{sorted.length !== 1 ? 'S' : ''}  ·  CHEAPEST FIRST</Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20, gap: 12 }} showsVerticalScrollIndicator={false}>
            {sorted.map((ride, idx) => {
              const booked = bookingStatus[ride._id];
              const top = idx === 0;
              const st = booked ? statusStyle(booked) : null;
              return (
                <View key={ride._id} style={[styles.r_card, top && styles.r_cardTop]}>
                  <View style={styles.r_topRow}>
                    <View>
                      <Text style={styles.r_time}>{new Date(ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      <Text style={styles.r_date}>{new Date(ride.departureTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.r_price}>£{ride.pricePerSeat}</Text>
                      <Text style={styles.r_perseat}>per seat</Text>
                    </View>
                  </View>

                  <View style={styles.r_driverRow}>
                    <Avatar user={ride.driver} size={34} />
                    <View style={{ flex: 1, marginLeft: 11 }}>
                      <Text style={styles.r_driver} numberOfLines={1}>{ride.driver?.name || 'Driver'}</Text>
                      <Text style={styles.r_seats}>★ {ride.seatsAvailable} seat{ride.seatsAvailable !== 1 ? 's' : ''} left</Text>
                    </View>
                    {booked && st ? (
                      <View style={[styles.statusPill, st.pill]}>
                        <Ionicons name={st.icon} size={14} color={st.fg} />
                        <Text style={[styles.statusPillText, { color: st.fg }]}>{st.label}</Text>
                      </View>
                    ) : null}
                  </View>

                  {!booked && (
                    <View style={styles.r_action}>
                      <View style={styles.r_stepper}>
                        <TouchableOpacity style={styles.r_stepBtn} onPress={() => changeSeats(ride, -1)}>
                          <Ionicons name="remove" size={15} color={colors.ink} />
                        </TouchableOpacity>
                        <Text style={styles.r_stepVal}>{getSeats(ride)}</Text>
                        <TouchableOpacity style={styles.r_stepBtn} onPress={() => changeSeats(ride, 1)}>
                          <Ionicons name="add" size={15} color={colors.ink} />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={[styles.r_req, top ? styles.r_reqOn : styles.r_reqOff]} onPress={() => requestBooking(ride)} activeOpacity={0.9}>
                        <Text style={[styles.r_reqText, top ? { color: '#fff' } : { color: colors.ink }]}>Request · £{ride.pricePerSeat * getSeats(ride)}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      <View style={[styles.r_footer, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.r_footText}>Nothing fits?</Text>
        <TouchableOpacity style={styles.r_postBtn} onPress={() => router.push('/post-ride')} activeOpacity={0.9}>
          <Text style={styles.r_postText}>Post your own ride</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backChevron: { fontSize: 32, color: '#010E39', marginRight: 12, marginTop: -4 },
  headerTitle: { fontSize: 20, fontFamily: fonts.extra, color: colors.ink },
  searchInner: { flexDirection: 'row', alignItems: 'center' },
  connectorCol: { width: 16, alignItems: 'center', marginRight: 10, height: 96, justifyContent: 'center' },
  originDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#010E39' },
  connectorLine: { width: 2, flex: 1, backgroundColor: '#ccc', marginVertical: 4 },
  destSquare: { width: 11, height: 11, borderRadius: 2, backgroundColor: '#010E39' },
  inputsCol: { flex: 1 },
  inputField: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, height: 44, marginBottom: 8, borderWidth: 1.5, borderColor: 'transparent' },
  inputFieldActive: { borderColor: '#010E39' },
  fieldInput: { flex: 1, fontSize: 15, fontFamily: fonts.semi, color: colors.ink, paddingVertical: 0 },
  suggestList: { flex: 1, marginTop: 10 },
  suggestItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f2f2f2', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  suggestText: { fontSize: 15, color: colors.ink, fontFamily: fonts.med, flex: 1 },
  findBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 16, marginTop: 8 },
  findBtnText: { color: '#fff', fontSize: 15, fontFamily: fonts.extra },
  routeChip: { backgroundColor: '#f2f2f2', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  routeChipText: { fontSize: 14, color: colors.ink, fontFamily: fonts.semi },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { fontSize: 16, color: colors.ink, marginTop: 12, fontFamily: fonts.bold },
  emptySub: { fontSize: 14, color: colors.textMuted, marginTop: 4, fontFamily: fonts.med },
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

  r_screen: { flex: 1, backgroundColor: colors.bg },
  r_header: { backgroundColor: colors.ink, paddingHorizontal: 22, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  r_back: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  r_route: { flex: 1, fontFamily: fonts.extra, fontSize: 18, color: '#fff', letterSpacing: -0.3 },
  r_count: { fontFamily: fonts.mono, fontSize: 11.5, letterSpacing: 0.5, color: colors.textMuted, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 4 },
  r_card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 14, ...shadow.soft },
  r_cardTop: { borderWidth: 1.5, borderColor: colors.green, shadowColor: colors.green, shadowOpacity: 0.1 },
  r_topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  r_time: { fontFamily: fonts.extra, fontSize: 20, color: colors.ink, letterSpacing: -0.4 },
  r_date: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  r_price: { fontFamily: fonts.extra, fontSize: 20, color: colors.green },
  r_perseat: { fontFamily: fonts.med, fontSize: 11.5, color: colors.textMuted, marginTop: 3 },
  r_driverRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  r_driver: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  r_seats: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  r_action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  r_stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  r_stepBtn: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#eef1f6', alignItems: 'center', justifyContent: 'center' },
  r_stepVal: { fontFamily: fonts.monoBold, fontSize: 15, color: colors.ink, minWidth: 16, textAlign: 'center' },
  r_req: { borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 16 },
  r_reqOn: { backgroundColor: colors.green },
  r_reqOff: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cfd6e0' },
  r_reqText: { fontFamily: fonts.extra, fontSize: 12.5 },
  r_footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 22, paddingTop: 14 },
  r_footText: { fontFamily: fonts.semi, fontSize: 12, color: '#6b7a90' },
  r_postBtn: { backgroundColor: '#e8f0fc', borderWidth: 1, borderColor: '#b8d0f4', borderRadius: radius.sm, paddingVertical: 11, paddingHorizontal: 16 },
  r_postText: { fontFamily: fonts.bold, fontSize: 13, color: '#1f66cd' },
});
