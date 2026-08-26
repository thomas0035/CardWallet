import React, { useEffect, useRef, useState } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Animated,
  Easing,
  Keyboard,
  Pressable,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../config/supabase';
import { authErrorMessage } from '../utils/errorMessages';
import { MaterialIcons } from '@expo/vector-icons';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleShow = (event: { endCoordinates: { height: number }; duration?: number }) => {
      const nextHeight = event.endCoordinates.height;
      setKeyboardHeight(nextHeight);
      setKeyboardVisible(true);
      Animated.timing(translateY, {
        toValue: -Math.min(nextHeight * 0.18, 72),
        duration: event.duration ?? 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: event.duration ?? 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    };

    const handleHide = (event?: { duration?: number }) => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
      Animated.timing(translateY, {
        toValue: 0,
        duration: event?.duration ?? 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: event?.duration ?? 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    };

    const showSubscription = Keyboard.addListener(showEvent, handleShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [headerOpacity, translateY]);

  const handleLogin = async () => {
    // Note: there is deliberately no @gmail.com check here. The old one locked
    // out anyone who registered with a different provider, because the register
    // screen never enforced the same rule. Supabase validates the address.
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert('Login failed', authErrorMessage(error));
      }
      // On success there is nothing to navigate to: AppNavigator observes the
      // new session via onAuthStateChange and swaps in the app stack.
    } catch (error) {
      Alert.alert('Login failed', authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable style={styles.outer} onPress={Keyboard.dismiss}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <ScrollView
        style={styles.outer}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardHeight + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.formCard, { transform: [{ translateY }] }]}>
          <Animated.View
            style={[
              styles.header,
              keyboardVisible && styles.headerHidden,
              { opacity: headerOpacity },
            ]}>
            <Text style={styles.title}>CardWallet</Text>
            <Text style={styles.subtitle}>Your digital card wallet</Text>
          </Animated.View>
          {/*
            autoComplete and importantForAutofill are what make Android's
            password manager recognise this as a sign-in form. Without them it
            never offers to save or fill credentials, which is why nothing was
            being prompted.
          */}
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            importantForAutofill="yes"
            returnKeyType="next"
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              importantForAutofill="yes"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}>
              <MaterialIcons
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={22}
                color="#888"
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>
              Don't have an account? Register
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  formCard: {
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 48,
  },
  headerHidden: {
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    width: '100%',
    backgroundColor: '#6c47ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkText: {
    color: '#6c47ff',
    fontSize: 14,
    textAlign: 'center',
  },
  passwordContainer: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
    position: 'relative',
  },
  passwordInput: {
    padding: 16,
    paddingRight: 52,
    color: '#fff',
    fontSize: 16,
  },
  eyeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});
