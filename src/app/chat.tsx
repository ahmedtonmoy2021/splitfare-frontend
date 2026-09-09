import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { colors, fonts, radius } from '../theme';

const QUICK = ['On my way', "I'm here", '5 min late'];

export default function Chat() {
  const { bookingId, name } = useLocalSearchParams<{ bookingId: string; name: string }>();
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<any>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  const myId = user?.id || user?._id;
  const other = name || 'Chat';
  const initials = other.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/messages/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(data);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [bookingId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => {
      if (data.bookingId === bookingId) setMessages((prev) => [...prev, data.message]);
    };
    socket.on('new-message', handler);
    return () => socket.off('new-message', handler);
  }, [socket, bookingId]);

  async function sendText(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (raw === text) setText('');
    try {
      const { data } = await axios.post(
        `${API_URL}/api/messages`,
        { bookingId, text: t },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((prev) => [...prev, data]);
    } catch {
      if (raw === text) setText(t);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{other}</Text>
          <Text style={styles.headerSub}>Ride chat</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 18, gap: 10 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled">
          {messages.length === 0 && <Text style={styles.empty}>Say hello 👋</Text>}
          {messages.map((m) => {
            const mine = (m.sender?.toString?.() || m.sender) === myId;
            const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <View key={m._id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={[styles.msgText, mine && { color: '#fff' }]}>{m.text}</Text>
                </View>
                {!!time && <Text style={styles.time}>{time}</Text>}
              </View>
            );
          })}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow} keyboardShouldPersistTaps="handled">
        {QUICK.map((q) => (
          <TouchableOpacity key={q} style={styles.chip} onPress={() => sendText(q)} activeOpacity={0.85}>
            <Text style={styles.chipText} numberOfLines={1}>{q}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 14 }]}>
        <TextInput
          style={styles.input}
          placeholder="Message…"
          placeholderTextColor="#9aa8bb"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => sendText(text)} activeOpacity={0.9}>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, paddingHorizontal: 18, paddingBottom: 14 },
  backBtn: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1c3b66', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 13, color: '#9cc6ff' },
  headerName: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
  headerSub: { fontFamily: fonts.mono, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  empty: { textAlign: 'center', color: '#aab4c2', marginTop: 40, fontSize: 15, fontFamily: fonts.med },
  bubble: { maxWidth: '80%', paddingVertical: 12, paddingHorizontal: 14 },
  mine: { backgroundColor: colors.blue, borderRadius: 16, borderBottomRightRadius: 5 },
  theirs: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 16, borderBottomLeftRadius: 5 },
  msgText: { fontSize: 13.5, lineHeight: 19, color: colors.ink, fontFamily: fonts.med },
  time: { fontFamily: fonts.mono, fontSize: 10.5, color: '#9aa8bb', marginTop: 3, marginHorizontal: 4 },
  chipsScroll: { flexGrow: 0 },
  chipsRow: { paddingHorizontal: 18, paddingVertical: 12, gap: 8, alignItems: 'center' },
  chip: { flexShrink: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe3ea', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontFamily: fonts.semi, fontSize: 11.5, color: colors.textSecondary },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 18, paddingTop: 14 },
  input: { flex: 1, backgroundColor: '#f2f4f8', borderWidth: 1, borderColor: '#e0e4ea', borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 12, fontSize: 13.5, fontFamily: fonts.med, color: colors.ink, maxHeight: 100 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
});
