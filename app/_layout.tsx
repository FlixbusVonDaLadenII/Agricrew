import '../i18n';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { getThemeColors } from '@/theme/colors';
import { SessionProvider, useSession } from '@/lib/SessionProvider';
import { UnreadChatProvider } from '@/contexts/UnreadChatContext';
import { savePushToken } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const themeColors = getThemeColors('dark');

const InitialLayout = () => {
    const { session, isLoading } = useSession();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        if (isLoading) return;

        const inAuthFlow = segments[0] === '(auth)';

        if (session && inAuthFlow) {
            supabase.rpc('get_user_subscription_status', { user_id_input: session.user.id })
                .then(({ data: isSubscribed }) => {
                    if (isSubscribed) {
                        router.replace('/(tabs)');
                    } else {
                        router.replace('/(auth)/subscribe');
                    }
                });
        } else if (!session && !inAuthFlow) {
            router.replace('/(auth)/login');
        }
    }, [session, isLoading, router]);

    useEffect(() => {
        if (session?.user?.id) {
            savePushToken(session.user.id);
        }
    }, [session]);

    useEffect(() => {
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;

            // --- THIS IS THE FIX ---
            if (data?.type === 'sos_job') {
                // If it's an SOS job, go to the main job list
                router.push('/(tabs)');
            } else if (data?.chat_id) {
                // If it's a chat notification, go to the chat
                router.push({ pathname: '/(tabs)/chats/[id]', params: { id: data.chat_id as string } });
            }
        });
        return () => subscription.remove();
    }, [router]);

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
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <SessionProvider>
                <UnreadChatProvider>
                    <InitialLayout />
                </UnreadChatProvider>
            </SessionProvider>
        </SafeAreaProvider>
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