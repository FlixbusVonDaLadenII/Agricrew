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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getThemeColors, Theme as AppTheme } from '@/theme/colors';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

type UserRole = 'Arbeitnehmer' | 'Betrieb' | 'Rechnungsschreiber' | null;

const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

type RoleCardProps = {
    label: string;
    icon: any;
    role: UserRole;
    selectedRole: UserRole;
    onSelect: (r: UserRole) => void;
    themeColors: ReturnType<typeof getThemeColors>;
};

const RoleCard: React.FC<RoleCardProps> = ({ label, icon, role, selectedRole, onSelect, themeColors }) => {
    const active = selectedRole === role;
    return (
        <TouchableOpacity
            onPress={() => onSelect(role)}
            style={[
                styles.roleCard,
                { borderColor: themeColors.border, backgroundColor: themeColors.surfaceHighlight },
                active && { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '1A' },
            ]}
            activeOpacity={0.9}
        >
            <View style={[styles.roleIconWrap, { backgroundColor: active ? themeColors.primary + '26' : themeColors.surface }]}>
                <MaterialCommunityIcons name={icon} size={22} color={active ? themeColors.primary : themeColors.textSecondary} />
            </View>
            <Text
                style={[
                    styles.roleLabel,
                    { color: active ? themeColors.primary : themeColors.textSecondary },
                    active && { fontWeight: '700' },
                ]}
                numberOfLines={2}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
};

export default function RegisterScreen() {
    const osScheme = useColorScheme();
    const currentTheme: AppTheme = osScheme === 'dark' ? 'dark' : 'light';
    const themeColors = useMemo(() => getThemeColors(currentTheme), [currentTheme]);

    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [secure, setSecure] = useState(true);
    const [username, setUsername] = useState('');
    const [fullName, setFullName] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignUp = async () => {
        setError(null);
        setLoading(true);

        if (!email || !password || !selectedRole) {
            setError(t('register.errorAllFields'));
            setLoading(false);
            return;
        }
        if (selectedRole === 'Arbeitnehmer' && !username) {
            setError(t('register.errorUsername'));
            setLoading(false);
            return;
        }
        if (selectedRole !== 'Arbeitnehmer' && !fullName) {
            setError(t('register.errorFullName'));
            setLoading(false);
            return;
        }

        try {
            const userMetaData = {
                role: selectedRole,
                username: selectedRole === 'Arbeitnehmer' ? username : null,
                full_name: selectedRole !== 'Arbeitnehmer' ? fullName : null,
            };

            const { data: { user }, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: { data: userMetaData },
            });

            if (signUpError) {
                setError(signUpError.message);
                setLoading(false);
                return;
            }

            if (user) {
                Alert.alert(t('register.successTitle'), t('register.successMessage'));
                router.replace('/(auth)/login');
            }
        } catch (err: any) {
            setError(err.message || t('register.errorAllFields'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={currentTheme === 'dark' ? [themeColors.background, themeColors.surface] : [themeColors.surface, themeColors.background]}
            style={styles.gradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                        <SafeAreaView style={styles.innerContainer}>
                            {/* Header */}
                            <View style={styles.headerContainer}>
                                <View style={[styles.logoWrap, { backgroundColor: themeColors.primary + '26' }]}>
                                    <MaterialCommunityIcons name="account-plus-outline" size={26} color={themeColors.primary} />
                                </View>
                                <Text style={[styles.title, { color: themeColors.text }]}>{t('register.title')}</Text>
                                <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{t('register.subtitle')}</Text>
                            </View>

                            {/* Error */}
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
                                {/* Roles */}
                                <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>{t('register.iAmA')}</Text>
                                <View style={styles.roleRow}>
                                    <RoleCard
                                        label={t('register.roleEmployee')}
                                        icon="account"
                                        role="Arbeitnehmer"
                                        selectedRole={selectedRole}
                                        onSelect={setSelectedRole}
                                        themeColors={themeColors}
                                    />
                                    <RoleCard
                                        label={t('register.roleFarm')}
                                        icon="tractor"
                                        role="Betrieb"
                                        selectedRole={selectedRole}
                                        onSelect={setSelectedRole}
                                        themeColors={themeColors}
                                    />
                                    <RoleCard
                                        label={t('register.roleAccountant')}
                                        icon="file-document-outline"
                                        role="Rechnungsschreiber"
                                        selectedRole={selectedRole}
                                        onSelect={setSelectedRole}
                                        themeColors={themeColors}
                                    />
                                </View>

                                {/* Conditional fields */}
                                {selectedRole === 'Arbeitnehmer' && (
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('register.usernameLabel')}</Text>
                                        <View style={[styles.inputShell, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border }]}>
                                            <MaterialCommunityIcons name="account-outline" size={20} color={themeColors.textSecondary} style={styles.leadingIcon} />
                                            <TextInput
                                                style={[styles.input, { color: themeColors.text }]}
                                                placeholder={t('register.usernamePlaceholder')}
                                                placeholderTextColor={themeColors.textHint}
                                                autoCapitalize="none"
                                                value={username}
                                                onChangeText={setUsername}
                                                editable={!loading}
                                                returnKeyType="next"
                                            />
                                        </View>
                                    </View>
                                )}

                                {(selectedRole === 'Betrieb' || selectedRole === 'Rechnungsschreiber') && (
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('register.fullNameLabel')}</Text>
                                        <View style={[styles.inputShell, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border }]}>
                                            <MaterialCommunityIcons name="card-account-details-outline" size={20} color={themeColors.textSecondary} style={styles.leadingIcon} />
                                            <TextInput
                                                style={[styles.input, { color: themeColors.text }]}
                                                placeholder={t('register.fullNamePlaceholder')}
                                                placeholderTextColor={themeColors.textHint}
                                                autoCapitalize="words"
                                                value={fullName}
                                                onChangeText={setFullName}
                                                editable={!loading}
                                                returnKeyType="next"
                                            />
                                        </View>
                                    </View>
                                )}

                                {/* Email */}
                                <View style={styles.inputGroup}>
                                    <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('register.emailLabel')}</Text>
                                    <View style={[styles.inputShell, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border }]}>
                                        <MaterialCommunityIcons name="email-outline" size={20} color={themeColors.textSecondary} style={styles.leadingIcon} />
                                        <TextInput
                                            style={[styles.input, { color: themeColors.text }]}
                                            placeholder={t('register.emailPlaceholder')}
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
                                    <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('register.passwordLabel')}</Text>
                                    <View style={[styles.inputShell, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border }]}>
                                        <MaterialCommunityIcons name="lock-outline" size={20} color={themeColors.textSecondary} style={styles.leadingIcon} />
                                        <TextInput
                                            style={[styles.input, { color: themeColors.text }]}
                                            placeholder={t('register.passwordPlaceholder')}
                                            placeholderTextColor={themeColors.textHint}
                                            secureTextEntry={secure}
                                            value={password}
                                            onChangeText={setPassword}
                                            editable={!loading}
                                            returnKeyType="go"
                                            textContentType="newPassword"
                                        />
                                        <TouchableOpacity onPress={() => setSecure((s) => !s)} style={styles.trailingIconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <MaterialCommunityIcons
                                                name={secure ? 'eye-off-outline' : 'eye-outline'}
                                                size={20}
                                                color={themeColors.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* CTA */}
                                <TouchableOpacity
                                    style={[
                                        styles.primaryButton,
                                        { backgroundColor: themeColors.primary, shadowColor: themeColors.primaryDark },
                                    ]}
                                    onPress={handleSignUp}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color={themeColors.background} />
                                    ) : (
                                        <Text style={[styles.primaryButtonText, { color: themeColors.background }]}>
                                            {t('register.signUpButton')}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Footer */}
                            <View style={styles.footerRow}>
                                <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>
                                    {t('register.alreadyHaveAccount')}{' '}
                                </Text>
                                <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                                    <Text style={[styles.footerLink, { color: themeColors.primary }]}>{t('register.logInLink')}</Text>
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientBackground: { flex: 1 },
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 32 },
    innerContainer: { width: '100%', maxWidth: 560, alignItems: 'center' },

    headerContainer: { alignItems: 'center', marginBottom: 18 },
    logoWrap: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    title: { fontFamily: baseFontFamily, fontSize: 30, fontWeight: '800', letterSpacing: 0.2 },
    subtitle: { fontFamily: baseFontFamily, fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 4 },

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
        borderRadius: 16,
        padding: 18,
        borderWidth: StyleSheet.hairlineWidth,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 6,
    },

    sectionLabel: { fontFamily: baseFontFamily, fontSize: 14, marginBottom: 10, fontWeight: '700', letterSpacing: 0.2 },

    roleRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    roleCard: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 2,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    roleIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
    },
    roleLabel: { fontFamily: baseFontFamily, fontSize: 12, textAlign: 'center' },

    inputGroup: { width: '100%', marginBottom: 14 },
    inputLabel: { fontFamily: baseFontFamily, fontSize: 13, marginBottom: 8, fontWeight: '700', letterSpacing: 0.2 },
    inputShell: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 10,
    },
    leadingIcon: { marginRight: 6 },
    trailingIconBtn: { padding: 6, marginLeft: 4 },
    input: { flex: 1, fontFamily: baseFontFamily, paddingVertical: 14, fontSize: 16 },

    primaryButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
    },
    primaryButtonText: { fontFamily: baseFontFamily, fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },

    footerRow: { flexDirection: 'row', marginTop: 26, alignItems: 'center', justifyContent: 'center' },
    footerText: { fontFamily: baseFontFamily, fontSize: 15 },
    footerLink: { fontFamily: baseFontFamily, fontSize: 15, fontWeight: '800' },
});