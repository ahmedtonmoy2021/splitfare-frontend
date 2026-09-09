import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { colors, fonts, radius, shadow } from '../theme';

const PRICE_MIN = 1;
const PRICE_MAX = 50;

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e6f2' }] },
];

export default function PostRide() {
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);
  const timer = useRef<any>(null);

  const [step, setStep] = useState<'search' | 'details' | 'map'>('search');
  const [origin, setOrigin] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [activeField, setActiveField] = useState<'from' | 'to'>('to');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const [date, setDate] = useState(new Date(Date.now() + 3600 * 1000));
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [seats, setSeats] = useState('3');
  const [price, setPrice] = useState('5');
  const [loading, setLoading] = useState(false);

  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [distanceKm, setDistanceKm] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<string | null>(null);

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

  useEffect(() => {
    if (!origin || !destination) return;
    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const json = await res.json();
        const route = json.routes?.[0];
        if (route) {
          setRouteCoords(route.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] })));
          setDistanceKm((route.distance / 1000).toFixed(1));
          const totalMin = Math.round(route.duration / 60);
          const h = Math.floor(totalMin / 60);
          const m = totalMin % 60;
          setDurationMin(h > 0 ? `${h} hr ${m} min` : `${m} min`);
        }
      } catch {
        setRouteCoords([]);
      }
    })();
  }, [origin, destination]);

  useEffect(() => {
    if (step === 'map' && origin && destination) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([origin, destination], {
          edgePadding: { top: 140, right: 60, bottom: 360, left: 60 },
          animated: true,
        });
      }, 400);
    }
  }, [step]);

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
    let o = origin;
    let d = destination;
    if (activeField === 'from') {
      o = coord;
      setOrigin(coord);
      setFromText(item.label);
    } else {
      d = coord;
      setDestination(coord);
      setToText(item.label);
    }
    setSuggestions([]);
    if (o && d)
      setStep('details');
  }

  async function useMyLocation() {
    const loc = await Location.getCurrentPositionAsync({});
    const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setOrigin(coord);
    setFromText('My current location');
    setSuggestions([]);
    if (destination) setStep('details');
  }

  function onMapPress(e: any) {
    const coord = e.nativeEvent.coordinate;
    setDestination(coord);
    setToText(`${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)}`);
  }

  async function recenter() {
    const loc = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion(
      { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      800
    );
  }

  async function postRide() {
    if (!origin || !destination) return toast.show('Please set both pickup and destination', 'error');
    if (!seats || !price) return toast.show('Please enter seats and price', 'error');
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/rides`,
        {
          origin: { coordinates: [origin.longitude, origin.latitude], address: fromText },
          destination: { coordinates: [destination.longitude, destination.latitude], address: toText },
          departureTime: date.toISOString(),
          seatsTotal: Number(seats),
          pricePerSeat: Number(price),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.show('Your ride has been posted!', 'success');
      router.replace('/home');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Could not post ride', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'search') {
    return (
      <View style={[styles.searchScreen, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Set your route</Text>
        </View>

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
              <View style={styles.suggestIconWrap}>
                <Ionicons name="navigate" size={17} color="#010E39" />
              </View>
              <Text style={[styles.suggestText, { fontWeight: '600' }]}>Use my current location</Text>
            </TouchableOpacity>
          )}
          {suggestions.map((s, i) => (
            <TouchableOpacity key={i} style={styles.suggestItem} onPress={() => selectPlace(s)}>
              <View style={styles.suggestIconWrap}>
                <Ionicons name="location-outline" size={18} color="#666" />
              </View>
              <Text style={styles.suggestText} numberOfLines={1}>{s.label}</Text>
            </TouchableOpacity>
          ))}
          {origin && destination && suggestions.length === 0 && (
            <TouchableOpacity style={styles.continueInline} onPress={() => setStep('details')}>
              <Text style={styles.continueInlineText}>Continue with these locations →</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  if (step === 'details') {
    const seatsNum = Number(seats) || 1;
    const priceNum = Number(price) || PRICE_MIN;
    const total = seatsNum * priceNum;
    const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <View style={[styles.d_screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.d_header}>
          <TouchableOpacity style={styles.d_back} onPress={() => setStep('search')} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={18} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.d_title}>Post a ride</Text>
        </View>

        <View style={styles.d_progress}>
          <View style={[styles.d_seg, styles.d_segOn]} />
          <View style={[styles.d_seg, styles.d_segOn]} />
          <View style={styles.d_seg} />
          <Text style={styles.d_step}>2/3</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20, gap: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.d_map} activeOpacity={0.9} onPress={() => setStep('map')}>
            {origin && destination && (
              <MapView
                pointerEvents="none"
                provider={PROVIDER_GOOGLE}
                customMapStyle={mapStyle}
                style={StyleSheet.absoluteFill}
                initialRegion={{
                  latitude: (origin.latitude + destination.latitude) / 2,
                  longitude: (origin.longitude + destination.longitude) / 2,
                  latitudeDelta: Math.abs(origin.latitude - destination.latitude) * 1.8 + 0.05,
                  longitudeDelta: Math.abs(origin.longitude - destination.longitude) * 1.8 + 0.05,
                }}>
                {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeWidth={3} strokeColor={colors.ink} />}
              </MapView>
            )}
            <View style={styles.d_mapHint}>
              <Text style={styles.d_mapHintText}>map · tap to adjust route{distanceKm ? `  ·  ${distanceKm} km` : ''}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.d_card}>
            <View style={styles.d_rtRow}>
              <View style={styles.d_dotBlue} />
              <View style={{ flex: 1 }}>
                <Text style={styles.d_kicker}>FROM</Text>
                <Text style={styles.d_place} numberOfLines={1}>{fromText}</Text>
              </View>
            </View>
            <View style={styles.d_rtDivider} />
            <View style={styles.d_rtRow}>
              <View style={styles.d_dotGreen} />
              <View style={{ flex: 1 }}>
                <Text style={styles.d_kicker}>TO</Text>
                <Text style={styles.d_place} numberOfLines={1}>{toText}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={styles.d_miniCard} onPress={() => setShowDate(true)} activeOpacity={0.85}>
              <Text style={styles.d_kicker}>DATE</Text>
              <Text style={styles.d_miniVal}>{dateStr}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.d_miniCard} onPress={() => setShowTime(true)} activeOpacity={0.85}>
              <Text style={styles.d_kicker}>DEPARTS</Text>
              <Text style={styles.d_miniVal}>{timeStr}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.d_card}>
            <View style={styles.d_seatRow}>
              <Text style={styles.d_cardTitle}>Seats offered</Text>
              <View style={styles.d_stepper}>
                <TouchableOpacity style={styles.d_stepMinus} onPress={() => setSeats(String(Math.max(1, seatsNum - 1)))}>
                  <Ionicons name="remove" size={16} color={colors.ink} />
                </TouchableOpacity>
                <Text style={styles.d_stepVal}>{seatsNum}</Text>
                <TouchableOpacity style={styles.d_stepPlus} onPress={() => setSeats(String(Math.min(8, seatsNum + 1)))}>
                  <Ionicons name="add" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.d_hr} />
            <View style={styles.d_priceRow}>
              <Text style={styles.d_cardTitle}>Price per seat</Text>
              <Text style={styles.d_price}>£{priceNum}</Text>
            </View>
            <Slider
              style={{ marginTop: 4 }}
              minimumValue={PRICE_MIN}
              maximumValue={PRICE_MAX}
              step={1}
              value={priceNum}
              minimumTrackTintColor={colors.green}
              maximumTrackTintColor="#e4e7ed"
              thumbTintColor={colors.green}
              onValueChange={(v) => setPrice(String(Math.round(v)))}
            />
            <View style={styles.d_scaleRow}>
              <Text style={styles.d_scale}>£{PRICE_MIN}</Text>
              <Text style={styles.d_scale}>£{PRICE_MAX}</Text>
            </View>
          </View>

          <View style={styles.d_note}>
            <Text style={styles.d_noteText}>
              With {seatsNum} seat{seatsNum !== 1 ? 's' : ''} at £{priceNum} each, you collect £{total} in total.
            </Text>
          </View>
        </ScrollView>

        {showDate && (
          <DateTimePicker value={date} mode="date" onChange={(e, sel) => {
            setShowDate(false);
            if (sel) { const d = new Date(date); d.setFullYear(sel.getFullYear(), sel.getMonth(), sel.getDate()); setDate(d); }
          }} />
        )}
        {showTime && (
          <DateTimePicker value={date} mode="time" onChange={(e, sel) => {
            setShowTime(false);
            if (sel) { const d = new Date(date); d.setHours(sel.getHours(), sel.getMinutes()); setDate(d); }
          }} />
        )}

        <View style={[styles.d_footer, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={styles.d_backBtn} onPress={() => setStep('search')} activeOpacity={0.85}>
            <Text style={styles.d_backBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.d_next} onPress={() => setStep('map')} activeOpacity={0.9}>
            <Text style={styles.d_nextText}>Review &amp; publish</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: 51.4816, longitude: -3.1791, latitudeDelta: 0.3, longitudeDelta: 0.3 }}
        onPress={onMapPress}
        showsUserLocation
        showsMyLocationButton={false}>
        {origin && (
          <Marker coordinate={origin} title="Pickup" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.pickupPin}><View style={styles.pickupInner} /></View>
          </Marker>
        )}
        {destination && (
          <Marker coordinate={destination} title="Destination" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.destPin}><View style={styles.destInner} /></View>
          </Marker>
        )}
        {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="#010E39" />}
      </MapView>

      <TouchableOpacity style={[styles.summaryBar, { top: insets.top + 8 }]} onPress={() => setStep('search')}>
        <View style={styles.summaryRow}>
          <View style={[styles.dot, { backgroundColor: '#010E39' }]} />
          <Text style={styles.summaryText} numberOfLines={1}>{fromText}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <View style={[styles.dotSquare]} />
          <Text style={styles.summaryText} numberOfLines={1}>{toText}</Text>
        </View>
        <Text style={styles.editText}>Edit</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.recenterBtn, { bottom: insets.bottom + 300 }]} onPress={recenter}>
        <Ionicons name="locate" size={22} color="#010E39" />
      </TouchableOpacity>

      <View style={[styles.card, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />
        {distanceKm && (
          <View style={styles.tripInfo}>
            <Text style={styles.tripText}>🚗 {distanceKm} km</Text>
            <Text style={styles.tripText}>⏱ {durationMin}</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => setStep('details')}>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Departure</Text>
            <Text style={styles.summaryValue}>
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Seats · Price</Text>
            <Text style={styles.summaryValue}>{seats} seats · £{price}/seat  ✎</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={postRide} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Posting...' : 'Post Ride'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e8e8e8' },

  searchScreen: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
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
  summaryField: { backgroundColor: '#f2f2f2', borderRadius: 8, paddingHorizontal: 12, height: 44, justifyContent: 'center', marginBottom: 8 },
  summaryFieldText: { fontSize: 15, color: '#222' },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  summaryLabel: { color: '#888', fontSize: 14 },
  summaryValue: { color: '#010E39', fontSize: 15, fontWeight: '600' },
  gpsText: { fontSize: 18 },
  suggestList: { flex: 1, marginTop: 10 },
  suggestItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestPin: { fontSize: 14, marginRight: 12 },
  suggestIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f2f2f2', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  suggestText: { fontSize: 15, color: '#333', flex: 1 },
  continueInline: { paddingVertical: 16, alignItems: 'center' },
  continueInlineText: { color: '#010E39', fontWeight: '700', fontSize: 15 },

  summaryBar: {
    position: 'absolute', left: 16, right: 16, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    elevation: 5, shadowColor: '#010E39', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 48 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  dotSquare: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#010E39', marginRight: 12 },
  summaryText: { flex: 1, fontSize: 14, color: '#222' },
  summaryDivider: { height: 1, backgroundColor: '#eee', marginVertical: 8, marginLeft: 22 },
  editText: { position: 'absolute', right: 14, top: 16, color: '#010E39', fontWeight: '700', fontSize: 13 },
  recenterBtn: {
    position: 'absolute', right: 16, backgroundColor: '#fff', width: 46, height: 46,
    borderRadius: 23, alignItems: 'center', justifyContent: 'center', elevation: 4,
    shadowColor: '#010E39', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  recenterText: { fontSize: 22, color: '#010E39' },
  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20,
    elevation: 10, shadowColor: '#010E39', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: -3 },
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  pickupPin: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#00000022', elevation: 3 },
  pickupInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22a45d' },
  destPin: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#010E39', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  destInner: { width: 8, height: 8, borderRadius: 2, backgroundColor: '#fff' },
  tripInfo: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#f5f5f5', borderRadius: 10, paddingVertical: 10, marginBottom: 12 },
  tripText: { fontSize: 15, fontWeight: '600', color: '#010E39' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 12 },
  timeText: { fontSize: 15, color: '#010E39', fontWeight: '600' },
  label: { fontWeight: '600', color: '#666', marginBottom: 6, fontSize: 13 },
  row: { flexDirection: 'row', marginBottom: 12 },
  flex1: { flex: 1 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15 },
  button: { backgroundColor: '#010E39', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  d_screen: { flex: 1, backgroundColor: colors.bg },
  d_header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 },
  d_back: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: '#d6dbe3', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  d_title: { fontSize: 19, fontFamily: fonts.extra, color: colors.ink, letterSpacing: -0.3 },
  d_progress: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, marginBottom: 16 },
  d_seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#dcdfe6' },
  d_segOn: { backgroundColor: colors.green },
  d_step: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, marginLeft: 6 },
  d_map: { height: 92, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#dfe3ea', backgroundColor: '#eef2f7', alignItems: 'center', justifyContent: 'center' },
  d_mapHint: { position: 'absolute', bottom: 8, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  d_mapHintText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.textMuted },
  d_card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 16, ...shadow.card },
  d_rtRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  d_dotBlue: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blue },
  d_dotGreen: { width: 9, height: 9, borderRadius: 2, backgroundColor: colors.green },
  d_rtDivider: { height: 1, backgroundColor: colors.borderSoft, marginLeft: 21, marginVertical: 12 },
  d_kicker: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, color: colors.textMuted },
  d_place: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginTop: 3 },
  d_miniCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  d_miniVal: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginTop: 5 },
  d_cardTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  d_seatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  d_stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  d_stepMinus: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#eef1f6', alignItems: 'center', justifyContent: 'center' },
  d_stepPlus: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  d_stepVal: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.ink, minWidth: 18, textAlign: 'center' },
  d_hr: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 13 },
  d_priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  d_price: { fontFamily: fonts.extra, fontSize: 20, color: colors.green },
  d_scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  d_scale: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted },
  d_note: { backgroundColor: '#e6f4ee', borderWidth: 1, borderColor: '#b6ded0', borderRadius: radius.md, padding: 13 },
  d_noteText: { fontFamily: fonts.med, fontSize: 12, lineHeight: 17, color: '#0d6b4c' },
  d_footer: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 22, paddingTop: 14 },
  d_backBtn: { borderWidth: 1, borderColor: '#cfd6e0', borderRadius: radius.md, paddingVertical: 16, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  d_backBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  d_next: { flex: 1, backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  d_nextText: { fontFamily: fonts.extra, fontSize: 15, color: '#fff' },
});
