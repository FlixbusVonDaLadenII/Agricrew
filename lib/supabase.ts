import 'react-native-url-polyfill/auto'; // Required for Supabase in React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Ensure the required environment variables are set before creating the client.
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage, // Use AsyncStorage for storing session tokens in React Native
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Important for React Native to prevent issues with deep links
    },
});
