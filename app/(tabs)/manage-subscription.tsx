// In: app/(tabs)/manage-subscription.tsx

import React, { useState, useCallback } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';

// ===== Theme setup =====
const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);
const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

// ===== Types =====
type Profile = { role: string } | null;
type Subscription = { role: string | null } | null;
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
const PlanCard: React.FC<any> = ({ plan, onSelect, isSelected, isActive, t }) => {
    const details = t(`subscribe.plans.${plan.id}`, { returnObjects: true });
    const displayPrice = details.price;

    return (
        <TouchableOpacity
            style={[styles.planCard, isSelected && styles.selectedPlan, isActive && styles.activePlan]}
            onPress={() => onSelect(plan.id)}
        >
            {isActive && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Aktiv</Text></View>}
            <MaterialCommunityIcons name={plan.icon} size={32} color={isSelected || isActive ? themeColors.primary : themeColors.textSecondary} />
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
export default function ManageSubscriptionScreen() {
    const { t } = useTranslation();
    const { session } = useSession();

    const [profile, setProfile] = useState<Profile>(null);
    const [subscription, setSubscription] = useState<Subscription>(null);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isYearly, setIsYearly] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const fetchInitialData = async () => {
                if (session?.user) {
                    setLoading(true);
                    try {
                        const { data: profileData } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
                        setProfile(profileData);

                        const { data: subData } = await supabase
                            .from('user_subscriptions')
                            .select('role') // Fetch 'role' which stores the plan_id
                            .eq('user_id', session.user.id)
                            .eq('is_active', true) // Check 'is_active' column
                            .single();

                        setSubscription(subData);
                        setSelectedPlanId(subData?.role || null);

                    } catch (e) {
                        Alert.alert("Fehler", "Daten konnten nicht geladen werden.");
                    } finally {
                        setLoading(false);
                    }
                }
            };
            fetchInitialData();
        }, [session])
    );

    const handleUpdatePlan = async () => {
        if (!session?.user || !selectedPlanId || selectedPlanId === subscription?.role) return;
        setIsUpdating(true);

        try {
            if (subscription) {
                // Update existing subscription
                const { error } = await supabase
                    .from('user_subscriptions')
                    .update({ role: selectedPlanId })
                    .eq('user_id', session.user.id)
                    .eq('is_active', true);

                if (error) throw error;
            } else {
                // Create new subscription
                const { error } = await supabase.from('user_subscriptions').insert({
                    user_id: session.user.id,
                    role: selectedPlanId,
                    is_active: true,
                });

                if (error) throw error;
            }

            setSubscription({ role: selectedPlanId });
            Alert.alert("Erfolg", "Dein Plan wurde aktualisiert.");
        } catch (error) {
            console.error(error);
            Alert.alert("Fehler", "Dein Plan konnte nicht aktualisiert werden.");
        } finally {
            setIsUpdating(false);
        }
    };



    const renderPlans = () => {
        if (loading) {
            return <ActivityIndicator size="large" color={themeColors.primary} style={{ marginTop: 40 }} />;
        }
        if (!profile) {
            return <Text style={styles.subtitle}>{t('subscribe.profileError')}</Text>;
        }

        switch (profile.role) {
            case 'Arbeitnehmer':
            case 'Rechnungsschreiber':
                const planKey = profile.role === 'Arbeitnehmer' ? 'employee' : 'admin';
                const plan = subscriptionPlans[planKey];
                return <PlanCard plan={plan} onSelect={() => {}} isSelected={false} isActive={true} t={t} />;
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
                                onValueChange={setIsYearly}
                                trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary }}
                                thumbColor={themeColors.background}
                            />
                            <Text style={styles.toggleLabel}>{t('subscribe.yearly')}</Text>
                        </View>
                        {farmPlans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                onSelect={setSelectedPlanId}
                                isSelected={selectedPlanId === plan.id}
                                isActive={subscription?.role === plan.id}
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
                <MaterialCommunityIcons name="credit-card-settings-outline" size={60} color={themeColors.primary} />
                <Text style={styles.title}>Abonnement verwalten</Text>
                <Text style={styles.subtitle}>Hier sehen Sie Ihren aktuellen Plan und können ihn wechseln.</Text>
                {renderPlans()}
            </ScrollView>
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.purchaseButton,
                        (!selectedPlanId || isUpdating || selectedPlanId === subscription?.role) && styles.disabledButton,
                    ]}
                    onPress={handleUpdatePlan}
                    disabled={loading || isUpdating || !selectedPlanId || selectedPlanId === subscription?.role}
                >
                    {isUpdating ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Plan wechseln</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// ===== Styles =====
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    scrollContent: { alignItems: 'center', padding: 24, paddingBottom: 150 },
    title: { fontFamily: baseFontFamily, fontSize: 28, fontWeight: 'bold', color: themeColors.text, marginVertical: 16, textAlign: 'center' },
    subtitle: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
    planCard: { width: '100%', backgroundColor: themeColors.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 2, borderColor: themeColors.border, alignItems: 'center', overflow: 'hidden' },
    selectedPlan: { borderColor: themeColors.primary },
    activePlan: { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '1A' },
    planTitle: { fontFamily: baseFontFamily, fontSize: 20, fontWeight: 'bold', color: themeColors.text, marginTop: 12 },
    priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginVertical: 8 },
    price: { fontFamily: baseFontFamily, fontSize: 36, fontWeight: 'bold', color: themeColors.text },
    period: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, marginLeft: 6 },
    featuresContainer: { alignSelf: 'stretch', marginTop: 12, paddingLeft: 10 },
    featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    featureText: { fontFamily: baseFontFamily, fontSize: 15, color: themeColors.text, marginLeft: 10 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingTop: 12, backgroundColor: themeColors.background, borderTopWidth: 1, borderTopColor: themeColors.border },
    purchaseButton: { width: '100%', backgroundColor: themeColors.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
    disabledButton: { backgroundColor: themeColors.surfaceHighlight },
    buttonText: { fontFamily: baseFontFamily, color: '#fff', fontSize: 18, fontWeight: 'bold' },
    toggleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, backgroundColor: themeColors.surface, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
    toggleLabel: { fontSize: 16, fontWeight: '600', color: themeColors.text, marginHorizontal: 8 },
    activeBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: themeColors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    activeBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});