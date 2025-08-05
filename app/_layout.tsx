if (typeof globalThis.structuredClone !== 'function') {
    globalThis.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

import '../i18n';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { getThemeColors } from '@/theme/colors';
import { SessionProvider, useSession } from '@/lib/SessionProvider';
import { UnreadChatProvider } from '@/contexts/UnreadChatContext';
import { savePushToken } from '@/lib/notifications'; // 1. Import the function

const currentTheme = 'dark';
const themeColors = getThemeColors(currentTheme);

// This component decides whether to show the login screens or the main app tabs
const InitialLayout = () => {
    const { session, isLoading } = useSession();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        if (isLoading) return;

        const inTabsGroup = segments[0] === '(tabs)';
        const inAuthGroup = segments[0] === '(auth)';
        const isMyJobsScreen = segments[0] === 'my-jobs';
        const isEditJobScreen = segments[0] === 'edit-job';

        if (session) {
            // User is signed in
            if (!inTabsGroup && !isMyJobsScreen && !isEditJobScreen) {
                // If not in tabs or allowed screens, redirect to tabs
                router.replace('/(tabs)');
            }
        } else if (!session) {
            // User is signed out
            if (!inAuthGroup) {
                // If not in auth, redirect to login
                router.replace('/(auth)/login');
            }
        }
    }, [session, isLoading, segments, router]);

    // 2. Add this new useEffect to handle push token registration
    useEffect(() => {
        if (session?.user?.id) {
            savePushToken(session.user.id);
        }
    }, [session]);

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="my-jobs" options={{ presentation: 'modal' }}/>
            <Stack.Screen name="edit-job/[id]" options={{ presentation: 'modal' }}/>
        </Stack>
    );
}

// This is the main export. It wraps the entire app in the necessary providers.
export default function RootLayout() {
    return (
        <SessionProvider>
            <UnreadChatProvider>
                <InitialLayout />
            </UnreadChatProvider>
        </SessionProvider>
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