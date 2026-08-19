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
  Animated,
  Easing,
  Keyboard,
  Pressable,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { api } from '../services/apiService';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const setAuth = useAuthStore((state) => state.setAuth);

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

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/api/auth/register', { email, password });

      if (data.token) {
        await SecureStore.setItemAsync('token', data.token);
        setAuth(data.user, data.token);
        navigation.replace('Home');
      } else {
        Alert.alert('Error', data.error || 'Registration failed');
      }
    } catch (error) {
      Alert.alert('Error', String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable style={styles.outer} onPress={Keyboard.dismiss}>
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start managing your cards</Text>
          </Animated.View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
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
              returnKeyType="next"
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

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm Password"
              placeholderTextColor="#888"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeBtn}>
              <MaterialIcons
                name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                size={22}
                color="#888"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleRegister}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account? Login</Text>
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
