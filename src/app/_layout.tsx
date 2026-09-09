import { Stack } from 'expo-router';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { IBMPlexMono_400Regular, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { SocketProvider } from '../context/SocketContext';
import { STRIPE_PUBLISHABLE_KEY } from '../config';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

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
