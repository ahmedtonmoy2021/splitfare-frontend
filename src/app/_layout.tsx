import { Stack } from 'expo-router';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { SocketProvider } from '../context/SocketContext';
import { STRIPE_PUBLISHABLE_KEY } from '../config';

export default function RootLayout() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </StripeProvider>
  );
}
