// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getThemeColors, Theme } from '@/theme/colors';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, useColorScheme, Platform } from 'react-native';
import { useUnreadChats, UnreadChatProvider } from '@/contexts/UnreadChatContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
    const { t } = useTranslation();
    const scheme = useColorScheme();
    const insets = useSafeAreaInsets();

    // Pick colors for current OS theme
    const theme = (scheme === 'dark' ? 'dark' : 'light') as Theme;
    const themeColors = getThemeColors(theme);

    // Chat icon with unread dot (uses current theme colors)
    const ChatsTabIcon = ({ color, size }: { color: string; size: number }) => {
        const { unreadChats } = useUnreadChats();
        const hasUnread = unreadChats.size > 0;
        return (
            <View>
                <MaterialCommunityIcons name="message-text-outline" color={color} size={size} />
                {hasUnread && (
                    <View
                        style={{
                            position: 'absolute',
                            right: -6,
                            top: -3,
                            backgroundColor: themeColors.danger,
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            borderWidth: 1.5,
                            borderColor: themeColors.surface,
                        }}
                    />
                )}
            </View>
        );
    };

    // Make the bar a little taller and pad it by the safe-area so it
    // never sits inside the home indicator.
    const tabBarStyle = {
        backgroundColor: themeColors.surface,
        borderTopColor: themeColors.border,
        borderTopWidth: StyleSheet.hairlineWidth,
        // base height + safe area; keep it compact on Android
        height: (Platform.OS === 'ios' ? 58 : 60) + Math.max(insets.bottom, 8),
        paddingTop: 6,
        paddingBottom: Math.max(insets.bottom, 8),
    } as const;

    return (
        <UnreadChatProvider>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarShowLabel: true,
                    tabBarHideOnKeyboard: true,

                    tabBarActiveTintColor: themeColors.primary,
                    tabBarInactiveTintColor: themeColors.textSecondary,
                    tabBarLabelStyle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

                    tabBarStyle,
                    // Solid background to avoid translucency blur issues on iOS
                    tabBarBackground: () => (
                        <View style={{ flex: 1, backgroundColor: themeColors.surface }} />
                    ),
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: t('tabs.jobs'),
                        tabBarIcon: ({ color }) => (
                            <MaterialCommunityIcons name="briefcase-outline" color={color} size={26} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="chats"
                    options={{
                        title: t('tabs.chats'),
                        tabBarIcon: (props) => <ChatsTabIcon {...props} />,
                    }}
                />
                <Tabs.Screen
                    name="add-job"
                    options={{
                        title: t('tabs.addJob'),
                        tabBarIcon: ({ color }) => (
                            <MaterialCommunityIcons name="plus-box-outline" color={color} size={26} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="manage-subscription"
                    options={{
                        title: t('tabs.subscription'),
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialCommunityIcons
                                name={focused ? 'credit-card' : 'credit-card-outline'}
                                color={color}
                                size={26}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="settings"
                    options={{
                        title: t('tabs.profile'),
                        tabBarIcon: ({ color }) => (
                            <MaterialCommunityIcons name="account-outline" color={color} size={26} />
                        ),
                    }}
                />
            </Tabs>
        </UnreadChatProvider>
    );
}