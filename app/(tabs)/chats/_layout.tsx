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
                options={{
                    title: 'Messages',
                    // --- THIS IS THE FIX ---
                    // This sets the back button title for any screen pushed from this one
                    headerBackTitle: '',
                }}
            />
            <Stack.Screen
                name="[id]" // This is the individual chat screen
                options={{
                    // Options specific to the chat screen itself can remain here
                }}
            />
        </Stack>
    );
}