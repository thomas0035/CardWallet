import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { getCachedKey } from '../services/crypto';
import { useWalletStore } from '../store/walletStore';
import { useCardStore } from '../store/cardStore';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import AddCardScreen from '../screens/AddCardScreen';
import CardDetailScreen from '../screens/CardDetailScreen';
import WalletLockScreen from '../screens/WalletLockScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  WalletLock: undefined;
  Home: undefined;
  AddCard: { cardId?: string } | undefined;
  CardDetail: { cardId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = { headerShown: false } as const;

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator color="#6c47ff" size="large" />
    </View>
  );
}

export default function AppNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  // Distinct from `session === null`: we do not know yet, so show neither
  // stack. Without this the login screen flashes before the stored session
  // finishes loading.
  const [initializing, setInitializing] = useState(true);

  const walletKey = useWalletStore((state) => state.key);
  const walletChecked = useWalletStore((state) => state.checked);

  useEffect(() => {
    // Read whatever session is already persisted in AsyncStorage.
    //
    // The previous version never did this. The token was saved correctly but
    // nothing read it at startup, and the navigator hardcoded
    // initialRouteName="Login" — so a valid session still meant retyping your
    // password on every cold start.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    // Covers sign-in, sign-out, and token refresh, including refreshes that
    // fail because the session finally expired.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        setSession(nextSession);

        if (event === 'SIGNED_OUT') {
          // Drop both the decrypted cards and the wallet key, so signing in as
          // someone else on this device cannot read the previous user's data.
          useCardStore.getState().setCards([]);
          useWalletStore.getState().lock();
        }
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Look for a wallet key cached on this device, so a returning user goes
  // straight to their cards without retyping the passphrase.
  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    getCachedKey().then((key) => {
      if (cancelled) return;
      if (key) {
        useWalletStore.getState().setKey(key);
      } else {
        useWalletStore.getState().setChecked(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (initializing) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {/*
        Two separate stacks rather than one flat stack containing Login.
        Signing in or out swaps the whole stack, so screens never call
        navigation.replace('Home') / replace('Login') themselves, and there is
        no way to press Back from Home into the login screen.
      */}
      <Stack.Navigator screenOptions={screenOptions}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : !walletKey ? (
          // Signed in, but the card numbers cannot be read yet. Shown while
          // the cached-key lookup is still running too, so the passphrase
          // prompt never flashes for someone who has already unlocked.
          <Stack.Screen
            name="WalletLock"
            component={walletChecked ? WalletLockScreen : SplashScreen}
          />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="AddCard" component={AddCardScreen} />
            <Stack.Screen name="CardDetail" component={CardDetailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
