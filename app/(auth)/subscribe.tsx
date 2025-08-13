import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Platform, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native';
import { getThemeColors, Theme } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/SessionProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);
const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

// --- Data for all subscription plans ---
const subscriptionPlans = {
    employee: { id: 'employee_yearly', icon: 'account-hard-hat' },
    admin: { id: 'admin_monthly', icon: 'file-document-outline' },
    farm_s: { id: 'farm_s', icon: 'tractor-variant' },
    farm_m: { id: 'farm_m', icon: 'tractor-variant' },
    farm_l: { id: 'farm_l', icon: 'tractor-variant' },
    farm_s_yearly: { id: 'farm_s_yearly', icon: 'tractor-variant' },
    farm_m_yearly: { id: 'farm_m_yearly', icon: 'tractor-variant' },
    farm_l_yearly: { id: 'farm_l_yearly', icon: 'tractor-variant' },
};

const PlanCard = ({ plan, onSelect, isSelected, t }: any) => {
    const planKey = plan.id;
    const details = t(`subscribe.plans.${planKey}`, { returnObjects: true });

    return (
        <TouchableOpacity
            style={[styles.planCard, isSelected && styles.selectedPlan]}
            onPress={() => onSelect(plan.id)}
        >
            <MaterialCommunityIcons name={plan.icon} size={32} color={isSelected ? themeColors.primary : themeColors.textSecondary} />
            <Text style={styles.planTitle}>{details.title}</Text>
            <View style={styles.priceContainer}>
                <Text style={styles.price}>{details.price}</Text>
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
            {plan.id.includes('farm_l') && <View style={styles.topPlacementBanner}><Text style={styles.topPlacementText}>{details.features.find((f: string) => f.toLowerCase().includes('top placement') || f.toLowerCase().includes('top-platzierung'))}</Text></View>}
        </TouchableOpacity>
    );
};

export default function SubscriptionScreen() {
    const { t } = useTranslation();
    const { session } = useSession();
    const [profile, setProfile] = useState<{ role: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isYearly, setIsYearly] = useState(false); // New state for the toggle

    useEffect(() => {
        if (session?.user) {
            supabase.from('profiles').select('role').eq('id', session.user.id).single()
                .then(({ data, error }) => {
                    if (error) Alert.alert("Error", "Could not fetch profile.");
                    else if (data) {
                        setProfile(data);
                        if (data.role === 'Arbeitnehmer') setSelectedPlanId('employee_yearly');
                        if (data.role === 'Rechnungsschreiber') setSelectedPlanId('admin_monthly');
                    }
                    setLoading(false);
                });
        } else { setLoading(false); }
    }, [session]);

    const handlePurchase = async () => {
        if (!selectedPlanId) {
            Alert.alert("No Plan Selected", "Please choose a subscription plan.");
            return;
        }
        setIsSubscribing(true);
        const { error } = await supabase.rpc('subscribe_to_plan', { plan_id_input: selectedPlanId });
        setIsSubscribing(false);
        if (error) {
            Alert.alert(t('subscribe.purchaseErrorTitle'), t('subscribe.updateError'));
            console.error("Subscription RPC error:", error);
        } else {
            router.replace('/(tabs)');
        }
    };

    const renderPlans = () => {
        if (loading) return <ActivityIndicator size="large" color={themeColors.primary} style={{ marginTop: 40 }} />;
        if (!profile) return <Text style={styles.subtitle}>Could not load profile information.</Text>;

        switch (profile.role) {
            case 'Arbeitnehmer':
                return <PlanCard plan={subscriptionPlans.employee} onSelect={setSelectedPlanId} isSelected={true} t={t} />;
            case 'Rechnungsschreiber':
                return <PlanCard plan={subscriptionPlans.admin} onSelect={setSelectedPlanId} isSelected={true} t={t} />;
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
                                    setSelectedPlanId(null); // Reset selection when changing billing cycle
                                }}
                                trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary }}
                                thumbColor={themeColors.background}
                            />
                            <Text style={styles.toggleLabel}>{t('subscribe.yearly')}</Text>
                            <View style={styles.saveBadge}>
                                <Text style={styles.saveBadgeText}>{t('subscribe.save10')}</Text>
                            </View>
                        </View>
                        {farmPlans.map(plan => (
                            <PlanCard key={plan.id} plan={plan} onSelect={setSelectedPlanId} isSelected={selectedPlanId === plan.id} t={t} />
                        ))}
                    </>
                );
            default:
                return <Text style={styles.subtitle}>No plans available for your role.</Text>;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <MaterialCommunityIcons name="shield-lock-outline" size={60} color={themeColors.primary} />
                <Text style={styles.title}>{t('subscribe.title')}</Text>
                <Text style={styles.subtitle}>
                    {t('subscribe.subtitle')}
                    <Text style={{ fontWeight: 'bold' }}> {profile?.role ? t(`roles.${profile.role}`) : ''}</Text>.
                </Text>
                {renderPlans()}
            </ScrollView>
            <View style={styles.footer}>
                <TouchableOpacity style={[styles.purchaseButton, !selectedPlanId && styles.disabledButton]} onPress={handlePurchase} disabled={loading || isSubscribing || !selectedPlanId}>
                    {isSubscribing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('subscribe.buttonText')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
                    <Text style={styles.logoutText}>{t('subscribe.logout')}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    scrollContent: { alignItems: 'center', padding: 24, paddingBottom: 150 },
    title: { fontFamily: baseFontFamily, fontSize: 28, fontWeight: 'bold', color: themeColors.text, marginVertical: 16, textAlign: 'center' },
    subtitle: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 32, },
    planCard: { width: '100%', backgroundColor: themeColors.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 2, borderColor: themeColors.border, alignItems: 'center', overflow: 'hidden' },
    selectedPlan: { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '1A' },
    planTitle: { fontFamily: baseFontFamily, fontSize: 20, fontWeight: 'bold', color: themeColors.text, marginTop: 12 },
    priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginVertical: 8 },
    price: { fontFamily: baseFontFamily, fontSize: 36, fontWeight: 'bold', color: themeColors.text },
    period: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, marginLeft: 6 },
    featuresContainer: { alignSelf: 'stretch', marginTop: 12, paddingLeft: 10 },
    featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    featureText: { fontFamily: baseFontFamily, fontSize: 15, color: themeColors.text, marginLeft: 10 },
    topPlacementBanner: { position: 'absolute', top: 18, right: -40, backgroundColor: themeColors.primary, paddingVertical: 6, paddingHorizontal: 50, transform: [{ rotate: '45deg' }] },
    topPlacementText: { color: '#fff', fontWeight: 'bold', fontSize: 12, textAlign: 'center', width: 100 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingTop: 12, backgroundColor: themeColors.background, borderTopWidth: 1, borderTopColor: themeColors.border },
    purchaseButton: { width: '100%', backgroundColor: themeColors.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
    disabledButton: { backgroundColor: themeColors.surfaceHighlight },
    buttonText: { fontFamily: baseFontFamily, color: '#fff', fontSize: 18, fontWeight: 'bold' },
    logoutButton: { marginTop: 16, alignItems: 'center' },
    logoutText: { color: themeColors.textSecondary, fontSize: 14 },
    // --- NEW STYLES for the toggle ---
    toggleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, backgroundColor: themeColors.surface, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
    toggleLabel: { fontSize: 16, fontWeight: '600', color: themeColors.text, marginHorizontal: 8 },
    saveBadge: { backgroundColor: themeColors.success, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 12 },
    saveBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});