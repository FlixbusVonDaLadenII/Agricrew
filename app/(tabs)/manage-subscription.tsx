import React, { useState, useCallback, useMemo } from 'react';
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
    UIManager,
    LayoutAnimation,
    Linking,
    useColorScheme,
} from 'react-native';
import { getThemeColors, Theme } from '@/theme/colors';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/SessionProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ===== Types =====
type Profile = { role: string } | null;
type Subscription = { role: string | null } | null;
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// ===== Subscription Plans (display only) =====
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

const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
});

// ===== PlanCard Component (presentational) =====
const PlanCard: React.FC<any> = ({ plan, onSelect, isSelected, isActive, t, themeColors }) => {
    const details = t(`subscribe.plans.${plan.id}`, { returnObjects: true });
    const displayPrice = details.price;

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            style={[
                styles.planCard,
                {
                    backgroundColor: themeColors.surface,
                    borderColor: isSelected || isActive ? themeColors.primary : themeColors.border,
                    shadowColor: Platform.OS === 'ios' ? '#000' : themeColors.surface,
                },
                isActive && { backgroundColor: themeColors.primary + '12' },
            ]}
            onPress={() => onSelect(plan.id)}
        >
            {isActive && (
                <View style={[styles.activeBadge, { backgroundColor: themeColors.primary }]}>
                    <Text style={[styles.activeBadgeText, { color: themeColors.background }]}>
                        {t('manageSubscription.active')}
                    </Text>
                </View>
            )}

            <View style={styles.cardHeader}>
                <MaterialCommunityIcons
                    name={plan.icon}
                    size={32}
                    color={isSelected || isActive ? themeColors.primary : themeColors.textSecondary}
                />
                <Text style={[styles.planTitle, { color: themeColors.text }]}>{details.title}</Text>
            </View>

            <View style={styles.priceContainer}>
                <Text style={[styles.price, { color: themeColors.text }]}>{displayPrice}</Text>
                <Text style={[styles.period, { color: themeColors.textSecondary }]}>{details.period}</Text>
            </View>

            <View style={styles.featuresContainer}>
                {details.features.map((feature: string) => (
                    <View key={feature} style={styles.featureItem}>
                        <MaterialCommunityIcons name="check" size={16} color={themeColors.success} />
                        <Text style={[styles.featureText, { color: themeColors.text }]}>{feature}</Text>
                    </View>
                ))}
            </View>
        </TouchableOpacity>
    );
};

