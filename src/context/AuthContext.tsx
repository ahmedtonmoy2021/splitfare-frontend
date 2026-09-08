import { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [mode, setModeState] = useState<'rider' | 'driver'>('rider');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const savedToken = await SecureStore.getItemAsync('token');
      const savedUser = await AsyncStorage.getItem('user');
      const savedMode = await AsyncStorage.getItem('mode');
      if (savedToken) {
        setToken(savedToken);
        setUser(savedUser ? JSON.parse(savedUser) : null);
      }
      if (savedMode === 'driver' || savedMode === 'rider') setModeState(savedMode);
      setLoading(false);
    })();
  }, []);

  async function setMode(m: 'rider' | 'driver') {
    setModeState(m);
    await AsyncStorage.setItem('mode', m);
  }

  async function login(newToken: string, newUser: any) {
    setToken(newToken);
    setUser(newUser);
    await SecureStore.setItemAsync('token', newToken);
    await AsyncStorage.setItem('user', JSON.stringify(newUser));
  }

  async function updateUser(newUser: any) {
    setUser(newUser);
    await AsyncStorage.setItem('user', JSON.stringify(newUser));
  }

  async function logout() {
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync('token');
    await AsyncStorage.removeItem('user');
  }

  return (
    <AuthContext.Provider value={{ token, user, mode, setMode, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
