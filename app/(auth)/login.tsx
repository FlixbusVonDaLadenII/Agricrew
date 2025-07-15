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
    ScrollView,
    Alert, // <-- Added Alert for user feedback
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getThemeColors, Theme } from '@/theme/colors';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase'; // <-- Ensure this import is correct

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
        setError(null); // Clear any previous errors
        setLoading(true); // Start loading indicator

        // Basic client-side validation
        if (!email || !password) {
            setError('Please enter both your email and password.');
            setLoading(false);
            return;
        }

        try {
            // Use Supabase's signInWithPassword method
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (signInError) {
                // Supabase will return specific error messages (e.g., "Invalid login credentials")
                setError(signInError.message);
                console.error('Supabase Login Error:', signInError.message);

                // Provide a more user-friendly alert based on common errors
                if (signInError.message.includes('Email not confirmed')) {
                    Alert.alert('Login Failed', 'Please check your email to confirm your account.');
                } else if (signInError.message.includes('Invalid login credentials')) {
                    Alert.alert('Login Failed', 'Invalid email or password. Please try again.');
                } else {
                    Alert.alert('Login Failed', signInError.message);
                }
            } else if (data.user) {
                // Login successful. The user object will be present.
                console.log('Login successful for user:', data.user.email);
                Alert.alert('Success', 'You are now logged in!');
                router.replace('/(tabs)'); // Navigate to the main authenticated part of your app
            } else {
                // This case should theoretically not be hit if there's no error and no user.
                // It's a fallback for unexpected API responses.
                setError('An unexpected error occurred during login. No user data received.');
                console.warn('Login returned no user and no explicit error.');
            }
        } catch (err: any) {
            // Catch any unexpected network issues or other general errors
            setError(err.message || 'An unexpected error occurred.');
            console.error('General login error:', err);
            Alert.alert('Error', err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false); // Stop loading indicator regardless of outcome
        }
    };

    return (
        <LinearGradient
            colors={[themeColors.background, themeColors.surface]}
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
                        keyboardShouldPersistTaps="handled"
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

                                {/* You might want to implement Forgot Password functionality later */}
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
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    innerContainer: {
        width: '100%',
        alignItems: 'center',
    },
    headerContainer: {
        marginBottom: 48,
        alignItems: 'center',
    },
    title: {
        fontFamily: baseFontFamily,
        fontSize: 36,
        fontWeight: 'bold',
        color: themeColors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontFamily: baseFontFamily,
        fontSize: 18,
        color: themeColors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    errorText: {
        fontFamily: baseFontFamily,
        fontSize: 14,
        color: themeColors.danger,
        marginBottom: 20,
        textAlign: 'center',
        backgroundColor: 'rgba(220, 53, 69, 0.1)',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
        width: '100%',
    },
    formContainer: {
        width: '100%',
        backgroundColor: themeColors.surface,
        borderRadius: 16,
        padding: 24,
        shadowColor: themeColors.border,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
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
        fontWeight: '500',
    },
    input: {
        fontFamily: baseFontFamily,
        width: '100%',
        padding: 16,
        borderRadius: 10,
        backgroundColor: themeColors.surfaceHighlight,
        color: themeColors.text,
        fontSize: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themeColors.border,
        paddingHorizontal: 15,
    },
    loginButton: {
        width: '100%',
        padding: 18,
        borderRadius: 12,
        backgroundColor: themeColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 25,
        marginBottom: 10,
    },
    loginButtonText: {
        fontFamily: baseFontFamily,
        color: themeColors.background,
        fontSize: 18,
        fontWeight: 'bold',
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
    },
    forgotPasswordText: {
        fontFamily: baseFontFamily,
        color: themeColors.primaryDark,
        fontSize: 14,
        fontWeight: '600',
    },
    signUpContainer: {
        flexDirection: 'row',
        marginTop: 40,
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