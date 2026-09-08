import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useRootNavigationState } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const NAVY = '#010E39';
const BLUE = '#2E90FA';
const GREEN = '#3DDC84';

export default function Login() {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const { token, login } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navState = useRootNavigationState();

  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(60)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(cardTranslate, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    if (!navState?.key) return;
    if (token) router.replace('/home');
  }, [token, navState?.key]);

  async function sendOtp() {
    if (!email) return toast.show('Please enter your email', 'error');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/request-otp`, { email });
      setStep('otp');
      toast.show('Code sent to your email', 'success');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otp) return toast.show('Please enter the code', 'error');
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/verify-otp`, { email, otp });
      await login(res.data.token, res.data.user);
      router.replace('/home');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Wrong code', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>

      <View style={[styles.hero, { paddingTop: insets.top + 50 }]}>
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }], alignItems: 'center' }}>
          <View style={styles.logoGlow}>
            <Image source={require('../../assets/images/icon.png')} style={styles.logo} resizeMode="cover" />
          </View>
        </Animated.View>
        <Animated.Text style={[styles.tagline, { opacity: textOpacity }]}>
          Share the ride, <Text style={{ color: GREEN }}>split the fare</Text>
        </Animated.Text>
      </View>

      <Animated.View
        style={[styles.card, { paddingBottom: insets.bottom + 24, opacity: cardOpacity, transform: [{ translateY: cardTranslate }] }]}>
        {step === 'email' ? (
          <>
            <Text style={styles.cardTitle}>Welcome</Text>
            <Text style={styles.cardSub}>Enter your email to continue</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={20} color="#8a8f9c" />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#9aa0ad"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={sendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.buttonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.terms}>We'll email you a 6-digit code to sign in.</Text>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>Enter the code</Text>
            <Text style={styles.cardSub}>Sent to {email}</Text>
            <View style={styles.inputRow}>
              <Ionicons name="keypad-outline" size={20} color="#8a8f9c" />
              <TextInput
                style={styles.input}
                placeholder="123456"
                placeholderTextColor="#9aa0ad"
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={verifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('email')}>
              <Text style={styles.link}>‹ Change email</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logoGlow: { borderRadius: 28 },
  logo: { width: 150, height: 150, borderRadius: 28 },
  tagline: { fontSize: 17, color: '#ffffff', marginTop: 24, fontWeight: '600' },
  card: {
    backgroundColor: '#EAF2FB', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 26, paddingTop: 30,
  },
  cardTitle: { fontSize: 24, fontWeight: '800', color: NAVY },
  cardSub: { fontSize: 14, color: '#7c8a95', marginTop: 4, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, height: 56, marginTop: 16, borderWidth: 1, borderColor: '#d8e4f5' },
  input: { flex: 1, fontSize: 16, color: '#111' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: NAVY, borderRadius: 14, height: 56, marginTop: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  terms: { fontSize: 12, color: '#9aa0ad', textAlign: 'center', marginTop: 16 },
  link: { color: NAVY, textAlign: 'center', marginTop: 16, fontWeight: '600', fontSize: 15 },
});
