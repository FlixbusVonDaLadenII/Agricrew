// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getThemeColors } from '@/theme/colors';
import { Session } from '@supabase/supabase-js';

const currentTheme = 'dark';
const themeColors = getThemeColors(currentTheme);

export default function RootLayout() {
    const [session, setSession] = useState<Session | null>(null);
    const [initializing, setInitializing] = useState(true);

    // 1️⃣  Einmalig aktuelle Session holen
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setInitializing(false);
        });

        // 2️⃣  Auf spätere Auth‑Änderungen hören
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => setSession(session)
        );

        return () => subscription?.unsubscribe();
    }, []);

    // Splash / Lade‑Bildschirm
    if (initializing) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
        );
    }

    // 3️⃣  Stack dynamisch zusammenstellen
    return (
        <Stack screenOptions={{ headerShown: false }}>
            {session ? (
                // Angemeldet → Haupt‑Tabs
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            ) : (
                // Nicht angemeldet → Auth‑Gruppe
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            )}
        </Stack>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themeColors.background ?? '#000', // Fallback zu Schwarz
    },
});
