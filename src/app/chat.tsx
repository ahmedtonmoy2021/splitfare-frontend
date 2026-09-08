import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ScreenHeader from '../components/ScreenHeader';

export default function Chat() {
  const { bookingId, name } = useLocalSearchParams<{ bookingId: string; name: string }>();
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<any>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  const myId = user?.id || user?._id;

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
      if (data.bookingId === bookingId) {
        setMessages((prev) => [...prev, data.message]);
      }
    };
    socket.on('new-message', handler);
    return () => socket.off('new-message', handler);
  }, [socket, bookingId]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      const { data } = await axios.post(
        `${API_URL}/api/messages`,
        { bookingId, text: t },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((prev) => [...prev, data]);
    } catch {
      setText(t);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 10 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader title={name || 'Chat'} />

      {loading ? (
        <ActivityIndicator color="#010E39" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 10 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.length === 0 && <Text style={styles.empty}>Say hello 👋</Text>}
          {messages.map((m) => {
            const mine = (m.sender?.toString?.() || m.sender) === myId;
            return (
              <View key={m._id} style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={[styles.msgText, mine && { color: '#fff' }]}>{m.text}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EAF2FB', paddingHorizontal: 16 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 15 },
  bubbleRow: { marginVertical: 3, flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  mine: { backgroundColor: '#010E39', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: '#f0f0f0', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, color: '#111' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  input: { flex: 1, backgroundColor: '#f4f4f4', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#010E39', alignItems: 'center', justifyContent: 'center' },
});
