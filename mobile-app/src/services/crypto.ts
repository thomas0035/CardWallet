/**
 * On-device encryption for card numbers.
 *
 * Card numbers are encrypted on the phone before they are sent to Supabase, so
 * the database only ever holds ciphertext. The key is derived from a wallet
 * passphrase that is never stored and never transmitted.
 *
 * Design, deliberately kept to the fewest moving parts that are still sound:
 *
 *   key        = PBKDF2-SHA256(passphrase, salt, 100_000 iterations)
 *   ciphertext = XChaCha20-Poly1305(key, random 24-byte nonce)
 *   stored as    "v1:" + hex(nonce || ciphertext)
 *
 * The salt lives in `profiles.key_salt` and is not secret — it exists so the
 * same passphrase yields a different key per account. The derived key is
 * cached in expo-secure-store so daily use needs no re-entry; a new device
 * asks for the passphrase once.
 *
 * Consequence worth being explicit about: forget the passphrase and the card
 * numbers are unrecoverable. There is no reset, by design.
 *
 * Both libraries are pure JavaScript, so this works in Expo Go with no native
 * module and no development build.
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/** Marks our ciphertext, so pre-encryption plaintext rows stay recognisable. */
const PREFIX = 'v1:';

/** XChaCha20 takes a 24-byte nonce — large enough that random is safe. */
const NONCE_BYTES = 24;
const SALT_BYTES = 32;
const KEY_BYTES = 32;

/**
 * PBKDF2 iterations. This runs in JavaScript on a phone, so it is a trade
 * between unlock latency (about a second) and brute-force cost. It is paid
 * once per device, not per card.
 */
const ITERATIONS = 100_000;

/** Plaintext of the value stored in `profiles.key_check`. */
const KEY_CHECK_PLAINTEXT = 'cardwallet-key-check-v1';

const SECURE_STORE_KEY = 'wallet_key';

/** A fresh random salt, hex encoded, for a newly set-up wallet. */
export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(SALT_BYTES);
  return bytesToHex(bytes);
}

/**
 * Derive the encryption key from a passphrase and salt.
 *
 * Deliberately slow — that slowness is the defence against someone guessing
 * the passphrase offline. `asyncTick` yields to the event loop so the UI can
 * still paint a spinner while this runs.
 */
export async function deriveKey(
  passphrase: string,
  saltHex: string
): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8ToBytes(passphrase), hexToBytes(saltHex), {
    dkLen: KEY_BYTES,
    c: ITERATIONS,
    asyncTick: 10,
  });
}

/** Encrypt a value. Returns the string to store in the database. */
export function encryptField(plaintext: string, key: Uint8Array): string {
  const nonce = Crypto.getRandomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(
    utf8ToBytes(plaintext)
  );

  // Nonce is not secret and must be stored alongside the ciphertext to decrypt.
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);

  return PREFIX + bytesToHex(combined);
}

/**
 * Decrypt a value produced by `encryptField`.
 *
 * Throws if the key is wrong or the data was tampered with — Poly1305
 * authenticates the ciphertext, so this fails loudly rather than returning
 * garbage.
 */
export function decryptField(stored: string, key: Uint8Array): string {
  if (!isEncrypted(stored)) {
    // Written before encryption existed. Return as-is so old rows stay
    // readable rather than showing the user a decryption error.
    return stored;
  }

  const combined = hexToBytes(stored.slice(PREFIX.length));
  const nonce = combined.slice(0, NONCE_BYTES);
  const ciphertext = combined.slice(NONCE_BYTES);

  return bytesToUtf8(xchacha20poly1305(key, nonce).decrypt(ciphertext));
}

/** Whether a stored value is ciphertext rather than legacy plaintext. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Build the value stored in `profiles.key_check`.
 *
 * Without this there is no way to tell a wrong passphrase from corrupt data:
 * the user would type a typo, get no complaint, and then find every card
 * failing to decrypt. Instead we verify the key up front against a known
 * constant.
 */
export function buildKeyCheck(key: Uint8Array): string {
  return encryptField(KEY_CHECK_PLAINTEXT, key);
}

/** Whether a derived key matches the stored check value. */
export function verifyKeyCheck(storedCheck: string, key: Uint8Array): boolean {
  try {
    return decryptField(storedCheck, key) === KEY_CHECK_PLAINTEXT;
  } catch {
    // Poly1305 rejected it: wrong passphrase.
    return false;
  }
}

// ---------------------------------------------------------------------------
// Caching the derived key on the device
// ---------------------------------------------------------------------------

/**
 * The key is small (32 bytes, 64 hex chars) so it fits SecureStore's 2048-byte
 * limit comfortably, and SecureStore is backed by the Android Keystore.
 */
export async function cacheKey(key: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEY, bytesToHex(key));
}

export async function getCachedKey(): Promise<Uint8Array | null> {
  const stored = await SecureStore.getItemAsync(SECURE_STORE_KEY);
  if (!stored) return null;

  try {
    return hexToBytes(stored);
  } catch {
    return null;
  }
}

/**
 * Forget the cached key. Called on sign-out, so signing in as someone else on
 * a shared device cannot decrypt the previous user's cards.
 */
export async function clearCachedKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
}
