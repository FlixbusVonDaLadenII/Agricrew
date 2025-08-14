// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import { getThemeColors } from '@/theme/colors'; // Adjust path if necessary

const themeColors = getThemeColors('dark'); // Consistent theme for auth flow

const AuthLayout = () => {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
                name="login" // This refers to app/(auth)/login.tsx
            />
            <Stack.Screen
                name="register" // This refers to app/(auth)/register.tsx
            />
            {/* --- THIS IS THE ADDED LINE --- */}
            <Stack.Screen
                name="forgot-password" // This refers to app/(auth)/forgot-password.tsx
            />
        </Stack>
    );
};

export default AuthLayout;