import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Avatar from '../components/Avatar';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';

export default function Profile() {
  const { token, user, mode, setMode, updateUser } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDriver = mode === 'driver';

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [gender, setGender] = useState<string | undefined>(user?.gender);
  const [genderOpen, setGenderOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar);
  const [loading, setLoading] = useState(false);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.show('Please allow photo access', 'error');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setAvatar(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  }

  async function save() {
    if (!phone.trim()) return toast.show('Please enter your phone number', 'error');
    setLoading(true);
    try {
      const res = await axios.patch(
        `${API_URL}/api/auth/profile`,
        { name, phone, gender, avatar },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await updateUser(res.data.user);
      toast.show('Profile updated', 'success');
      router.back();
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Could not save', 'error');
    } finally {
      setLoading(false);
    }
  }

  const previewUser = { avatar, gender, name };

  return (
    <ScrollView style={[styles.screen, { paddingTop: insets.top + 10 }]} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Profile" />

      <View style={styles.avatarWrap}>
        <Avatar user={previewUser} size={92} />
        <TouchableOpacity style={styles.cameraBtn} onPress={pickPhoto}>
          <Ionicons name="camera" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      <Text style={styles.email}>{user?.email}</Text>

      <Text style={styles.label}>Mode</Text>
      <View style={styles.modeToggle}>
        <TouchableOpacity style={[styles.modeBtn, !isDriver && styles.modeActive]} onPress={() => setMode('rider')}>
          <Ionicons name="person-outline" size={17} color={!isDriver ? '#fff' : '#666'} />
          <Text style={!isDriver ? styles.modeTextActive : styles.modeText}>Rider</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeBtn, isDriver && styles.modeActive]} onPress={() => setMode('driver')}>
          <Ionicons name="car-sport-outline" size={18} color={isDriver ? '#fff' : '#666'} />
          <Text style={isDriver ? styles.modeTextActive : styles.modeText}>Driver</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Rider mode lets you find and book rides. Driver mode lets you post rides and manage requests.</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" />

      <Text style={styles.label}>Gender</Text>
      <TouchableOpacity style={styles.dropdown} onPress={() => setGenderOpen(!genderOpen)}>
        <View style={styles.ddLeft}>
          <Ionicons name={gender === 'female' ? 'woman' : gender === 'male' ? 'man' : 'person-outline'} size={18} color="#010E39" />
          <Text style={[styles.ddText, !gender && { color: '#999' }]}>
            {gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : 'Select gender'}
          </Text>
        </View>
        <Ionicons name={genderOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
      </TouchableOpacity>
      {genderOpen && (
        <View style={styles.ddMenu}>
          <TouchableOpacity style={styles.ddItem} onPress={() => { setGender('male'); setGenderOpen(false); }}>
            <Ionicons name="man" size={18} color="#010E39" />
            <Text style={styles.ddItemText}>Male</Text>
            {gender === 'male' && <Ionicons name="checkmark" size={18} color="#010E39" style={{ marginLeft: 'auto' }} />}
          </TouchableOpacity>
          <View style={styles.ddDivider} />
          <TouchableOpacity style={styles.ddItem} onPress={() => { setGender('female'); setGenderOpen(false); }}>
            <Ionicons name="woman" size={18} color="#010E39" />
            <Text style={styles.ddItemText}>Female</Text>
            {gender === 'female' && <Ionicons name="checkmark" size={18} color="#010E39" style={{ marginLeft: 'auto' }} />}
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.label}>Phone number</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="e.g. 07123456789"
        keyboardType="phone-pad"
      />
      <Text style={styles.hint}>Your phone is needed to post or book rides. It is only shared after a booking is accepted.</Text>

      <PrimaryButton title="Save" onPress={save} loading={loading} style={{ marginTop: 24 }} />
      <View style={{ height: insets.bottom + 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EAF2FB', paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backChevron: { fontSize: 32, color: '#010E39', marginRight: 12, marginTop: -4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#010E39' },
  avatarWrap: { alignSelf: 'center', marginTop: 10 },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#010E39', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  email: { textAlign: 'center', color: '#888', marginTop: 12, marginBottom: 20, fontSize: 15 },
  label: { fontWeight: '600', color: '#666', marginBottom: 6, fontSize: 13, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15 },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14 },
  ddLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ddText: { fontSize: 15, fontWeight: '600', color: '#010E39' },
  ddMenu: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginTop: 6, backgroundColor: '#fff', overflow: 'hidden' },
  ddItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  ddItemText: { fontSize: 15, fontWeight: '600', color: '#010E39' },
  ddDivider: { height: 1, backgroundColor: '#f0f0f0' },
  hint: { color: '#999', fontSize: 12, marginTop: 8 },
  modeToggle: { flexDirection: 'row', backgroundColor: '#f2f2f2', borderRadius: 12, padding: 4 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  modeActive: { backgroundColor: '#010E39' },
  modeText: { fontSize: 15, fontWeight: '700', color: '#666' },
  modeTextActive: { fontSize: 15, fontWeight: '700', color: '#fff' },
  button: { backgroundColor: '#010E39', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
