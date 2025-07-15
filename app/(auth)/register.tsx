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
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getThemeColors, Theme } from '@/theme/colors';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);

type UserRole = 'Arbeitnehmer' | 'Betrieb' | 'Rechnungsschreiber' | null;

// Helper component for role selection buttons
interface RoleOptionProps {
    label: string;
    icon: string;
    role: UserRole;
    selectedRole: UserRole;
    onSelect: (role: UserRole) => void;
}

const RoleOption: React.FC<RoleOptionProps> = ({ label, icon, role, selectedRole, onSelect }) => {
    const isSelected = selectedRole === role;
    return (
        <TouchableOpacity
            style={[
                styles.roleButton,
                isSelected && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '20' },
            ]}
            onPress={() => onSelect(role)}
        >
            <MaterialCommunityIcons
                name={icon as any} // 'as any' might be needed depending on MaterialCommunityIcons type definition
                size={24}
                color={isSelected ? themeColors.primary : themeColors.textSecondary}
            />
            <Text
                style={[
                    styles.roleButtonText,
                    isSelected && { color: themeColors.primary, fontWeight: 'bold' },
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
};

// Stylesheet definition
const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
});

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
    signUpButton: {
        width: '100%',
        padding: 18,
        borderRadius: 12,
        backgroundColor: themeColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 25,
        marginBottom: 10,
    },
    signUpButtonText: {
        fontFamily: baseFontFamily,
        color: themeColors.background,
        fontSize: 18,
        fontWeight: 'bold',
    },
    loginContainer: {
        flexDirection: 'row',
        marginTop: 40,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    loginText: {
        fontFamily: baseFontFamily,
        color: themeColors.textSecondary,
        fontSize: 15,
    },
    loginLink: {
        fontFamily: baseFontFamily,
        color: themeColors.primary,
        fontSize: 15,
        fontWeight: 'bold',
    },
    roleSelectionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        width: '100%',
    },
    roleButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: themeColors.border,
        backgroundColor: themeColors.surfaceHighlight,
        marginHorizontal: 4,
    },
    roleButtonText: {
        fontFamily: baseFontFamily,
        fontSize: 13,
        marginTop: 8,
        color: themeColors.textSecondary,
        textAlign: 'center',
    },
});

const RegisterScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState(''); // Used for 'Arbeitnehmer'
    const [fullName, setFullName] = useState(''); // Used for 'Betrieb' or 'Rechnungsschreiber'
    const [selectedRole, setSelectedRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignUp = async () => {
        setError(null);
        setLoading(true);

        if (!email || !password || !selectedRole) {
            setError('Please fill in all required fields and select your role.');
            setLoading(false);
            return;
        }

        let displayName = '';
        if (selectedRole === 'Arbeitnehmer') {
            if (!username) {
                setError('Please enter a username.');
                setLoading(false);
                return;
            }
            displayName = username;
        } else {
            if (!fullName) {
                setError('Please enter your full name or company name.');
                setLoading(false);
                return;
            }
            displayName = fullName;
        }

        try {
            const {
                data: { user },
                error: signUpError,
            } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        role: selectedRole,
                        username: username || fullName,
                        full_name: displayName,
                    },
                },
            });

            if (signUpError) {
                setError(signUpError.message);
                setLoading(false);
                return;
            }

            Alert.alert(
                'Registration Successful',
                'Please check your email to confirm your account.'
            );

            router.replace('/login');
        } catch (err: any) {
            console.error('Signup error:', err);
            setError(err.message || 'Unexpected error occurred.');
        } finally {
            setLoading(false);
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
                                <Text style={styles.title}>Join Agricrew!</Text>
                                <Text style={styles.subtitle}>Create your account to get started</Text>
                            </View>

                            {error && <Text style={styles.errorText}>{error}</Text>}

                            <View style={styles.formContainer}>
                                {/* Role Selection */}
                                <Text style={styles.inputLabel}>I am a...</Text>
                                <View style={styles.roleSelectionContainer}>
                                    <RoleOption
                                        label="Employee"
                                        icon="account"
                                        role="Arbeitnehmer"
                                        selectedRole={selectedRole}
                                        onSelect={setSelectedRole}
                                    />
                                    <RoleOption
                                        label="Farm/Business"
                                        icon="tractor"
                                        role="Betrieb"
                                        selectedRole={selectedRole}
                                        onSelect={setSelectedRole}
                                    />
                                    <RoleOption
                                        label="Accountant"
                                        icon="file-document-outline"
                                        role="Rechnungsschreiber"
                                        selectedRole={selectedRole}
                                        onSelect={setSelectedRole}
                                    />
                                </View>

                                {/* Conditional Input Fields based on Role */}
                                {selectedRole === 'Arbeitnehmer' && (
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Username</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., greenfarmer88"
                                            placeholderTextColor={themeColors.textHint}
                                            autoCapitalize="none"
                                            value={username}
                                            onChangeText={setUsername}
                                            editable={!loading}
                                        />
                                    </View>
                                )}

                                {(selectedRole === 'Betrieb' || selectedRole === 'Rechnungsschreiber') && (
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Full Name / Company Name</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., Muster GmbH"
                                            placeholderTextColor={themeColors.textHint}
                                            autoCapitalize="words"
                                            value={fullName}
                                            onChangeText={setFullName}
                                            editable={!loading}
                                        />
                                    </View>
                                )}

                                {/* Common Fields */}
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

                                <TouchableOpacity
                                    style={styles.signUpButton}
                                    onPress={handleSignUp}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color={themeColors.background} />
                                    ) : (
                                        <Text style={styles.signUpButtonText}>Sign Up</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.loginContainer}>
                                <Text style={styles.loginText}>Already have an account? </Text>
                                <TouchableOpacity onPress={() => router.replace('/login')}>
                                    <Text style={styles.loginLink}>Log In</Text>
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
};

export default RegisterScreen;