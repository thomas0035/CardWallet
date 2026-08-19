import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Fail loudly at startup rather than with a confusing network error later.
// Expo inlines EXPO_PUBLIC_* variables at build time, so a missing .env
// silently produces `undefined` here unless we check.
if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase config. Copy mobile-app/.env.example to mobile-app/.env ' +
      'and fill in your project URL and publishable key, then restart the dev ' +
      'server with `npx expo start --clear`.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // Sessions live in AsyncStorage rather than SecureStore because SecureStore
    // caps values at 2048 bytes and Supabase sessions can exceed that. This is
    // acceptable here: card numbers are encrypted on-device before upload, so a
    // stolen session yields ciphertext, not card data.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based auth callbacks in a native app.
    detectSessionInUrl: false,
  },
});
