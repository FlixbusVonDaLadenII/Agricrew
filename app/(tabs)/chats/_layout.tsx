// app/(tabs)/chats/_layout.tsx

import { Stack } from 'expo-router';
import { getThemeColors } from '@/theme/colors';

const themeColors = getThemeColors('dark');

export default function ChatLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: themeColors.surface },
                headerTintColor: themeColors.text,
                headerTitleStyle: { fontWeight: 'bold' },
            }}
        >
            <Stack.Screen
                name="index" // This is the chat list screen
                options={{ title: 'Messages' }}
            />
            <Stack.Screen
                name="[id]" // This is the individual chat screen
                options={{ title: 'Chat' }}
            />
        </Stack>
    );
}