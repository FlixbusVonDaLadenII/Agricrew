// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    Platform,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
    ScrollView, // Use ScrollView for content that might exceed screen height
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient'; // For subtle gradients
import { getThemeColors, Theme } from '@/theme/colors'; // Adjust path if necessary
import { router } from 'expo-router'; // For navigation

// Assuming 'dark' mode for this example, will eventually come from context
const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);

// Define your font styles (as discussed, using system font/Roboto)
const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
});

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setError(null);
        setLoading(true);
        // Placeholder for actual login logic with Supabase
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (email === 'test@example.com' && password === 'password123') {
                console.log('Login successful!');
                router.replace('/(tabs)'); // Navigate to main app
            } else {
                setError('Invalid email or password.');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[themeColors.background, themeColors.surface]} // Subtle gradient for the background
            style={styles.gradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled" // Important for inputs within ScrollView
                    >
                        <SafeAreaView style={styles.innerContainer}>
                            <View style={styles.headerContainer}>
                                <Text style={styles.title}>Welcome Back!</Text>
                                <Text style={styles.subtitle}>Log in to your Agricrew account</Text>
                            </View>

                            {error && <Text style={styles.errorText}>{error}</Text>}

                            <View style={styles.formContainer}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Email Address</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="name@example.com"
                                        placeholderTextColor={themeColors.textHint}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                        editable={!loading}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Password</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••••"
                                        placeholderTextColor={themeColors.textHint}
                                        secureTextEntry
                                        value={password}
                                        onChangeText={setPassword}
                                        editable={!loading}
                                    />
                                </View>

                                <TouchableOpacity style={styles.forgotPasswordButton}>
                                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.loginButton}
                                    onPress={handleLogin}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color={themeColors.background} />
                                    ) : (
                                        <Text style={styles.loginButtonText}>Log In</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.signUpContainer}>
                                <Text style={styles.signUpText}>Don't have an account? </Text>
                                <TouchableOpacity onPress={() => router.push('/register')}>
                                    <Text style={styles.signUpLink}>Sign Up</Text>
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    gradientBackground: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1, // Allows content to grow within ScrollView
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40, // Add some vertical padding for smaller screens
    },
    innerContainer: {
        width: '100%', // Take full width within scrollContent's padding
        alignItems: 'center',
    },
    headerContainer: {
        marginBottom: 48,
        alignItems: 'center',
    },
    title: {
        fontFamily: baseFontFamily,
        fontSize: 36, // Slightly larger title
        fontWeight: 'bold',
        color: themeColors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontFamily: baseFontFamily,
        fontSize: 18,
        color: themeColors.textSecondary,
        textAlign: 'center',
        lineHeight: 24, // Improve readability
    },
    errorText: {
        fontFamily: baseFontFamily,
        fontSize: 14,
        color: themeColors.danger,
        marginBottom: 20,
        textAlign: 'center',
        backgroundColor: 'rgba(220, 53, 69, 0.1)', // Subtle error background
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
        width: '100%',
    },
    formContainer: {
        width: '100%',
        backgroundColor: themeColors.surface, // Main form background (layered)
        borderRadius: 16,
        padding: 24,
        shadowColor: themeColors.border, // Subtle shadow for depth
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5, // Android shadow
    },
    inputGroup: {
        width: '100%',
        marginBottom: 20,
    },
    inputLabel: {
        fontFamily: baseFontFamily,
        fontSize: 15,
        color: themeColors.textSecondary,
        marginBottom: 8,
        fontWeight: '500', // Slightly bolder label
    },
    input: {
        fontFamily: baseFontFamily,
        width: '100%',
        padding: 16,
        borderRadius: 10, // Slightly rounded inputs
        backgroundColor: themeColors.surfaceHighlight, // Input background (another layer/highlight)
        color: themeColors.text,
        fontSize: 16,
        borderWidth: StyleSheet.hairlineWidth, // Very thin border
        borderColor: themeColors.border,
        paddingHorizontal: 15, // Consistent padding
    },
    loginButton: {
        width: '100%',
        padding: 18,
        borderRadius: 12,
        backgroundColor: themeColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 25, // More space above button
        marginBottom: 10,
    },
    loginButtonText: {
        fontFamily: baseFontFamily,
        color: themeColors.background, // Text on primary button should be inverse for contrast
        fontSize: 18,
        fontWeight: 'bold',
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end', // Align to right
    },
    forgotPasswordText: {
        fontFamily: baseFontFamily,
        color: themeColors.primaryDark, // Use primaryDark for a subtle link
        fontSize: 14,
        fontWeight: '600',
    },
    signUpContainer: {
        flexDirection: 'row',
        marginTop: 40,
        // position: 'absolute', // Removed absolute positioning, rely on flexGrow for bottom alignment
        // bottom: 40,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    signUpText: {
        fontFamily: baseFontFamily,
        color: themeColors.textSecondary,
        fontSize: 15,
    },
    signUpLink: {
        fontFamily: baseFontFamily,
        color: themeColors.primary,
        fontSize: 15,
        fontWeight: 'bold',
    },
});

export default LoginScreen;