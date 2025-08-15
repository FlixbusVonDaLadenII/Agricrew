// app/(auth)/subscribe.tsx - FREE ACCESS VERSION

import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    SafeAreaView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { getThemeColors, Theme } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/SessionProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
// NOTE: All 'expo-in-app-purchases' imports are removed in this version.

// ===== Theme setup =====
const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);
const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
});

// ===== Types =====
type Profile = { role: string } | null;
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// ===== Subscription Plans (used for display only) =====
const subscriptionPlans = {
    employee: { id: 'employee_yearly', icon: 'account-hard-hat' as IconName },
    admin: { id: 'admin_monthly', icon: 'file-document-outline' as IconName },
    farm_s: { id: 'farm_s', icon: 'tractor-variant' as IconName },
    farm_m: { id: 'farm_m', icon: 'tractor-variant' as IconName },
    farm_l: { id: 'farm_l', icon: 'tractor-variant' as IconName },
    farm_s_yearly: { id: 'farm_s_yearly', icon: 'tractor-variant' as IconName },
    farm_m_yearly: { id: 'farm_m_yearly', icon: 'tractor-variant' as IconName },
    farm_l_yearly: { id: 'farm_l_yearly', icon: 'tractor-variant' as IconName },
} as const;

// ===== PlanCard Component =====
const PlanCard: React.FC<any> = ({ plan, onSelect, isSelected, t }) => {
    const details = t(`subscribe.plans.${plan.id}`, { returnObjects: true });
    // Prices are now only taken from your JSON files for display
    const displayPrice = details.price;

    return (
        <TouchableOpacity
            style={[styles.planCard, isSelected && styles.selectedPlan]}
            onPress={() => onSelect(plan.id)}
        >
            <MaterialCommunityIcons
                name={plan.icon}
                size={32}
                color={isSelected ? themeColors.primary : themeColors.textSecondary}
            />
            <Text style={styles.planTitle}>{details.title}</Text>
            <View style={styles.priceContainer}>
                <Text style={styles.price}>{displayPrice}</Text>
                <Text style={styles.period}>{details.period}</Text>
            </View>
            <View style={styles.featuresContainer}>
                {details.features.map((feature: string) => (
                    <View key={feature} style={styles.featureItem}>
                        <MaterialCommunityIcons name="check" size={16} color={themeColors.success} />
                        <Text style={styles.featureText}>{feature}</Text>
                    </View>
                ))}
            </View>
        </TouchableOpacity>
    );
};

