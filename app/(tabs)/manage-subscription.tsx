// app/(auth)/manage-subscription.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    Alert,
    ActivityIndicator,
    Animated,
    Linking,
    LayoutAnimation,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    UIManager,
    View,
    useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';

import { getThemeColors, Theme } from '@/theme/colors';
import { useSession } from '@/lib/SessionProvider';
import { supabase } from '@/lib/supabase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ===================== CONFIG ===================== */
/** Leave undefined to use the "current" offering in RevenueCat */
const RC_OFFERING_ID: string | undefined = undefined;
/** Your entitlement id (defaults to "premium") */
const ENTITLEMENT_ID =
    (process.env.EXPO_PUBLIC_RC_ENTITLEMENT_ID as string | undefined) || 'premium';

/** UI plan id -> RevenueCat package/product identifier */
const RC_PACKAGE_ID_MAP: Record<string, string> = {
    employee_yearly: 'agricrew.employee_yearly',
    admin_monthly: 'agricrew.admin_monthly',
    farm_s: 'agricrew.farm_s',
    farm_m: 'agricrew.farm_m',
    farm_l: 'agricrew.farm_l',
    farm_s_yearly: 'agricrew.farm_s_yearly',
    farm_m_yearly: 'agricrew.farm_m_yearly',
    farm_l_yearly: 'agricrew.farm_l_yearly',
};

/** Env (Expo injects EXPO_PUBLIC_* on the client) */
const RC_IOS_API_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY as string | undefined; // appl_...
const RC_WEB_API_KEY = process.env.EXPO_PUBLIC_RC_WEB_KEY as string | undefined; // rcb_...
const RC_STRIPE_PUBLIC_KEY = process.env.EXPO_PUBLIC_RC_STRIPE_KEY as string | undefined; // strp_...

/* ===================== THEME / TYPES ===================== */
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Profile = { role: 'Arbeitnehmer' | 'Betrieb' | 'Rechnungsschreiber' } | null;

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

function useTheme() {
    const scheme = useColorScheme();
    return useMemo(() => getThemeColors((scheme ?? 'light') as Theme), [scheme]);
}

/* ===================== RevenueCat SDK wrappers ===================== */
let PurchasesNative: any | null = null;
let PurchasesWeb: any | null = null;
let rcStripe: any | null = null;

function hasAnyActiveEntitlement(info: any): boolean {
    const active = info?.entitlements?.active || {};
    if (active && typeof active === 'object') {
        if (ENTITLEMENT_ID in active) return true;
        return Object.keys(active).length > 0;
    }
    return false;
}

async function configureNative(userId?: string) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        PurchasesNative = require('react-native-purchases').default;
    } catch {
        throw new Error('Native RevenueCat SDK is not present (use an EAS dev/prod build, not Expo Go).');
    }
    if (Platform.OS === 'ios') {
        if (!RC_IOS_API_KEY || !/^appl_/i.test(RC_IOS_API_KEY)) {
            throw new Error('Invalid EXPO_PUBLIC_RC_IOS_KEY – must start with appl_.');
        }
        await PurchasesNative.configure({ apiKey: RC_IOS_API_KEY });
    } else {
        // Add Android key here when you enable it
    }
    if (userId) try { await PurchasesNative.logIn?.(userId); } catch {}
}

async function loadPurchasesWeb() {
    const dyn = (p: string) => (Function('p', 'return import(p)') as any)(p);
    let m: any = null;
    try { m = await dyn('@revenuecat/purchases-js'); } catch {}
    if (!m) { try { m = await dyn('@revenuecat/purchases-js/dist/index.mjs'); } catch {} }
    if (!m) { try { m = await dyn('@revenuecat/purchases-js/dist/index.js'); } catch {} }
    if (!m) { try { m = await dyn('@revenuecat/purchases-js/dist/purchases.umd.js'); } catch {} }
    if (!m) throw new Error('Unable to load @revenuecat/purchases-js.');
    return {
        Purchases: m.Purchases ?? m.default ?? m,
        initRevenueCatStripe: m.initRevenueCatStripe ?? m.default?.initRevenueCatStripe,
    };
}

