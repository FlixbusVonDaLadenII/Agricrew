// app/_layout.tsx

if (typeof globalThis.structuredClone !== 'function') {
    globalThis.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

import '../i18n';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getThemeColors } from '@/theme/colors';
import { Session } from '@supabase/supabase-js';

const currentTheme = 'dark';
const themeColors = getThemeColors(currentTheme);

export default function RootLayout() {
    const [session, setSession] = useState<Session | null>(null);
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setSession(session);
                setInitializing(false);
            })
            .catch(error => {
                console.error('Error fetching initial Supabase session:', error);
                setInitializing(false);
            });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription?.unsubscribe();
    }, []);

    if (initializing) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            {session ? (
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            ) : (
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
        backgroundColor: themeColors.background ?? '#000',
    },
});
