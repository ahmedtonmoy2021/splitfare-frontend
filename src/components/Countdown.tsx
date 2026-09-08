import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Countdown({ time }: { time: string }) {
  const [label, setLabel] = useState('');
  const [departed, setDeparted] = useState(false);

  useEffect(() => {
    function update() {
      const diff = new Date(time).getTime() - Date.now();
      if (diff <= 0) {
        setDeparted(true);
        setLabel('Departed');
        return;
      }
      setDeparted(false);
      const mins = Math.floor(diff / 60000);
      const d = Math.floor(mins / 1440);
      const h = Math.floor((mins % 1440) / 60);
      const m = mins % 60;
      if (d > 0) setLabel(`Starts in ${d}d ${h}h`);
      else if (h > 0) setLabel(`Starts in ${h}h ${m}m`);
      else setLabel(`Starts in ${m}m`);
    }
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [time]);

  if (!label) return null;
  const color = departed ? '#c0392b' : '#1a56c4';
  const bg = departed ? '#fdecea' : '#e8f0fe';

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Ionicons name="time" size={13} color={color} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginTop: 8 },
  text: { fontSize: 13, fontWeight: '700' },
});