// ===== Main Screen =====
export default function SubscriptionScreen() {
    const { t } = useTranslation();
    const { session } = useSession();

    const [profile, setProfile] = useState<Profile>(null);
    const [loading, setLoading] = useState(true);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isYearly, setIsYearly] = useState(false);

    // This function now calls your new Supabase RPC to grant free access
    const handlePurchase = async () => {
        if (!selectedPlanId) return;
        setIsSubscribing(true);

        const { error } = await supabase.rpc('grant_free_access', {
            plan_id: selectedPlanId,
        });

        setIsSubscribing(false);

        if (error) {
            console.error('Error granting free access:', error);
            Alert.alert("Error", "Could not activate your free plan. Please try again.");
        } else {
            // Success! Navigate user into the app.
            router.replace('/(tabs)');
        }
    };

    useEffect(() => {
        if (session?.user) {
            supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single()
                .then(({ data, error }) => {
                    if (error) {
                        Alert.alert(t('subscribe.errorTitle'), t('subscribe.profileError'));
                    } else if (data) {
                        setProfile(data);
                        if (data.role === 'Arbeitnehmer') setSelectedPlanId('employee_yearly');
                        if (data.role === 'Rechnungsschreiber') setSelectedPlanId('admin_monthly');
                    }
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [session, t]);

    const renderPlans = () => {
        if (loading) {
            return <ActivityIndicator size="large" color={themeColors.primary} style={{ marginTop: 40 }} />;
        }
        if (!profile) {
            return <Text style={styles.subtitle}>{t('subscribe.profileError')}</Text>;
        }

        switch (profile.role) {
            case 'Arbeitnehmer':
                return <PlanCard plan={subscriptionPlans.employee} onSelect={setSelectedPlanId} isSelected t={t} />;
            case 'Rechnungsschreiber':
                return <PlanCard plan={subscriptionPlans.admin} onSelect={setSelectedPlanId} isSelected t={t} />;
            case 'Betrieb':
                const farmPlans = isYearly
                    ? [subscriptionPlans.farm_s_yearly, subscriptionPlans.farm_m_yearly, subscriptionPlans.farm_l_yearly]
                    : [subscriptionPlans.farm_s, subscriptionPlans.farm_m, subscriptionPlans.farm_l];
                return (
                    <>
                        <View style={styles.toggleContainer}>
                            <Text style={styles.toggleLabel}>{t('subscribe.monthly')}</Text>
                            <Switch
                                value={isYearly}
                                onValueChange={(value) => {
                                    setIsYearly(value);
                                    setSelectedPlanId(null);
                                }}
                                trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary }}
                                thumbColor={themeColors.background}
                            />
                            <Text style={styles.toggleLabel}>{t('subscribe.yearly')}</Text>
                            <View style={styles.saveBadge}>
                                <Text style={styles.saveBadgeText}>{t('subscribe.save10')}</Text>
                            </View>
                        </View>
                        {farmPlans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                onSelect={setSelectedPlanId}
                                isSelected={selectedPlanId === plan.id}
                                t={t}
                            />
                        ))}
                    </>
                );
            default:
                return <Text style={styles.subtitle}>{t('subscribe.noPlans')}</Text>;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <MaterialCommunityIcons name="shield-lock-outline" size={60} color={themeColors.primary} />
                <Text style={styles.title}>{t('subscribe.title')}</Text>
                <Text style={styles.subtitle}>
                    {t('subscribe.subtitle')}
                    <Text style={{ fontWeight: 'bold' }}>
                        {profile?.role ? ` ${t(`roles.${profile.role}`)}` : ''}
                    </Text>.
                </Text>
                {renderPlans()}
            </ScrollView>
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.purchaseButton, (!selectedPlanId || isSubscribing) && styles.disabledButton]}
                    onPress={handlePurchase}
                    disabled={loading || isSubscribing || !selectedPlanId}
                >
                    {isSubscribing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>{t('subscribe.buttonText')}</Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={() => supabase.auth.signOut()}
                >
                    <Text style={styles.logoutText}>{t('subscribe.logout')}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// ===== Styles =====
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    scrollContent: {
        alignItems: 'center',
        padding: 24,
        paddingBottom: 150,
    },
    title: {
        fontFamily: baseFontFamily,
        fontSize: 28,
        fontWeight: 'bold',
        color: themeColors.text,
        marginVertical: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: baseFontFamily,
        fontSize: 16,
        color: themeColors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    planCard: {
        width: '100%',
        backgroundColor: themeColors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: themeColors.border,
        alignItems: 'center',
        overflow: 'hidden',
    },
    selectedPlan: {
        borderColor: themeColors.primary,
        backgroundColor: themeColors.primary + '1A',
    },
    planTitle: {
        fontFamily: baseFontFamily,
        fontSize: 20,
        fontWeight: 'bold',
        color: themeColors.text,
        marginTop: 12,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginVertical: 8,
    },
    price: {
        fontFamily: baseFontFamily,
        fontSize: 36,
        fontWeight: 'bold',
        color: themeColors.text,
    },
    period: {
        fontFamily: baseFontFamily,
        fontSize: 16,
        color: themeColors.textSecondary,
        marginLeft: 6,
    },
    featuresContainer: {
        alignSelf: 'stretch',
        marginTop: 12,
        paddingLeft: 10,
    },
    featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    featureText: {
        fontFamily: baseFontFamily,
        fontSize: 15,
        color: themeColors.text,
        marginLeft: 10,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingTop: 12,
        backgroundColor: themeColors.background,
        borderTopWidth: 1,
        borderTopColor: themeColors.border,
    },
    purchaseButton: {
        width: '100%',
        backgroundColor: themeColors.primary,
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: { backgroundColor: themeColors.surfaceHighlight },
    buttonText: {
        fontFamily: baseFontFamily,
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    logoutButton: { marginTop: 16, alignItems: 'center' },
    logoutText: { color: themeColors.textSecondary, fontSize: 14 },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: themeColors.surface,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: themeColors.text,
        marginHorizontal: 8,
    },
    saveBadge: {
        backgroundColor: themeColors.success,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 12,
    },
    saveBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});