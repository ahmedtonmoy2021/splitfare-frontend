import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, ScrollView, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useRootNavigationState } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const NAVY = '#081729';
const SHEET = '#f7f6f2';
const DARK = '#0b1f3a';
const BLUE = '#2e7be8';
const GREEN = '#2bc48a';
const GREEN_BTN = '#12996b';
const F = {
  reg: 'Manrope_400Regular',
  med: 'Manrope_500Medium',
  semi: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extra: 'Manrope_800ExtraBold',
  mono: 'IBMPlexMono_600SemiBold',
  monoBold: 'IBMPlexMono_700Bold',
};
const OTP_LEN = 6;

export default function Login() {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);

  const { token, login } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navState = useRootNavigationState();
  const otpRef = useRef<TextInput>(null);

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(40)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(sheetTranslate, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.timing(sheetOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    if (!navState?.key) return;
    if (token) router.replace('/home');
  }, [token, navState?.key]);

  useEffect(() => {
    if (step !== 'otp') return;
    setSecondsLeft(300);
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [step]);

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

  async function sendOtp() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return toast.show('Please enter your email', 'error');
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return toast.show('Please enter a valid email address', 'error');
    setEmail(cleanEmail);
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/request-otp`, { email: cleanEmail });
      setOtp('');
      setStep('otp');
      toast.show('Code sent to your email', 'success');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length < OTP_LEN) return toast.show('Please enter the 6-digit code', 'error');
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/verify-otp`, { email: email.trim().toLowerCase(), otp });
      await login(res.data.token, res.data.user);
      router.replace('/home');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Wrong code', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ---------- OTP step (2c) ----------
  if (step === 'otp') {
    return (
      <View style={styles.otpScreen}>
        <View pointerEvents="none" style={styles.glowGreen} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 26, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.backBtn} onPress={() => { setStep('email'); setOtp(''); }} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={18} color={DARK} />
            </TouchableOpacity>

            <Text style={styles.otpTitle}>Enter the code</Text>
            <Text style={styles.otpSub}>
              Sent to <Text style={styles.otpEmail}>{email}</Text> · expires in {mmss}
            </Text>

            <Pressable style={styles.otpRow} onPress={() => otpRef.current?.focus()}>
              {Array.from({ length: OTP_LEN }).map((_, i) => {
                const filled = i < otp.length;
                const focused = i === otp.length;
                return (
                  <View key={i} style={[styles.otpBox, filled && styles.otpBoxFilled, focused && styles.otpBoxFocused, !filled && !focused && styles.otpBoxEmpty]}>
                    {filled ? <Text style={styles.otpDigit}>{otp[i]}</Text> : focused ? <View style={styles.caret} /> : null}
                  </View>
                );
              })}
              <TextInput
                ref={otpRef}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, OTP_LEN))}
                keyboardType="number-pad"
                maxLength={OTP_LEN}
                caretHidden
                autoFocus
                style={styles.hiddenInput}
              />
            </Pressable>

            <View style={styles.resendRow}>
              <Text style={styles.resendMuted}>Didn't get it?</Text>
              <TouchableOpacity onPress={sendOtp} disabled={loading}>
                <Text style={styles.resendLink}>Resend code</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnShadow, { marginTop: 24 }]} onPress={verifyOtp} disabled={loading} activeOpacity={0.9}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify &amp; continue</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ---------- Email step (2b) ----------
  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.glow} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[styles.hero, { paddingTop: insets.top + 28, opacity: heroOpacity }]}>
          <Image source={require('../../assets/images/logo-icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.headline}>
            Going the{'\n'}same way?{'\n'}
            <Text style={{ color: GREEN }}>Split it.</Text>
          </Text>
          <Text style={styles.subhead}>
            Drivers post the trips they're already making. You pay a share, not a fare.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 24, opacity: sheetOpacity, transform: [{ translateY: sheetTranslate }] }]}>
          <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Sign in with your email</Text>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>YOUR EMAIL</Text>
              <TextInput
                style={styles.input}
                placeholder="name@email.com"
                placeholderTextColor="#aab4c2"
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="go"
                onSubmitEditing={sendOtp}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={sendOtp} disabled={loading} activeOpacity={0.9}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Email me a code  →</Text>}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>or</Text>
              <View style={styles.divLine} />
            </View>

            <TouchableOpacity style={styles.googleBtn} activeOpacity={0.9} onPress={() => toast.show('Google sign-in is coming soon', 'info')}>
              <Ionicons name="logo-google" size={18} color={DARK} />
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            <Text style={styles.footNote}>No password. The code expires in 5 minutes.</Text>
          </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  glow: { position: 'absolute', top: -90, right: -120, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(46,123,232,0.18)' },
  hero: { flex: 1, paddingHorizontal: 26, paddingBottom: 36, justifyContent: 'flex-end' },
  logo: { width: 56, height: 56 },
  headline: { color: '#fff', fontSize: 40, lineHeight: 42, fontFamily: F.extra, letterSpacing: -1.2, marginTop: 32 },
  subhead: { color: 'rgba(255,255,255,0.55)', fontSize: 14.5, lineHeight: 22, fontFamily: F.med, marginTop: 14, maxWidth: 290 },
  sheet: { marginTop: 'auto', backgroundColor: SHEET, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 26, paddingTop: 18 },
  grabber: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#d6dbe3', alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontFamily: F.extra, color: DARK, letterSpacing: -0.4 },
  inputCard: { borderWidth: 1.5, borderColor: '#cfd6e0', borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, marginTop: 16 },
  inputLabel: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: 1.4, color: '#8b9ab0' },
  input: { fontSize: 16, fontFamily: F.semi, color: DARK, paddingVertical: Platform.OS === 'ios' ? 6 : 2, marginTop: 2 },
  primaryBtn: { backgroundColor: GREEN_BTN, borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 14 },
  primaryBtnShadow: { shadowColor: GREEN_BTN, shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontFamily: F.extra },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  divLine: { flex: 1, height: 1, backgroundColor: '#dde2e9' },
  divText: { color: '#93a1b5', fontSize: 12, fontFamily: F.med },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9dfe7', borderRadius: 14, paddingVertical: 14, marginTop: 18 },
  googleText: { color: DARK, fontSize: 14, fontFamily: F.semi },
  footNote: { textAlign: 'center', fontSize: 11, lineHeight: 16, color: '#93a1b5', fontFamily: F.med, marginTop: 16 },

  otpScreen: { flex: 1, backgroundColor: SHEET },
  glowGreen: { position: 'absolute', bottom: -150, right: -120, width: 340, height: 340, borderRadius: 170, backgroundColor: 'rgba(43,196,138,0.14)' },
  backBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#d6dbe3', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  otpTitle: { fontSize: 32, lineHeight: 35, fontFamily: F.extra, color: DARK, letterSpacing: -1, marginTop: 34 },
  otpSub: { fontSize: 14.5, lineHeight: 22, color: '#5c6b81', fontFamily: F.med, marginTop: 10 },
  otpEmail: { color: DARK, fontFamily: F.bold },
  otpRow: { flexDirection: 'row', gap: 10, marginTop: 28, position: 'relative' },
  otpBox: { flex: 1, aspectRatio: 1 / 1.15, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  otpBoxFilled: { backgroundColor: '#fff', borderColor: '#dde2e9' },
  otpBoxFocused: { backgroundColor: '#fff', borderColor: BLUE, borderWidth: 1.5 },
  otpBoxEmpty: { backgroundColor: '#efede8', borderColor: '#e2e5eb' },
  otpDigit: { fontFamily: F.monoBold, fontSize: 24, color: DARK },
  caret: { width: 2, height: 24, backgroundColor: BLUE },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  resendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  resendMuted: { fontSize: 12.5, fontFamily: F.semi, color: '#8b9ab0' },
  resendLink: { fontSize: 12.5, fontFamily: F.bold, color: GREEN_BTN },
});