async function configureWeb(userId?: string) {
    if (!RC_WEB_API_KEY || !/^rcb_/i.test(RC_WEB_API_KEY)) {
        throw new Error('Invalid EXPO_PUBLIC_RC_WEB_KEY – must start with rcb_.');
    }

    const { Purchases, initRevenueCatStripe } = await loadPurchasesWeb();
    PurchasesWeb = Purchases;

    let ok = false;
    try { await PurchasesWeb.configure({ apiKey: RC_WEB_API_KEY, appUserID: userId, userId }); ok = true; } catch {}
    if (!ok) { try { await (PurchasesWeb as any).configure(RC_WEB_API_KEY, userId); ok = true; } catch {} }
    if (!ok) {
        await PurchasesWeb.configure({ apiKey: RC_WEB_API_KEY });
        if (userId) {
            if (typeof PurchasesWeb.setAppUserID === 'function') await PurchasesWeb.setAppUserID(userId);
            else if (typeof PurchasesWeb.logIn === 'function') await PurchasesWeb.logIn(userId);
        }
    }

    if (typeof initRevenueCatStripe === 'function') {
        if (!RC_STRIPE_PUBLIC_KEY || !/^strp_/i.test(RC_STRIPE_PUBLIC_KEY)) {
            throw new Error('Missing EXPO_PUBLIC_RC_STRIPE_KEY (strp_...).');
        }
        rcStripe = initRevenueCatStripe({
            apiKey: RC_STRIPE_PUBLIC_KEY,
            entitlement: ENTITLEMENT_ID,
            offeringId: RC_OFFERING_ID,
            appUserID: userId,
        });
    } else {
        rcStripe = null;
    }
}

/* ===================== UI bits ===================== */
function PlanCard({
                      plan,
                      isSelected,
                      isCurrent,
                      onSelect,
                      colors,
                      t,
                  }: {
    plan: { id: string; icon: IconName };
    isSelected: boolean;
    isCurrent: boolean;
    onSelect: (id: string) => void;
    colors: ReturnType<typeof useTheme>;
    t: (k: string, opts?: any) => any;
}) {
    const details = t(`subscribe.plans.${plan.id}`, { returnObjects: true }) || {};
    const price = details?.price ?? '';
    const features = Array.isArray(details?.features) ? details.features : [];

    return (
        <Pressable
            onPress={() => onSelect(plan.id)}
            style={[
                styles.planCard,
                {
                    backgroundColor: colors.surface,
                    borderColor: isSelected || isCurrent ? colors.primary : colors.border,
                },
                isCurrent && { backgroundColor: `${colors.primary}12` },
            ]}
        >
            {isCurrent && (
                <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.activeBadgeText, { color: colors.background }]}>
                        {t('manageSubscription.active')}
                    </Text>
                </View>
            )}

            <View style={styles.cardHeader}>
                <MaterialCommunityIcons
                    name={plan.icon}
                    size={28}
                    color={isSelected || isCurrent ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.planTitle, { color: colors.text }]}>{details.title}</Text>
            </View>

            <View style={styles.priceRow}>
                <Text style={[styles.price, { color: colors.text }]}>{price}</Text>
                <Text style={[styles.period, { color: colors.textSecondary }]}>{details.period}</Text>
            </View>

            <View style={styles.features}>
                {features.map((f: string) => (
                    <View key={f} style={styles.featureRow}>
                        <MaterialCommunityIcons name="check" size={16} color={colors.success} />
                        <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f}</Text>
                    </View>
                ))}
            </View>
        </Pressable>
    );
}

