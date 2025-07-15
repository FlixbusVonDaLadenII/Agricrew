import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform } from 'react-native'; // <-- Add this import
import { getThemeColors, Theme } from '@/theme/colors';

const currentTheme: Theme = 'dark'; // Or dynamically get your theme
const themeColors = getThemeColors(currentTheme);

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: themeColors.primary,
                tabBarInactiveTintColor: themeColors.textSecondary,
                tabBarStyle: {
                    backgroundColor: themeColors.surface,
                    borderTopWidth: 1,
                    borderTopColor: themeColors.border,
                    height: Platform.OS === 'ios' ? 90 : 60, // Adjust height for iOS notch
                    paddingBottom: Platform.OS === 'ios' ? 30 : 0, // Padding for iOS safe area
                },
                headerShown: false, // Hide the default header for tab screens, as each screen will manage its own
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Jobs',
                    tabBarIcon: ({ color }) => <MaterialCommunityIcons name="briefcase" size={28} color={color} />,
                }}
            />
            {/* Assuming 'add-job' is a screen you have or plan to add */}
            <Tabs.Screen
                name="add-job"
                options={{
                    title: 'Add Job',
                    tabBarIcon: ({ color }) => <MaterialCommunityIcons name="plus-box" size={28} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings" // This must match the filename: profile.tsx
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account" size={28} color={color} />,
                }}
            />
            {/* Add other tab screens here as needed */}
        </Tabs>
    );
}