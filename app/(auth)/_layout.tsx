// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import { getThemeColors } from '@/theme/colors'; // Adjust path if necessary

const themeColors = getThemeColors('dark'); // Consistent theme for auth flow

const AuthLayout = () => {
    return (
        <Stack>
            <Stack.Screen
                name="login" // This refers to app/(auth)/login.tsx
                options={{
                    headerShown: false, // Hide header for a clean login screen
                    // You can set specific header styles here if you want one
                    // headerStyle: { backgroundColor: themeColors.background },
                    // headerTintColor: themeColors.text,
                }}
            />
            <Stack.Screen
                name="register" // This refers to app/(auth)/register.tsx
                options={{
                    headerShown: false, // Hide header for register too
                }}
            />
            {/* Add other auth-related screens here if you have them, e.g., forgot-password.tsx */}
        </Stack>
    );
};

export default AuthLayout;