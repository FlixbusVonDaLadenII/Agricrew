// app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getThemeColors } from '@/theme/colors';

const themeColors = getThemeColors('dark');

export default function TabLayout() {
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
                    title: 'Jobs',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="briefcase-outline" color={color} size={size} />
                    ),
                }}
            />

            <Tabs.Screen
                name="chats"
                options={{
                    title: 'Chats',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="message-text-outline" color={color} size={size} />
                    ),
                }}
            />

            <Tabs.Screen
                name="add-job"
                options={{
                    title: 'Add Job',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="plus-box-outline" color={color} size={size} />
                    ),
                }}
            />

            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="account-outline" color={color} size={size} />
                    ),
                }}
            />
        </Tabs>
    );
}