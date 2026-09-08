import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ToastContext = createContext<any>(null);

const CONFIG: any = {
  success: { bg: '#0b8a43', icon: 'checkmark-circle' },
  error: { bg: '#c0392b', icon: 'alert-circle' },
  info: { bg: '#111', icon: 'information-circle' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<any>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ message, type });
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
      }, 2800);
    },
    [anim]
  );

  const c = toast ? CONFIG[toast.type] || CONFIG.info : CONFIG.info;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            {
              top: insets.top + 8,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
            },
          ]}>
          <View style={[styles.toast, { backgroundColor: c.bg }]}>
            <Ionicons name={c.icon} size={20} color="#fff" />
            <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 9999 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 14, maxWidth: 460, elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