// ===== Main Screen =====
export default function ManageSubscriptionScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { session } = useSession();
    const scheme = useColorScheme();
    const themeColors = useMemo(
        () => getThemeColors((scheme ?? 'light') as Theme),
        [scheme]
    );

    const [profile, setProfile] = useState<Profile>(null);
    const [subscription, setSubscription] = useState<Subscription>(null);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isYearly, setIsYearly] = useState(false);
    const [isLegalNoticeVisible, setLegalNoticeVisible] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const fetchInitialData = async () => {
                if (session?.user) {
                    setLoading(true);
                    try {
                        const { data: profileData } = await supabase
                            .from('profiles')
                            .select('role')
                            .eq('id', session.user.id)
                            .single();
                        setProfile(profileData);

                        const { data: subData } = await supabase
                            .from('user_subscriptions')
                            .select('role')
                            .eq('user_id', session.user.id)
                            .eq('is_active', true)
                            .single();

                        setSubscription(subData);
                        setSelectedPlanId(subData?.role || null);
                    } catch (e) {
                        Alert.alert(t('manageSubscription.errorTitle'), t('manageSubscription.loadDataError'));
                    } finally {
                        setLoading(false);
                    }
                }
            };
            fetchInitialData();
        }, [session, t])
    );

    const handleUpdatePlan = async () => {
        if (!session?.user || !selectedPlanId || selectedPlanId === subscription?.role) return;
        setIsUpdating(true);

        try {
            if (subscription) {
                const { error } = await supabase
                    .from('user_subscriptions')
                    .update({ role: selectedPlanId })
                    .eq('user_id', session.user.id)
                    .eq('is_active', true);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('user_subscriptions').insert({
                    user_id: session.user.id,
                    role: selectedPlanId,
                    is_active: true,
                });
                if (error) throw error;
            }

            setSubscription({ role: selectedPlanId });
            Alert.alert(t('manageSubscription.successTitle'), t('manageSubscription.updateSuccess'));
        } catch (error) {
            console.error(error);
            Alert.alert(t('manageSubscription.errorTitle'), t('manageSubscription.updateError'));
        } finally {
            setIsUpdating(false);
        }
    };

    const renderPlans = () => {
        if (loading) {
            return <ActivityIndicator size="large" color={themeColors.primary} style={{ marginTop: 40 }} />;
        }
        if (!profile) {
            return <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{t('subscribe.profileError')}</Text>;
        }

        switch (profile.role) {
            case 'Arbeitnehmer':
            case 'Rechnungsschreiber': {
                const planKey = profile.role === 'Arbeitnehmer' ? 'employee' : 'admin';
                const plan = subscriptionPlans[planKey];
                return (
                    <PlanCard
                        plan={plan}
                        onSelect={() => {}}
                        isSelected={false}
                        isActive={true}
                        t={t}
                        themeColors={themeColors}
                    />
                );
            }
            case 'Betrieb': {
                const farmPlans = isYearly
                    ? [subscriptionPlans.farm_s_yearly, subscriptionPlans.farm_m_yearly, subscriptionPlans.farm_l_yearly]
                    : [subscriptionPlans.farm_s, subscriptionPlans.farm_m, subscriptionPlans.farm_l];
                return (
                    <>
                        <View
                            style={[
                                styles.toggleContainer,
                                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                            ]}
                        >
                            <Text style={[styles.toggleLabel, { color: themeColors.text }]}>{t('subscribe.monthly')}</Text>
                            <Switch
                                value={isYearly}
                                onValueChange={setIsYearly}
                                trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary + '80' }}
                                thumbColor={themeColors.background}
                            />
                            <Text style={[styles.toggleLabel, { color: themeColors.text }]}>{t('subscribe.yearly')}</Text>
                        </View>
                        {farmPlans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                onSelect={setSelectedPlanId}
                                isSelected={selectedPlanId === plan.id}
                                isActive={subscription?.role === plan.id}
                                t={t}
                                themeColors={themeColors}
                            />
                        ))}
                    </>
                );
            }
            default:
                return <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{t('subscribe.noPlans')}</Text>;
        }
    };

    const disabledCTA = loading || isUpdating || !selectedPlanId || selectedPlanId === subscription?.role;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: 220, paddingTop: 24, paddingHorizontal: 16, width: '100%', maxWidth: 960, alignSelf: 'center' },
                ]}
            >
                <MaterialCommunityIcons name="credit-card-settings-outline" size={56} color={themeColors.primary} />
                <Text style={[styles.title, { color: themeColors.text }]}>{t('manageSubscription.title')}</Text>
                <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{t('manageSubscription.subtitle')}</Text>

                {renderPlans()}
            </ScrollView>

            {/* Footer CTA + Legal */}
            <View
                style={[
                    styles.footer,
                    {
                        backgroundColor: themeColors.surface,
                        borderTopColor: themeColors.border,
                        paddingBottom: Math.max(insets.bottom + 12, 20),
                    },
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.purchaseButton,
                        {
                            backgroundColor: disabledCTA ? themeColors.surfaceHighlight : themeColors.primary,
                            shadowColor: themeColors.primary,
                        },
                    ]}
                    onPress={handleUpdatePlan}
                    disabled={disabledCTA}
                    activeOpacity={0.9}
                >
                    {isUpdating ? (
                        <ActivityIndicator color={themeColors.background} />
                    ) : (
                        <Text style={[styles.buttonText, { color: themeColors.background }]}>
                            {t('manageSubscription.changePlan')}
                        </Text>
                    )}
                </TouchableOpacity>

                <View style={styles.legalContainer}>
                    <TouchableOpacity
                        style={styles.collapsibleHeader}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setLegalNoticeVisible(!isLegalNoticeVisible);
                        }}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.collapsibleHeaderText, { color: themeColors.textSecondary }]}>
                            {t('manageSubscription.legalHeader')}
                        </Text>
                        <MaterialCommunityIcons
                            name={isLegalNoticeVisible ? 'chevron-up' : 'chevron-down'}
                            size={22}
                            color={themeColors.textSecondary}
                        />
                    </TouchableOpacity>

                    {isLegalNoticeVisible && (
                        <View style={styles.legalContent}>
                            <Text style={[styles.legalText, { color: themeColors.textSecondary }]}>
                                {t('manageSubscription.legalNotice')}
                            </Text>
                            <View style={styles.legalLinksContainer}>
                                <TouchableOpacity onPress={() => Linking.openURL('https://agri-crew.de/agb')}>
                                    <Text style={[styles.legalLink, { color: themeColors.primary }]}>
                                        {t('manageSubscription.terms', 'Terms & Conditions')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => Linking.openURL('https://agri-crew.de/app-datenschutz')}>
                                    <Text style={[styles.legalLink, { color: themeColors.primary }]}>
                                        {t('manageSubscription.privacy', 'Privacy Policy')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

// ===== Styles =====
const styles = StyleSheet.create({
    container: { flex: 1 },

    scrollContent: {
        alignItems: 'center',
        gap: 10,
    },

    title: {
        fontFamily: baseFontFamily,
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 8,
    },
    subtitle: {
        fontFamily: baseFontFamily,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },

    // Plan card
    planCard: {
        width: '100%',
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'flex-start',
        overflow: 'hidden',
        ...Platform.select({
            ios: { shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
            android: { elevation: 2 },
            default: {},
        }),
    },
    cardHeader: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    planTitle: {
        fontFamily: baseFontFamily,
        fontSize: 18,
        fontWeight: '700',
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: 10,
    },
    price: {
        fontFamily: baseFontFamily,
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    period: {
        fontFamily: baseFontFamily,
        fontSize: 14,
        marginLeft: 6,
    },
    featuresContainer: {
        alignSelf: 'stretch',
        marginTop: 12,
        paddingLeft: 2,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    featureText: {
        fontFamily: baseFontFamily,
        fontSize: 14,
    },

    activeBadge: {
        position: 'absolute',
        top: 14,
        right: 14,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    activeBadgeText: {
        fontFamily: baseFontFamily,
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 0.2,
    },

    // Toggle row
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 14,
        gap: 10,
    },
    toggleLabel: {
        fontFamily: baseFontFamily,
        fontSize: 14,
        fontWeight: '600',
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    purchaseButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
            android: { elevation: 3 },
            default: {},
        }),
    },
    buttonText: {
        fontFamily: baseFontFamily,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    // Legal collapsible
    legalContainer: { marginTop: 14 },
    collapsibleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    collapsibleHeaderText: {
        fontFamily: baseFontFamily,
        fontSize: 14,
        fontWeight: '600',
    },
    legalContent: { marginTop: 10 },
    legalText: {
        fontFamily: baseFontFamily,
        fontSize: 12,
        lineHeight: 18,
    },
    legalLinksContainer: { flexDirection: 'row', marginTop: 10, gap: 20 },
    legalLink: {
        fontFamily: baseFontFamily,
        fontSize: 12,
        textDecorationLine: 'underline',
    },
});