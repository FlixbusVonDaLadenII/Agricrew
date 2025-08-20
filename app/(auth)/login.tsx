import React, { useState, useMemo } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getThemeColors, Theme as AppTheme } from '@/theme/colors';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
});

const LoginScreen = () => {
    const osScheme = useColorScheme();
    const currentTheme: AppTheme = osScheme === 'dark' ? 'dark' : 'light';
    const themeColors = useMemo(() => getThemeColors(currentTheme), [currentTheme]);

    const { t, i18n } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [secure, setSecure] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setError(null);
        setLoading(true);

        if (!email || !password) {
            setError(t('login.errorEmailPassword'));
            setLoading(false);
            return;
        }

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                setError(signInError.message);
                if (signInError.message.includes('Email not confirmed')) {
                    Alert.alert(t('login.alertLoginFailed'), t('login.alertEmailNotConfirmed'));
                } else if (signInError.message.includes('Invalid login credentials')) {
                    Alert.alert(t('login.alertLoginFailed'), t('login.alertInvalidCredentials'));
                } else {
                    Alert.alert(t('login.alertLoginFailed'), signInError.message);
                }
            } else if (data.user) {
                router.replace('/(tabs)');
            } else {
                setError(t('login.errorUnexpected'));
            }
        } catch (err: any) {
            setError(err.message || t('login.errorUnexpected'));
            Alert.alert(t('login.errorTitle'), err.message || t('login.errorUnexpected'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={
                currentTheme === 'dark'
                    ? [themeColors.background, themeColors.surface]
                    : [themeColors.surface, themeColors.background]
            }
            style={styles.gradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                        <SafeAreaView style={styles.innerContainer}>
                            {/* Brand / Header */}
                            <View style={styles.headerContainer}>
                                <View style={[styles.logoWrap, { backgroundColor: themeColors.primary + '26' }]}>
                                    <MaterialCommunityIcons name="hand-wave-outline" size={28} color={themeColors.primary} />
                                </View>
                                <Text style={[styles.title, { color: themeColors.text }]}>{t('login.welcomeBack')}</Text>
                                <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                                    {t('login.subtitle')}
                                </Text>
                            </View>

                            {/* Lang toggle */}
                            <View style={[styles.langContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                                <TouchableOpacity
                                    style={[
                                        styles.langButton,
                                        i18n.language === 'en' && { backgroundColor: themeColors.primary },
                                    ]}
                                    onPress={() => i18n.changeLanguage('en')}
                                >
                                    <Text
                                        style={[
                                            styles.langButtonText,
                                            i18n.language === 'en' && { color: themeColors.background },
                                            { color: themeColors.textSecondary },
                                        ]}
                                    >
                                        {t('login.english')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.langButton,
                                        i18n.language === 'de' && { backgroundColor: themeColors.primary },
                                    ]}
                                    onPress={() => i18n.changeLanguage('de')}
                                >
                                    <Text
                                        style={[
                                            styles.langButtonText,
                                            i18n.language === 'de' && { color: themeColors.background },
                                            { color: themeColors.textSecondary },
                                        ]}
                                    >
                                        {t('login.german')}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Error banner */}
                            {!!error && (
                                <View style={[styles.errorBanner, { backgroundColor: themeColors.danger + '1A', borderColor: themeColors.danger }]}>
                                    <MaterialCommunityIcons name="alert-octagon-outline" size={18} color={themeColors.danger} />
                                    <Text style={[styles.errorText, { color: themeColors.danger }]}>{error}</Text>
                                </View>
                            )}

                            {/* Card */}
                            <View
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor: themeColors.surface,
                                        borderColor: themeColors.border,
                                        shadowColor: themeColors.shadow,
                                    },
                                ]}
                            >
                                {/* Email */}
                                <View style={styles.inputGroup}>
                                    <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('login.emailLabel')}</Text>
                                    <View
                                        style={[
                                            styles.inputShell,
                                            {
                                                backgroundColor: themeColors.surfaceHighlight,
                                                borderColor: themeColors.border,
                                            },
                                        ]}
                                    >
                                        <MaterialCommunityIcons
                                            name="email-outline"
                                            size={20}
                                            color={themeColors.textSecondary}
                                            style={styles.leadingIcon}
                                        />
                                        <TextInput
                                            style={[styles.input, { color: themeColors.text }]}
                                            placeholder={t('login.emailPlaceholder')}
                                            placeholderTextColor={themeColors.textHint}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            value={email}
                                            onChangeText={setEmail}
                                            editable={!loading}
                                            returnKeyType="next"
                                            textContentType="username"
                                        />
                                    </View>
                                </View>

                                {/* Password */}
                                <View style={styles.inputGroup}>
                                    <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('login.passwordLabel')}</Text>
                                    <View
                                        style={[
                                            styles.inputShell,
                                            {
                                                backgroundColor: themeColors.surfaceHighlight,
                                                borderColor: themeColors.border,
                                            },
                                        ]}
                                    >
                                        <MaterialCommunityIcons
                                            name="lock-outline"
                                            size={20}
                                            color={themeColors.textSecondary}
                                            style={styles.leadingIcon}
                                        />
                                        <TextInput
                                            style={[styles.input, { color: themeColors.text }]}
                                            placeholder={t('login.passwordPlaceholder')}
                                            placeholderTextColor={themeColors.textHint}
                                            secureTextEntry={secure}
                                            value={password}
                                            onChangeText={setPassword}
                                            editable={!loading}
                                            returnKeyType="go"
                                            textContentType="password"
                                        />
                                        <TouchableOpacity
                                            onPress={() => setSecure((s) => !s)}
                                            accessibilityRole="button"
                                            accessibilityLabel={secure ? t('login.showPassword') : t('login.hidePassword')}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            style={styles.trailingIconBtn}
                                        >
                                            <MaterialCommunityIcons
                                                name={secure ? 'eye-off-outline' : 'eye-outline'}
                                                size={20}
                                                color={themeColors.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Forgot */}
                                <TouchableOpacity
                                    style={styles.forgotPasswordButton}
                                    onPress={() => router.push('/(auth)/forgot-password')}
                                >
                                    <Text style={[styles.forgotPasswordText, { color: themeColors.primary }]}>
                                        {t('login.forgotPassword')}
                                    </Text>
                                </TouchableOpacity>

                                {/* CTA */}
                                <TouchableOpacity
                                    style={[
                                        styles.loginButton,
                                        {
                                            backgroundColor: loading ? themeColors.primaryDark : themeColors.primary,
                                            shadowColor: themeColors.primaryDark,
                                        },
                                    ]}
                                    onPress={handleLogin}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color={themeColors.background} />
                                    ) : (
                                        <Text style={[styles.loginButtonText, { color: themeColors.background }]}>
                                            {t('login.logInButton')}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Footer */}
                            <View style={styles.signUpContainer}>
                                <Text style={[styles.signUpText, { color: themeColors.textSecondary }]}>
                                    {t('login.noAccount')}{' '}
                                </Text>
                                <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                                    <Text style={[styles.signUpLink, { color: themeColors.primary }]}>{t('login.signUpLink')}</Text>
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
    gradientBackground: { flex: 1 },
    container: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 32,
    },
    innerContainer: { width: '100%', maxWidth: 560, alignItems: 'center' },

    headerContainer: { alignItems: 'center', marginBottom: 18 },
    logoWrap: {
        width: 52,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: { fontFamily: baseFontFamily, fontSize: 30, fontWeight: '800', letterSpacing: 0.2 },
    subtitle: { fontFamily: baseFontFamily, fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 4 },

    langContainer: {
        flexDirection: 'row',
        width: '100%',
        maxWidth: 400,
        borderRadius: 12,
        padding: 4,
        marginBottom: 14,
        borderWidth: StyleSheet.hairlineWidth,
    },
    langButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    langButtonText: { fontFamily: baseFontFamily, fontWeight: '700' },

    errorBanner: {
        width: '100%',
        maxWidth: 560,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    errorText: { fontFamily: baseFontFamily, fontSize: 13, flexShrink: 1 },

    card: {
        width: '100%',
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        borderWidth: StyleSheet.hairlineWidth,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 6,
    },

    inputGroup: { width: '100%', marginBottom: 16 },
    inputLabel: { fontFamily: baseFontFamily, fontSize: 14, marginBottom: 8, fontWeight: '600' },

    inputShell: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 10,
    },
    leadingIcon: { marginRight: 6 },
    trailingIconBtn: { padding: 6, marginLeft: 4 },
    input: {
        flex: 1,
        fontFamily: baseFontFamily,
        paddingVertical: 14,
        fontSize: 16,
    },

    forgotPasswordButton: { alignSelf: 'flex-end', marginTop: 4 },
    forgotPasswordText: { fontFamily: baseFontFamily, fontSize: 14, fontWeight: '700' },

    loginButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
    },
    loginButtonText: { fontFamily: baseFontFamily, fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },

    signUpContainer: { flexDirection: 'row', marginTop: 26, alignItems: 'center', justifyContent: 'center' },
    signUpText: { fontFamily: baseFontFamily, fontSize: 15 },
    signUpLink: { fontFamily: baseFontFamily, fontSize: 15, fontWeight: '800' },
});

export default LoginScreen;