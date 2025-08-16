// In: flixbusvondaladenii/agricrew/Agricrew-47d21f192d2e4856c09f82d3f56f9188da02c7e6/app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getThemeColors } from '@/theme/colors';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { useUnreadChats } from '@/contexts/UnreadChatContext';
import { UnreadChatProvider } from '@/contexts/UnreadChatContext'; // Import the provider

const themeColors = getThemeColors('dark');

// A clean component for the Chats tab icon with the unread badge
const ChatsTabIcon = ({ color, size }: { color: string; size: number }) => {
    const { unreadChats } = useUnreadChats();
    const hasUnread = unreadChats.size > 0;

    return (
        <View>
            <MaterialCommunityIcons name="message-text-outline" color={color} size={size} />
            {hasUnread && <View style={styles.unreadBadge} />}
        </View>
    );
};

export default function TabLayout() {
    const { t } = useTranslation();

    return (
        <UnreadChatProvider>
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
                {/* ===== ADD THIS NEW SCREEN ===== */}
                <Tabs.Screen
                    name="manage-subscription"
                    options={{
                        title: t('tabs.subscription'),
                        tabBarIcon: ({ color, focused }) => (
                            <MaterialCommunityIcons name={focused ? 'credit-card' : 'credit-card-outline'} color={color} size={28} />
                        ),
                    }}
                />
                {/* ============================== */}
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
        </UnreadChatProvider>
    );
}

const styles = StyleSheet.create({
    unreadBadge: {
        position: 'absolute',
        right: -6,
        top: -3,
        backgroundColor: themeColors.danger,
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: themeColors.surface,
    }
});