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

const themeColors = getThemeColors('dark');

const InitialLayout = () => {
    const { session, isLoading } = useSession();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        if (isLoading) return;

        const inAuthFlow = segments[0] === '(auth)';

        if (session && inAuthFlow) {
            // User is logged in but still in the auth flow, check subscription and redirect
            supabase.rpc('get_user_subscription_status', { user_id_input: session.user.id })
                .then(({ data: isSubscribed }) => {
                    if (isSubscribed) {
                        router.replace('/(tabs)');
                    } else {
                        router.replace('/(auth)/subscribe');
                    }
                });
        } else if (!session && !inAuthFlow) {
            // User is not logged in and not in the auth flow, send to login
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
            const chatId = data?.chat_id as string | undefined;
            if (chatId) {
                router.push({ pathname: '/(tabs)/chats/[id]', params: { id: chatId } });
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
            {/* --- REMOVED THE edit-job SCREEN --- */}
        </Stack>
    );
}

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