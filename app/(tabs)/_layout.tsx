import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getThemeColors } from '@/theme/colors';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useUnreadChats } from '@/contexts/UnreadChatContext';

const themeColors = getThemeColors('dark');

const ChatsTabIcon = ({ color, size }: { color: string; size: number }) => {
    const { unreadChats } = useUnreadChats();
    const hasUnread = unreadChats.size > 0;

    // Log to see if the UI is updating
    console.log('[ChatsTabIcon] Unread count:', unreadChats.size);

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

export default function TabLayout() {
    const { t } = useTranslation();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: themeColors.primary,
                tabBarStyle: {
                    backgroundColor: themeColors.surface,
                    borderTopColor: themeColors.border,
                },
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: t('tabs.jobs'),
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="briefcase-outline" color={color} size={size} />
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
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="plus-box-outline" color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: t('tabs.profile'),
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="account-outline" color={color} size={size} />
                    ),
                }}
            />
        </Tabs>
    );
}