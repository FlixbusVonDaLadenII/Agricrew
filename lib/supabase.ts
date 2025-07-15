import 'react-native-url-polyfill/auto'; // Required for Supabase in React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://vxzwnmjopcuemaaxuolu.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4endubWpvcGN1ZW1hYXh1b2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MzY4MDYsImV4cCI6MjA2ODExMjgwNn0.ZX2snwV35wHi5tEdewGSgMOPFqMoI8-nDcHLG3Z2YAQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage, // Use AsyncStorage for storing session tokens in React Native
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Important for React Native to prevent issues with deep links
    },
});