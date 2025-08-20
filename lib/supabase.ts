// lib/supabase.ts
import { Platform } from 'react-native';
import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';

type DB = any; // replace with your Database type if you have generated types

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

let client: SupabaseClient<DB> | null = null;

function isBrowser() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function getSupabase(): SupabaseClient<DB> {
    if (client) return client;

    const options: SupabaseClientOptions<DB> = {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: isBrowser(),
            // Only provide AsyncStorage on native
            ...(Platform.OS !== 'web'
                ? {
                    // require inside here, so TS knows it's always defined
                    storage: require('@react-native-async-storage/async-storage').default,
                }
                : {}),
        },
    };

    client = createClient<DB>(SUPABASE_URL, SUPABASE_ANON_KEY, options);
    return client;
}

// Keep a default export for existing imports
export const supabase = new Proxy({} as SupabaseClient<DB>, {
    get(_t, prop) {
        // @ts-ignore – delegate property access lazily
        return (getSupabase() as any)[prop];
    },
}) as SupabaseClient<DB>;