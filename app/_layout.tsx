// app/_layout.tsx
import "../i18n";
import React, { useEffect, useMemo } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import {
    ActivityIndicator,
    View,
    StyleSheet,
    Platform,
    useColorScheme,
} from "react-native";
import { getThemeColors } from "@/theme/colors";
import { SessionProvider, useSession } from "@/lib/SessionProvider";
import { UnreadChatProvider } from "@/contexts/UnreadChatContext";
import { savePushToken } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Purchases from 'react-native-purchases';

// Guarded import for expo-notifications (native only)
let Notifications: typeof import("expo-notifications") | undefined;
if (Platform.OS !== "web") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Notifications = require("expo-notifications");
}

const InitialLayout = () => {
    const { session, isLoading } = useSession();
    const router = useRouter();
    const segments = useSegments();

    // THEME (dynamic)
    const scheme = useColorScheme();
    const themeColors = useMemo(
        () => getThemeColors(scheme === "dark" ? "dark" : "light"),
        [scheme]
    );

    // --- ADD THIS EFFECT TO CONFIGURE REVENUECAT ---
    useEffect(() => {
        if (Platform.OS === 'ios') {
            Purchases.configure({ apiKey: 'appl_KQEquUSMgoyGgeLDqYxIULsNytC' });
        } else if (Platform.OS === 'android') {
            Purchases.configure({ apiKey: 'your_google_api_key' });
        }
    }, []);

    // Paint HTML/body on web so you never see white behind RN views
    useEffect(() => {
        if (Platform.OS === "web") {
            document.documentElement.style.background = themeColors.background;
            document.body.style.background = themeColors.background;
        }
    }, [themeColors.background]);

    // Auth routing
    useEffect(() => {
        if (isLoading) return;

        const inAuthFlow = segments[0] === "(auth)";

        if (session && inAuthFlow) {
            supabase
                .rpc("get_user_subscription_status", { user_id_input: session.user.id })
                .then(({ data: isSubscribed }) => {
                    if (isSubscribed) router.replace("/(tabs)");
                    else router.replace("/(auth)/subscribe");
                });
        } else if (!session && !inAuthFlow) {
            router.replace("/(auth)/login");
        }
    }, [session, isLoading, router, segments]);

    // Save push token (native)
    useEffect(() => {
        if (session?.user?.id && Platform.OS !== "web") {
            savePushToken(session.user.id);
        }
    }, [session]);

    // Notification deep links (native)
    useEffect(() => {
        if (Platform.OS === "web" || !Notifications) return;

        const subscription = Notifications.addNotificationResponseReceivedListener(
            (response) => {
                const data = response.notification.request.content.data as {
                    type?: string;
                    chat_id?: string;
                };

                if (data?.type === "sos_job") {
                    router.push("/(tabs)");
                } else if (data?.chat_id) {
                    router.push({
                        pathname: "/(tabs)/chats/[id]",
                        params: { id: data.chat_id as string },
                    });
                }
            }
        );

        return () => subscription.remove();
    }, [router]);

    if (isLoading) {
        return (
            <View
                style={[
                    styles.loading,
                    { backgroundColor: themeColors.background },
                ]}
            >
                <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                // ✅ Make status bar readable
                statusBarStyle: scheme === "dark" ? "light" : "dark",
                statusBarBackgroundColor: themeColors.background, // Android
                statusBarTranslucent: false,
                // Optional: match scene bg to avoid flashes on screen transitions
                contentStyle: { backgroundColor: themeColors.background },
            }}
        >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="my-jobs" options={{ presentation: "modal" }} />
        </Stack>
    );
};

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
        alignItems: "center",
        justifyContent: "center",
    },
});