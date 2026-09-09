import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Avatar from '../components/Avatar';
import { colors, fonts, radius, shadow } from '../theme';

export default function Profile() {
  const { token, user, mode, setMode, updateUser, logout } = useAuth();
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
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.glow} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30, paddingHorizontal: 22 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={18} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.head}>
          <View>
            <Avatar user={previewUser} size={66} />
            <TouchableOpacity style={styles.camera} onPress={pickPhoto} activeOpacity={0.85}>
              <Ionicons name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.name} numberOfLines={1}>{name || 'Your name'}</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.toggle}>
          <TouchableOpacity style={[styles.toggleBtn, !isDriver && styles.toggleOn]} onPress={() => setMode('rider')} activeOpacity={0.9}>
            <Ionicons name="person-outline" size={16} color={!isDriver ? '#fff' : colors.textSecondary} />
            <Text style={!isDriver ? styles.toggleTextOn : styles.toggleText}>Rider</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, isDriver && styles.toggleOn]} onPress={() => setMode('driver')} activeOpacity={0.9}>
            <Ionicons name="car-sport-outline" size={17} color={isDriver ? '#fff' : colors.textSecondary} />
            <Text style={isDriver ? styles.toggleTextOn : styles.toggleText}>Driver</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>ACCOUNT</Text>
        <View style={styles.card}>
          <View style={styles.rowStatic}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{user?.email}</Text>
            </View>
            <View style={styles.verified}><Text style={styles.verifiedText}>VERIFIED</Text></View>
          </View>
          <View style={styles.divider} />
          <View style={styles.rowField}>
            <Text style={styles.rowLabel}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#aab4c2" />
          </View>
          <View style={styles.divider} />
          <View style={styles.rowField}>
            <Text style={styles.rowLabel}>Phone number</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="e.g. 07123456789" placeholderTextColor="#aab4c2" keyboardType="phone-pad" />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.rowStatic} onPress={() => setGenderOpen(!genderOpen)} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Gender</Text>
              <Text style={[styles.rowValue, !gender && { color: '#aab4c2' }]}>
                {gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : 'Select gender'}
              </Text>
            </View>
            <Ionicons name={genderOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#b3bdca" />
          </TouchableOpacity>
          {genderOpen && (
            <View style={styles.ddMenu}>
              <TouchableOpacity style={styles.ddItem} onPress={() => { setGender('male'); setGenderOpen(false); }}>
                <Ionicons name="man" size={18} color={colors.ink} />
                <Text style={styles.ddItemText}>Male</Text>
                {gender === 'male' && <Ionicons name="checkmark" size={18} color={colors.green} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.ddItem} onPress={() => { setGender('female'); setGenderOpen(false); }}>
                <Ionicons name="woman" size={18} color={colors.ink} />
                <Text style={styles.ddItemText}>Female</Text>
                {gender === 'female' && <Ionicons name="checkmark" size={18} color={colors.green} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={styles.hint}>Your phone is only shared after a booking is accepted.</Text>

        <TouchableOpacity style={styles.save} onPress={save} disabled={loading} activeOpacity={0.9}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save changes</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logout} onPress={async () => { await logout(); router.replace('/'); }} activeOpacity={0.9}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: -120, left: -100, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(43,196,138,0.12)' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 },
  back: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: '#d6dbe3', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontFamily: fonts.extra, color: colors.ink, letterSpacing: -0.3 },
  head: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  camera: { position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.ink, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  name: { fontSize: 21, fontFamily: fonts.extra, color: colors.ink, letterSpacing: -0.3 },
  email: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textMuted, marginTop: 4 },
  toggle: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: '#dcdad4', borderRadius: radius.md, padding: 4, marginTop: 22 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: radius.sm },
  toggleOn: { backgroundColor: colors.ink },
  toggleText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  toggleTextOn: { fontSize: 14, fontFamily: fonts.bold, color: '#fff' },
  section: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, color: colors.textMuted, marginTop: 22, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', ...shadow.soft },
  rowStatic: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowField: { paddingHorizontal: 16, paddingVertical: 12 },
  rowLabel: { fontFamily: fonts.med, fontSize: 11, color: colors.textMuted },
  rowValue: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, marginTop: 3 },
  input: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, padding: 0, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.borderSoft },
  verified: { backgroundColor: '#e6f4ee', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  verifiedText: { fontFamily: fonts.mono, fontSize: 10, color: '#0d6b4c' },
  ddMenu: { backgroundColor: '#fbfbfa' },
  ddItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  ddItemText: { fontSize: 14, fontFamily: fonts.semi, color: colors.ink },
  hint: { fontFamily: fonts.med, fontSize: 12, color: colors.textMuted, marginTop: 10, marginHorizontal: 4 },
  save: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: fonts.extra },
  logout: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0b8b8', borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  logoutText: { color: '#b03434', fontSize: 14, fontFamily: fonts.bold },
});