/* ===================== PAGE ===================== */
export default function ManageSubscriptionScreen() {
    const { session } = useSession();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const colors = useTheme();
    const fade = useRef(new Animated.Value(1)).current;

    const [profile, setProfile] = useState<Profile>(null);
    const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isYearly, setIsYearly] = useState(false);

    const [loading, setLoading] = useState(true);
    const [rcReady, setRcReady] = useState(false);
    const [rcError, setRcError] = useState<string | null>(null);
    const [working, setWorking] = useState(false);

    // subtle fade on theme change
    useEffect(() => {
        fade.setValue(0);
        Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    }, [colors, fade]);

    // Configure RC + load current plan + profile
    const bootstrap = useCallback(async () => {
        if (!session?.user?.id) return;

        setLoading(true);
        try {
            // configure RC for this platform
            if (Platform.OS === 'web') {
                await configureWeb(session.user.id);
                setRcReady(true);
            } else {
                await configureNative(session.user.id);
                setRcReady(true);
            }

            // 1) supabase: get profile + current sub record (for UI)
            const [{ data: prof }, { data: subRec }] = await Promise.all([
                supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle(),
                supabase
                    .from('user_subscriptions')
                    .select('role,is_active')
                    .eq('user_id', session.user.id)
                    .eq('is_active', true)
                    .maybeSingle(),
            ]);
            setProfile(prof ?? ({ role: 'Betrieb' } as any));
            setCurrentPlanId(subRec?.role ?? null);
            setSelectedPlanId(subRec?.role ?? null);

            // 2) RC entitlements sanity check (optional but helpful)
            try {
                if (Platform.OS === 'web') {
                    const info = await PurchasesWeb?.getCustomerInfo?.();
                    if (!hasAnyActiveEntitlement(info)) {
                        // Try restore on web in case user switched browsers
                        await PurchasesWeb?.restorePurchases?.();
                    }
                } else {
                    const info = await PurchasesNative?.getCustomerInfo?.();
                    if (!hasAnyActiveEntitlement(info)) {
                        await PurchasesNative?.restorePurchases?.();
                    }
                }
            } catch {}
        } catch (e: any) {
            setRcError(e?.message || String(e));
        } finally {
            setLoading(false);
        }
    }, [session?.user?.id]);

    useFocusEffect(
        useCallback(() => {
            bootstrap();
        }, [bootstrap])
    );

    // Save our app’s subscription record (after RC confirms)
    async function upsertSubscription(planId: string, userId: string) {
        const now = new Date();
        const expires = new Date(now);
        /yearly/i.test(planId) ? expires.setFullYear(now.getFullYear() + 1) : expires.setMonth(now.getMonth() + 1);

        const { error } = await supabase
            .from('user_subscriptions')
            .upsert({
                user_id: userId,
                role: planId,
                is_active: true,
                subscribed_at: now.toISOString(),
                expires_at: expires.toISOString(),
            });
        if (error) throw error;

        setCurrentPlanId(planId);
    }

    // Switch/Change plan flow – handles both native and web
    const handleChangePlan = async () => {
        if (!rcReady || !selectedPlanId || selectedPlanId === currentPlanId || !session?.user?.id) return;

        setWorking(true);
        try {
            const rcId = RC_PACKAGE_ID_MAP[selectedPlanId];
            if (!rcId) {
                Alert.alert('Setup', `No RevenueCat mapping for "${selectedPlanId}".`);
                return;
            }

            if (Platform.OS === 'web') {
                if (!rcStripe || !PurchasesWeb) {
                    Alert.alert(
                        'Unavailable',
                        'Web checkout is not available in this build. Please subscribe from the mobile app.'
                    );
                    return;
                }

                // attempt to preselect the package
                let defaultPackageIdentifier: string | undefined;
                try {
                    const offs = await PurchasesWeb.getOfferings?.();
                    const off = (RC_OFFERING_ID ? offs?.all?.[RC_OFFERING_ID] : offs?.current) || Object.values(offs?.all || {})[0];
                    const match = off?.availablePackages?.find(
                        (p: any) => p?.identifier === rcId || p?.product?.identifier === rcId
                    );
                    defaultPackageIdentifier = match?.identifier;
                } catch {}

                await rcStripe.presentPaywall({ offeringId: RC_OFFERING_ID, defaultPackageIdentifier });

                // refresh entitlements
                let info = await PurchasesWeb.getCustomerInfo?.().catch(() => null);
                if (!hasAnyActiveEntitlement(info)) {
                    info = await PurchasesWeb.restorePurchases?.().catch(() => null);
                }

                if (hasAnyActiveEntitlement(info)) {
                    await upsertSubscription(selectedPlanId, session.user.id);
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    Alert.alert(t('manageSubscription.successTitle'), t('manageSubscription.updateSuccess'));
                } else {
                    Alert.alert(t('manageSubscription.errorTitle'), t('manageSubscription.updateError'));
                }
                return;
            }

            // Native iOS/Android
            const offerings = await PurchasesNative.getOfferings();
            const offering =
                (RC_OFFERING_ID ? offerings?.all?.[RC_OFFERING_ID] : offerings?.current) ||
                Object.values(offerings?.all || {})[0];

            const pkg = offering?.availablePackages?.find(
                (p: any) => p?.identifier === rcId || p?.product?.identifier === rcId
            );

            if (!pkg) {
                Alert.alert('Setup', `Package "${rcId}" not in your offering.`);
                return;
            }

            let info: any = null;
            try {
                const res = await PurchasesNative.purchasePackage(pkg);
                info = res?.customerInfo ?? null;
            } catch (e: any) {
                // proration/“already active” paths – fetch current info
                try { info = await PurchasesNative.getCustomerInfo(); } catch {}
                if (!hasAnyActiveEntitlement(info)) {
                    try { const restored = await PurchasesNative.restorePurchases(); info = restored?.customerInfo ?? restored ?? null; } catch {}
                }
            }

            if (hasAnyActiveEntitlement(info)) {
                await upsertSubscription(selectedPlanId, session.user.id);
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                Alert.alert(t('manageSubscription.successTitle'), t('manageSubscription.updateSuccess'));
            } else {
                Alert.alert(t('manageSubscription.errorTitle'), t('manageSubscription.updateError'));
            }
        } catch (e: any) {
            if (!e?.userCancelled) {
                Alert.alert(t('manageSubscription.errorTitle'), e?.message || 'Something went wrong.');
            }
        } finally {
            setWorking(false);
        }
    };

    const handleRestore = async () => {
        setWorking(true);
        try {
            let info: any = null;
            if (Platform.OS === 'web') {
                info = await PurchasesWeb?.restorePurchases?.();
            } else {
                const restored = await PurchasesNative?.restorePurchases?.();
                info = restored?.customerInfo ?? restored;
            }

            if (hasAnyActiveEntitlement(info) && session?.user?.id) {
                // Best effort: choose a plan id that matches currently active product/package
                // (You can refine this to map from product id -> plan id if needed)
                const newId = selectedPlanId || currentPlanId || Object.keys(RC_PACKAGE_ID_MAP)[0];
                await upsertSubscription(newId!, session.user.id);
                Alert.alert(t('manageSubscription.successTitle'), t('manageSubscription.restoreSuccess', 'Restored.'));
            } else {
                Alert.alert(t('manageSubscription.errorTitle'), t('manageSubscription.noActiveSub', 'No active subscription.'));
            }
        } catch (e: any) {
            Alert.alert(t('manageSubscription.errorTitle'), e?.message || 'Could not restore.');
        } finally {
            setWorking(false);
        }
    };

    /* ---------- Plans list ---------- */
    const renderPlans = () => {
        if (loading) return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />;

        const role = profile?.role || 'Betrieb';
        const month = [subscriptionPlans.farm_s, subscriptionPlans.farm_m, subscriptionPlans.farm_l];
        const year = [subscriptionPlans.farm_s_yearly, subscriptionPlans.farm_m_yearly, subscriptionPlans.farm_l_yearly];

        if (role === 'Arbeitnehmer') {
            const plan = subscriptionPlans.employee;
            return (
                <PlanCard
                    plan={plan}
                    t={t}
                    colors={colors}
                    isSelected={selectedPlanId === plan.id}
                    isCurrent={currentPlanId === plan.id}
                    onSelect={setSelectedPlanId}
                />
            );
        }
        if (role === 'Rechnungsschreiber') {
            const plan = subscriptionPlans.admin;
            return (
                <PlanCard
                    plan={plan}
                    t={t}
                    colors={colors}
                    isSelected={selectedPlanId === plan.id}
                    isCurrent={currentPlanId === plan.id}
                    onSelect={setSelectedPlanId}
                />
            );
        }

        return (
            <>
                <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <Text style={[styles.toggleLabel, { color: colors.textSecondary }]}>{t('subscribe.monthly')}</Text>
                    <Switch
                        value={isYearly}
                        onValueChange={(v) => {
                            setIsYearly(v);
                            setSelectedPlanId(null);
                        }}
                        trackColor={{ false: `${colors.surface}AA`, true: colors.primary }}
                        thumbColor={colors.background}
                    />
                    <Text style={[styles.toggleLabel, { color: colors.textSecondary }]}>{t('subscribe.yearly')}</Text>
                    <View style={[styles.saveBadge, { backgroundColor: colors.success }]}>
                        <Text style={styles.saveBadgeText}>{t('subscribe.save10')}</Text>
                    </View>
                </View>

                {(isYearly ? year : month).map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={plan}
                        t={t}
                        colors={colors}
                        isSelected={selectedPlanId === plan.id}
                        isCurrent={currentPlanId === plan.id}
                        onSelect={(id) => {
                            setSelectedPlanId(id);
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        }}
                    />
                ))}
            </>
        );
    };

    const disabled =
        loading || working || !selectedPlanId || selectedPlanId === currentPlanId || !rcReady;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Animated.View style={{ flex: 1, opacity: fade }}>
                <ScrollView
                    contentContainerStyle={[
                        styles.scroll,
                        { paddingBottom: 220, paddingHorizontal: 16, width: '100%', maxWidth: 960, alignSelf: 'center' },
                    ]}
                >
                    <MaterialCommunityIcons name="credit-card-settings-outline" size={56} color={colors.primary} />
                    <Text style={[styles.title, { color: colors.text }]}>{t('manageSubscription.title', 'Manage Subscription')}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {t('manageSubscription.subtitle', 'Change or restore your plan.')}
                    </Text>

                    {Platform.OS === 'web' && rcReady && !rcStripe && (
                        <Text style={[styles.subtitle, { color: colors.warning }]}>
                            Web checkout isn’t available in this build. Install a purchases-js version that includes the Stripe
                            paywall or manage from the mobile app.
                        </Text>
                    )}

                    {rcError ? (
                        <Text style={[styles.subtitle, { color: colors.warning }]} numberOfLines={3}>
                            Purchases init error: {rcError}
                        </Text>
                    ) : null}

                    {renderPlans()}
                </ScrollView>

                <View
                    style={[
                        styles.footer,
                        { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom + 12, 20) },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.cta,
                            { backgroundColor: disabled ? colors.surfaceHighlight : colors.primary },
                        ]}
                        disabled={disabled}
                        onPress={handleChangePlan}
                        activeOpacity={0.9}
                    >
                        {working ? (
                            <ActivityIndicator color={colors.background} />
                        ) : (
                            <Text style={[styles.ctaText, { color: colors.background }]}>
                                {t('manageSubscription.changePlan', 'Change plan')}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <View style={{ height: 10 }} />

                    <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: colors.border }]}
                        disabled={working}
                        onPress={handleRestore}
                        activeOpacity={0.9}
                    >
                        <Text style={[styles.secondaryText, { color: colors.text }]}>{t('subscribe.restore', 'Restore')}</Text>
                    </TouchableOpacity>

                    <View style={styles.legal}>
                        <Pressable
                            style={styles.legalLink}
                            onPress={() => Linking.openURL('https://agri-crew.de/agb')}
                        >
                            <Text style={[styles.legalText, { color: colors.primary }]}>
                                {t('manageSubscription.terms', 'Terms & Conditions')}
                            </Text>
                        </Pressable>
                        <Pressable
                            style={styles.legalLink}
                            onPress={() => Linking.openURL('https://agri-crew.de/app-datenschutz')}
                        >
                            <Text style={[styles.legalText, { color: colors.primary }]}>
                                {t('manageSubscription.privacy', 'Privacy Policy')}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Animated.View>
        </View>
    );
}

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { alignItems: 'center', gap: 10, paddingTop: 24 },
    title: { fontFamily: baseFontFamily, fontSize: 28, fontWeight: '700', textAlign: 'center', marginTop: 8 },
    subtitle: { fontFamily: baseFontFamily, fontSize: 16, textAlign: 'center', lineHeight: 22, marginBottom: 20 },

    planCard: {
        width: '100%',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 2,
        alignItems: 'flex-start',
        overflow: 'hidden',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
    planTitle: { fontFamily: baseFontFamily, fontSize: 18, fontWeight: '700' },

    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
    price: { fontFamily: baseFontFamily, fontSize: 32, fontWeight: '800', letterSpacing: 0.2 },
    period: { fontFamily: baseFontFamily, fontSize: 14, marginLeft: 6 },

    features: { alignSelf: 'stretch', marginTop: 12, paddingLeft: 2 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    featureText: { fontFamily: baseFontFamily, fontSize: 14 },

    activeBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    activeBadgeText: { fontFamily: baseFontFamily, fontWeight: '700', fontSize: 12, letterSpacing: 0.2 },

    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 12,
        gap: 10,
    },
    toggleLabel: { fontFamily: baseFontFamily, fontSize: 14, fontWeight: '600' },
    saveBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
    saveBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
    cta: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    ctaText: { fontFamily: baseFontFamily, fontSize: 16, fontWeight: '800' },

    secondaryBtn: { paddingVertical: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
    secondaryText: { fontFamily: baseFontFamily, fontSize: 15, fontWeight: '700' },

    legal: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10 },
    legalLink: {},
    legalText: { fontFamily: baseFontFamily, fontSize: 12, textDecorationLine: 'underline' },
});