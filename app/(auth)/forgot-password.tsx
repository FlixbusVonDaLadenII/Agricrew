import React, { useState } from 'react';
import {
    StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator,
    SafeAreaView, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, ScrollView, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getThemeColors, Theme } from '@/theme/colors';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);
const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

const ForgotPasswordScreen = () => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePasswordReset = async () => {
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://agri-crew.de/reset-password.html', // This is the corrected URL
        });

        setLoading(false);
        if (error) {
            Alert.alert(t('forgotPassword.errorTitle'), t('forgotPassword.errorMessage'));
            console.error('Password reset error:', error);
        } else {
            Alert.alert(t('forgotPassword.successTitle'), t('forgotPassword.successMessage'));
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
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                        <SafeAreaView style={styles.innerContainer}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                                <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.text} />
                            </TouchableOpacity>
                            <View style={styles.headerContainer}>
                                <Text style={styles.title}>{t('forgotPassword.title')}</Text>
                                <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>
                            </View>

                            <View style={styles.formContainer}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>{t('forgotPassword.emailLabel')}</Text>
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

                                <TouchableOpacity style={styles.submitButton} onPress={handlePasswordReset} disabled={loading}>
                                    {loading ? <ActivityIndicator color={themeColors.background} /> : <Text style={styles.submitButtonText}>{t('forgotPassword.buttonText')}</Text>}
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity onPress={() => router.replace('/login')}>
                                <Text style={styles.backToLoginLink}>{t('forgotPassword.backToLogin')}</Text>
                            </TouchableOpacity>
                        </SafeAreaView>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
};

// Styles are very similar to LoginScreen for consistency
const styles = StyleSheet.create({
    gradientBackground: { flex: 1 },
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
    innerContainer: { width: '100%', alignItems: 'center' },
    backButton: { position: 'absolute', top: 0, left: 0, padding: 10, zIndex: 10 },
    headerContainer: { marginBottom: 48, alignItems: 'center' },
    title: { fontFamily: baseFontFamily, fontSize: 36, fontWeight: 'bold', color: themeColors.text, marginBottom: 8 },
    subtitle: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, textAlign: 'center', lineHeight: 24 },
    formContainer: { width: '100%', backgroundColor: themeColors.surface, borderRadius: 16, padding: 24, shadowColor: themeColors.border, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    inputGroup: { width: '100%', marginBottom: 20 },
    inputLabel: { fontFamily: baseFontFamily, fontSize: 15, color: themeColors.textSecondary, marginBottom: 8, fontWeight: '500' },
    input: { fontFamily: baseFontFamily, width: '100%', padding: 16, borderRadius: 10, backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, fontSize: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: themeColors.border, paddingHorizontal: 15 },
    submitButton: { width: '100%', padding: 18, borderRadius: 12, backgroundColor: themeColors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    submitButtonText: { fontFamily: baseFontFamily, color: themeColors.background, fontSize: 18, fontWeight: 'bold' },
    backToLoginLink: { fontFamily: baseFontFamily, color: themeColors.primary, fontSize: 15, fontWeight: 'bold', marginTop: 40 },
});

export default ForgotPasswordScreen;