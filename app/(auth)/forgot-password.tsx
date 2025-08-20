import React, { useMemo, useState } from 'react';
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
    useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getThemeColors, type Theme } from '@/theme/colors';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

export default function ForgotPasswordScreen() {
    const { t } = useTranslation();
    const scheme = useColorScheme();
    const colors = getThemeColors(((scheme || 'light') as Theme));
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePasswordReset = async () => {
        if (!email.trim()) {
            Alert.alert(t('forgotPassword.errorTitle'), t('forgotPassword.enterEmail') || 'Please enter your email.');
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: 'https://agri-crew.de/reset-password.html',
        });
        setLoading(false);

        if (error) {
            console.error('Password reset error:', error);
            Alert.alert(t('forgotPassword.errorTitle'), t('forgotPassword.errorMessage'));
        } else {
            Alert.alert(t('forgotPassword.successTitle'), t('forgotPassword.successMessage'));
        }
    };

    return (
        <LinearGradient
            colors={[colors.background, colors.surface]}
            style={styles.gradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                        <SafeAreaView style={styles.innerContainer}>
                            {/* Back */}
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
                                <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                            </TouchableOpacity>

                            {/* Header */}
                            <View style={styles.logoWrap}>
                                <View style={styles.logoBadge}>
                                    <MaterialCommunityIcons name="lock-reset" size={22} color={colors.primary} />
                                </View>
                            </View>
                            <View style={styles.headerContainer}>
                                <Text style={styles.title}>{t('forgotPassword.title')}</Text>
                                <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>
                            </View>

                            {/* Form card */}
                            <View style={styles.formContainer}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>{t('forgotPassword.emailLabel')}</Text>
                                    <View style={styles.inputWithIcon}>
                                        <MaterialCommunityIcons
                                            name="email-outline"
                                            size={20}
                                            color={colors.textSecondary}
                                            style={{ marginRight: 10 }}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="name@example.com"
                                            placeholderTextColor={colors.textHint}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            value={email}
                                            onChangeText={setEmail}
                                            editable={!loading}
                                            returnKeyType="send"
                                            onSubmitEditing={handlePasswordReset}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.submitButton} onPress={handlePasswordReset} disabled={loading}>
                                    {loading ? (
                                        <ActivityIndicator color={colors.background} />
                                    ) : (
                                        <Text style={styles.submitButtonText}>{t('forgotPassword.buttonText')}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Back to login */}
                            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.backToLoginContainer}>
                                <MaterialCommunityIcons name="login" size={18} color={colors.primary} />
                                <Text style={styles.backToLoginLink}>{t('forgotPassword.backToLogin')}</Text>
                            </TouchableOpacity>
                        </SafeAreaView>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

function makeStyles(colors: ReturnType<typeof getThemeColors>) {
    return StyleSheet.create({
        gradientBackground: { flex: 1 },
        container: { flex: 1 },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingVertical: 40,
        },
        innerContainer: { width: '100%', alignItems: 'center' },

        backButton: {
            position: 'absolute',
            top: 8,
            left: 8,
            padding: 10,
            borderRadius: 24,
            backgroundColor: colors.surfaceHighlight,
        },

        logoWrap: { marginBottom: 6, marginTop: 12 },
        logoBadge: {
            backgroundColor: colors.primaryLight + '33',
            width: 56,
            height: 56,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },

        headerContainer: { marginBottom: 18, alignItems: 'center', paddingHorizontal: 16 },
        title: { fontFamily: baseFontFamily, fontSize: 30, fontWeight: 'bold', color: colors.text, marginBottom: 6 },
        subtitle: { fontFamily: baseFontFamily, fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

        formContainer: {
            width: '100%',
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 5,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
        },

        inputGroup: { width: '100%', marginBottom: 18 },
        inputLabel: { fontFamily: baseFontFamily, fontSize: 14, color: colors.textSecondary, marginBottom: 8, fontWeight: '500' },
        inputWithIcon: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceHighlight,
            borderRadius: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 14 : 10,
        },
        input: { flex: 1, fontFamily: baseFontFamily, color: colors.text, fontSize: 16 },

        submitButton: {
            width: '100%',
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.primaryDark,
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 6,
        },
        submitButtonText: { fontFamily: baseFontFamily, color: colors.background, fontSize: 17, fontWeight: '700' },

        backToLoginContainer: { flexDirection: 'row', marginTop: 28, alignItems: 'center', justifyContent: 'center' },
        backToLoginLink: { fontFamily: baseFontFamily, color: colors.primary, fontSize: 15, fontWeight: '600', marginLeft: 6 },
    });
}