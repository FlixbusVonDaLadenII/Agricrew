// app/(auth)/subscribe.tsx

import React, { useState, useEffect } from 'react';
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
    useWindowDimensions,
} from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/SessionProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getThemeColors, Theme } from '@/theme/colors';

const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);
const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
});

type Profile = { role: string } | null;
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

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

const PlanCard: React.FC<any> = ({ plan, onSelect, isSelected, t }) => {
    const details = t(`subscribe.plans.${plan.id}`, { returnObjects: true });
    const displayPrice = details.price;
    const { width } = useWindowDimensions();
    const cardWidth = width >= 768 ? width * 0.6 : width * 0.9;

    return (
        <TouchableOpacity
            style={[styles.planCard, { width: cardWidth }, isSelected && styles.selectedPlan]}
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

export default function SubscriptionScreen() {
    const { t } = useTranslation();
    const { session } = useSession();
    const params = useLocalSearchParams();
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;

    const [profile, setProfile] = useState<Profile>(null);
    const [loading, setLoading] = useState(true);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isYearly, setIsYearly] = useState(false);
    const [currentSubscription, setCurrentSubscription] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!session?.user) {
                setLoading(false);
                return;
            }

            // Load current active subscription
            const { data: subData, error: subError } = await supabase
                .from('user_subscriptions')
                .select('role, is_active, expires_at')
                .eq('user_id', session.user.id)
                .eq('is_active', true)
                .maybeSingle();

            if (subError) {
                console.error('Error loading subscription:', subError);
            }

            // If an active subscription is found, redirect and stop execution
            if (subData) {
                router.replace('/');
                return;
            }

            // This part only runs if the user has NO active subscription.
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profileError) {
                Alert.alert(t('subscribe.errorTitle'), t('subscribe.profileError'));
            } else if (profileData) {
                setProfile(profileData);
            }

            setLoading(false);
        };

        loadData();
    }, [session, t, router]);

    useEffect(() => {
        const sessionId = params.session_id as string | undefined;
        if (!sessionId || !session?.user) return;

        const verifySession = async () => {
            try {
                const { error } = await supabase.functions.invoke('verify-checkout-session', {
                    body: { sessionId, userId: session.user.id },
                });
                if (error) throw error;
                Alert.alert(t('subscribe.successTitle'), t('subscribe.purchaseSuccess'));
                router.replace('/');
            } catch (err) {
                console.error('Error verifying checkout session:', err);
            }
        };

        verifySession();
    }, [params, session, t, router]);

    const handlePurchase = async () => {
        if (!selectedPlanId || !session?.user) return;
        setIsSubscribing(true);

        try {
            const successUrl = Linking.createURL('/(auth)/subscribe');
            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                body: {
                    priceId: selectedPlanId,
                    userId: session.user.id,
                    successUrl,
                },
            });

            if (error) throw error;
            const { url } = data as { url: string };
            if (url) {
                await Linking.openURL(url);
            }
        } catch (err) {
            console.error('Error creating checkout session:', err);
            Alert.alert(t('subscribe.purchaseErrorTitle'), t('subscribe.purchaseErrorMessage'));
        } finally {
            setIsSubscribing(false);
        }
    };

    const renderPlans = () => {
        if (loading) {
            return <ActivityIndicator size="large" color={themeColors.primary} style={{ marginTop: 40 }} />;
        }

        if (!profile) return <Text style={styles.subtitle}>{t('subscribe.profileError')}</Text>;

        const farmPlans = isYearly
            ? [subscriptionPlans.farm_s_yearly, subscriptionPlans.farm_m_yearly, subscriptionPlans.farm_l_yearly]
            : [subscriptionPlans.farm_s, subscriptionPlans.farm_m, subscriptionPlans.farm_l];

        switch (profile.role) {
            case 'Arbeitnehmer':
                return (
                    <PlanCard
                        plan={subscriptionPlans.employee}
                        onSelect={setSelectedPlanId}
                        isSelected={selectedPlanId === subscriptionPlans.employee.id}
                        t={t}
                    />
                );
            case 'Rechnungsschreiber':
                return (
                    <PlanCard
                        plan={subscriptionPlans.admin}
                        onSelect={setSelectedPlanId}
                        isSelected={selectedPlanId === subscriptionPlans.admin.id}
                        t={t}
                    />
                );
            case 'Betrieb':
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
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingHorizontal: width * 0.05,
                        paddingBottom: width * 0.2,
                    },
                ]}
            >
                <MaterialCommunityIcons name="shield-lock-outline" size={60} color={themeColors.primary} />
                <Text style={[styles.title, isLargeScreen && { fontSize: 34 }]}>
                    {t('subscribe.title')}
                </Text>
                <Text style={styles.subtitle}>
                    {t('subscribe.subtitle')}
                    <Text style={{ fontWeight: 'bold' }}>
                        {profile?.role ? ` ${t(`roles.${profile.role}`)}` : ''}
                    </Text>.
                </Text>
                {currentSubscription && (
                    <View style={styles.currentPlan}>
                        <Text style={styles.currentPlanText}>
                            {t('subscribe.currentPlan')}: {currentSubscription}
                        </Text>
                    </View>
                )}
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
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    scrollContent: { alignItems: 'center' },
    title: { fontFamily: baseFontFamily, fontSize: 28, fontWeight: 'bold', color: themeColors.text, marginVertical: 16, textAlign: 'center' },
    subtitle: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
    planCard: { backgroundColor: themeColors.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 2, borderColor: themeColors.border, alignItems: 'center', overflow: 'hidden' },
    selectedPlan: { borderColor: themeColors.primary, backgroundColor: themeColors.primary + '1A' },
    planTitle: { fontFamily: baseFontFamily, fontSize: 20, fontWeight: 'bold', color: themeColors.text, marginTop: 12 },
    priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginVertical: 8 },
    price: { fontFamily: baseFontFamily, fontSize: 36, fontWeight: 'bold', color: themeColors.text },
    period: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, marginLeft: 4 },
    featuresContainer: { width: '100%', marginTop: 12 },
    featureItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
    featureText: { marginLeft: 8, color: themeColors.textSecondary, fontFamily: baseFontFamily },
    footer: { padding: 16, borderTopWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.background },
    purchaseButton: { backgroundColor: themeColors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
    disabledButton: { opacity: 0.5 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: baseFontFamily },
    toggleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    toggleLabel: { fontFamily: baseFontFamily, fontSize: 14, marginHorizontal: 8, color: themeColors.textSecondary },
    saveBadge: { backgroundColor: themeColors.success, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
    saveBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    currentPlan: { backgroundColor: themeColors.surface, padding: 12, borderRadius: 12, marginVertical: 16 },
    currentPlanText: { color: themeColors.text, fontWeight: 'bold', fontFamily: baseFontFamily },
});
