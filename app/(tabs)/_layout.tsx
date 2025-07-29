// app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getThemeColors } from '@/theme/colors';
import { useTranslation } from 'react-i18next'; // You'll need to add this import

const themeColors = getThemeColors('dark');

export default function TabLayout() {
    const { t } = useTranslation(); // Add this line to use translation hook

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
                    title: t('tabs.jobs'), // Change this
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="briefcase-outline" color={color} size={size} />
                    ),
                }}
            />

            <Tabs.Screen
                name="chats"
                options={{
                    title: t('tabs.chats'), // Change this
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="message-text-outline" color={color} size={size} />
                    ),
                }}
            />

            <Tabs.Screen
                name="add-job"
                options={{
                    title: t('tabs.addJob'), // Change this
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="plus-box-outline" color={color} size={size} />
                    ),
                }}
            />

            <Tabs.Screen
                name="settings" // This must match your settings.tsx file
                options={{
                    title: t('tabs.profile'), // Change this
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="account-outline" color={color} size={size} />
                    ),
                }}
            />
        </Tabs>
    );
}
