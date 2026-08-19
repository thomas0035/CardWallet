import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import AddCardScreen from '../screens/AddCardScreen';
import CardDetailScreen from '../screens/CardDetailScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  AddCard: { cardId?: string } | undefined;
  CardDetail: { cardId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = { headerShown: false } as const;

export default function AppNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  // Distinct from `session === null`: we do not know yet, so show neither
  // stack. Without this the login screen flashes before the stored session
  // finishes loading.
  const [initializing, setInitializing] = useState(true);

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
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  if (initializing) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#6c47ff" size="large" />
      </View>
    );
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
        {session ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="AddCard" component={AddCardScreen} />
            <Stack.Screen name="CardDetail" component={CardDetailScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
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
