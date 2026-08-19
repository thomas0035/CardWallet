import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useWalletStore } from '../store/walletStore';
import { dataErrorMessage } from '../utils/errorMessages';
import {
  buildKeyCheck,
  deriveKey,
  cacheKey,
  generateSalt,
  verifyKeyCheck,
} from '../services/crypto';

/**
 * Sets up or unlocks the wallet passphrase that protects card numbers.
 *
 * Shown after sign-in whenever no derived key is cached on this device: on
 * first ever use (setup), and on each new device (unlock).
 */

const MIN_PASSPHRASE_LENGTH = 8;

type Mode = 'loading' | 'setup' | 'unlock';

export default function WalletLockScreen() {
  const [mode, setMode] = useState<Mode>('loading');
  const [salt, setSalt] = useState<string | null>(null);
  const [keyCheck, setKeyCheck] = useState<string | null>(null);

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const setKey = useWalletStore((state) => state.setKey);

  // Decide which mode we are in: a profile with a salt already set means the
  // wallet exists and we are unlocking it on a new device.
  const loadProfile = React.useCallback(async () => {
    setMode('loading');
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('key_salt, key_check')
        .single();

      if (error) throw error;

      if (data?.key_salt && data?.key_check) {
        setSalt(data.key_salt);
        setKeyCheck(data.key_check);
        setMode('unlock');
      } else {
        setMode('setup');
      }
    } catch (error) {
      setLoadError(dataErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSetup = async () => {
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      Alert.alert(
        'Too short',
        `Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`
      );
      return;
    }
    if (passphrase !== confirmPassphrase) {
      Alert.alert('No match', 'The two passphrases are different.');
      return;
    }

    // Make the irreversibility explicit before it is too late to matter.
    Alert.alert(
      'Write this down',
      'There is no way to reset this passphrase. If you forget it, your saved ' +
        'card numbers cannot be recovered — not by you, and not by anyone else.',
      [
        { text: 'Back', style: 'cancel' },
        { text: 'I have written it down', onPress: createWallet },
      ]
    );
  };

  const createWallet = async () => {
    setBusy(true);
    try {
      const newSalt = await generateSalt();
      const derived = await deriveKey(passphrase, newSalt);

      const { error } = await supabase
        .from('profiles')
        .update({ key_salt: newSalt, key_check: buildKeyCheck(derived) })
        .eq('id', (await supabase.auth.getUser()).data.user!.id);

      if (error) throw error;

      await cacheKey(derived);
      setKey(derived);
    } catch (error) {
      Alert.alert('Could not set up your wallet', dataErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (!passphrase || !salt || !keyCheck) return;

    setBusy(true);
    try {
      const derived = await deriveKey(passphrase, salt);

      // Verify against the stored check value rather than letting a wrong
      // passphrase through to fail later, card by card.
      if (!verifyKeyCheck(keyCheck, derived)) {
        Alert.alert('Wrong passphrase', 'That is not the passphrase for this wallet.');
        return;
      }

      await cacheKey(derived);
      setKey(derived);
    } catch (error) {
      Alert.alert('Could not unlock', dataErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (mode === 'loading') {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        {loadError ? (
          <>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.button} onPress={loadProfile}>
              <Text style={styles.buttonText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSignOut}>
              <Text style={styles.linkText}>Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color="#6c47ff" size="large" />
        )}
      </View>
    );
  }

  const isSetup = mode === 'setup';

  return (
    <Pressable style={styles.outer} onPress={Keyboard.dismiss}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <ScrollView
        style={styles.outer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <MaterialIcons
            name={isSetup ? 'enhanced-encryption' : 'lock'}
            size={44}
            color="#6c47ff"
            style={styles.icon}
          />

          <Text style={styles.title}>
            {isSetup ? 'Protect your cards' : 'Unlock your wallet'}
          </Text>
          <Text style={styles.subtitle}>
            {isSetup
              ? 'Choose a passphrase. Your card numbers are encrypted with it on this device, so nobody — including whoever runs the database — can read them.'
              : 'Enter your wallet passphrase to decrypt your card numbers on this device.'}
          </Text>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Wallet passphrase"
              placeholderTextColor="#888"
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry={!showPassphrase}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassphrase((v) => !v)}>
              <MaterialIcons
                name={showPassphrase ? 'visibility-off' : 'visibility'}
                size={22}
                color="#888"
              />
            </TouchableOpacity>
          </View>

          {isSetup && (
            <TextInput
              style={styles.input}
              placeholder="Confirm passphrase"
              placeholderTextColor="#888"
              value={confirmPassphrase}
              onChangeText={setConfirmPassphrase}
              secureTextEntry={!showPassphrase}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
          )}

          {isSetup && (
            <View style={styles.warning}>
              <MaterialIcons name="warning-amber" size={18} color="#ffb020" />
              <Text style={styles.warningText}>
                This passphrase cannot be reset. Forget it and your card numbers
                are gone for good. Write it down somewhere physical.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={isSetup ? handleSetup : handleUnlock}
            disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isSetup ? 'Set passphrase' : 'Unlock'}
              </Text>
            )}
          </TouchableOpacity>

          {busy && (
            <Text style={styles.busyNote}>
              Deriving your key — this takes a moment by design.
            </Text>
          )}

          <TouchableOpacity onPress={handleSignOut} disabled={busy}>
            <Text style={styles.linkText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  centered: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
  icon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 32,
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
  warning: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#241d0c',
    borderColor: '#4a3a12',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    color: '#e8c579',
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    width: '100%',
    backgroundColor: '#6c47ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  busyNote: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  linkText: {
    color: '#6c47ff',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 21,
  },
});
