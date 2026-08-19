import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://sgmootadgtbophfctgyy.supabase.co';
const supabaseAnonKey = 'sb_publishable_UhLDFu6dUS1b_IR2q6ecCQ_3KbFsqRt';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});