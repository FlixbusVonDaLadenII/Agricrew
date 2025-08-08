import '../i18n';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { getThemeColors } from '@/theme/colors';
import { SessionProvider, useSession } from '@/lib/SessionProvider';
import { UnreadChatProvider } from '@/contexts/UnreadChatContext';
import { savePushToken } from '@/lib/notifications';
import * as Notifications from 'expo-notifications'; // ADDED: Import notifications

const themeColors = getThemeColors('dark');

// This component handles the core navigation logic
const InitialLayout = () => {
    const { session, isLoading } = useSession();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        if (isLoading) return;
        const inApp = segments[0] === '(tabs)' || segments[0] === 'my-jobs' || segments[0] === 'edit-job';
        if (session && !inApp) {
            router.replace('/(tabs)');
        } else if (!session && inApp) {
            router.replace('/(auth)/login');
        }
    }, [session, isLoading, segments, router]);

    useEffect(() => {
        if (session?.user?.id) {
            savePushToken(session.user.id);
        }
    }, [session]);

    // ADDED: This new useEffect sets up the notification tap listener
    useEffect(() => {
        // This listener is fired whenever a user taps on or interacts with a notification
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            const chatId = data?.chat_id as string | undefined;

            // If the notification has a chat_id, navigate to that chat screen
            if (chatId) {
                router.push({
                    pathname: '/(tabs)/chats/[id]',
                    params: { id: chatId },
                });
            }
        });

        // Cleanup function to remove the listener when the component unmounts
        return () => {
            subscription.remove();
        };
    }, [router]); // Dependency array with router

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

// The root component that wraps the entire app in providers
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
        backgroundColor: themeColors.background,
    },
});