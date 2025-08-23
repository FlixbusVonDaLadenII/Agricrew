// app/(auth)/subscribe.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
    Switch,
    Animated,
    useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/SessionProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getThemeColors, Theme } from '@/theme/colors';
import 'react-native-get-random-values';

/* ───────────────── CONFIG ───────────────── */

/** Use current offering unless you explicitly set one. */
const RC_OFFERING_ID: string | undefined = undefined;
/** Your entitlement in RC (change if you used a different one). */
const ENTITLEMENT_ID =
    (process.env.EXPO_PUBLIC_RC_ENTITLEMENT_ID as string | undefined) || 'premium';

/** UI plan id -> RC package/product id (must match your RC identifiers) */
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

/** Env (Expo injects EXPO_PUBLIC_* at runtime) */
const RC_WEB_API_KEY = process.env.EXPO_PUBLIC_RC_WEB_KEY as string | undefined;     // rcb_...
const RC_STRIPE_PUBLIC_KEY = process.env.EXPO_PUBLIC_RC_STRIPE_KEY as string | undefined; // strp_...
const RC_IOS_API_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY as string | undefined;     // appl_...

/* ───────────────── THEME / TYPES ───────────────── */

type Profile = { role: 'Arbeitnehmer' | 'Betrieb' | 'Rechnungsschreiber' } | null;
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

const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });
function useTheme() {
    const scheme = useColorScheme();
    return useMemo(() => getThemeColors((scheme || 'light') as Theme), [scheme]);
}

/* ───────────────── RevenueCat (WEB + Native) ───────────────── */

let PurchasesWeb: any | null = null;
let rcStripe: any | null = null;
let PurchasesNative: any | null = null;

/** Lazy import purchases-js (handles CJS/ESM/UMD) - restored from original */
async function loadPurchasesWeb() {
    const dyn = (p: string) => (Function('p', 'return import(p)') as any)(p);
    let m: any = null;
    try { m = await dyn('@revenuecat/purchases-js'); } catch {}
    if (!m) { try { m = await dyn('@revenuecat/purchases-js/dist/index.mjs'); } catch {} }
    if (!m) { try { m = await dyn('@revenuecat/purchases-js/dist/index.js'); } catch {} }
    if (!m) { try { m = await dyn('@revenuecat/purchases-js/dist/purchases.umd.js'); } catch {} }
    if (!m) throw new Error('Unable to load @revenuecat/purchases-js.');

    console.log('Loaded module, available keys:', Object.keys(m));

    return {
        Purchases: m.Purchases ?? m.default ?? m,
        initRevenueCatStripe: m.initRevenueCatStripe ?? m.default?.initRevenueCatStripe,
    };
}

async function configureRCWeb(appUserID?: string) {
    console.log('Configuring RC Web with userID:', appUserID);

    if (!RC_WEB_API_KEY || !RC_WEB_API_KEY.startsWith('rcb_')) {
        throw new Error('Invalid EXPO_PUBLIC_RC_WEB_KEY: must start with rcb_');
    }

    if (!RC_STRIPE_PUBLIC_KEY || !RC_STRIPE_PUBLIC_KEY.startsWith('strp_')) {
        throw new Error('Invalid EXPO_PUBLIC_RC_STRIPE_KEY: must start with strp_');
    }

    const { Purchases, initRevenueCatStripe } = await loadPurchasesWeb();
    PurchasesWeb = Purchases;

    // Configure RevenueCat
    try {
        await PurchasesWeb.configure({
            apiKey: RC_WEB_API_KEY,
            appUserID: appUserID
        });
        console.log('RevenueCat configured successfully');
    } catch (error) {
        console.error('RevenueCat configuration failed:', error);
        throw error;
    }

    // Initialize Stripe integration
    if (!initRevenueCatStripe) {
        throw new Error('initRevenueCatStripe not available. Update @revenuecat/purchases-js to latest version.');
    }

    try {
        rcStripe = initRevenueCatStripe({
            apiKey: RC_STRIPE_PUBLIC_KEY,
            entitlement: ENTITLEMENT_ID,
            offeringId: RC_OFFERING_ID,
            appUserID: appUserID,
        });
        console.log('Stripe integration initialized successfully');
    } catch (error) {
        console.error('Stripe initialization failed:', error);
        throw error;
    }
}

async function configureRCNative(appUserID?: string) {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
    try {
        PurchasesNative = require('react-native-purchases').default;
    } catch {
        // Running in Expo Go / web – no native module.
        return false;
    }
    if (Platform.OS === 'ios') {
        if (!RC_IOS_API_KEY || !/^appl_/i.test(RC_IOS_API_KEY)) return false;
        await PurchasesNative.configure({ apiKey: RC_IOS_API_KEY });
    }
    if (appUserID) { try { await PurchasesNative.logIn?.(appUserID); } catch {} }
    return true;
}

/* ───────────────── Helpers ───────────────── */

function hasActive(info: any): boolean {
    const active = info?.entitlements?.active || {};
    if (active[ENTITLEMENT_ID]) return true;
    return Object.keys(active).length > 0;
}

/* ───────────────── UI Bits ───────────────── */

const PlanCard: React.FC<any> = ({ plan, onSelect, isSelected, t, colors }: any) => {
    const details = t(`subscribe.plans.${plan.id}`, { returnObjects: true }) || {};
    const price = details?.price ?? '';
    const features: string[] = Array.isArray(details?.features) ? details.features : [];

    return (
        <TouchableOpacity
            style={[
                styles.planCard,
                { borderColor: colors.border, backgroundColor: colors.surface },
                isSelected && { borderColor: colors.primary, backgroundColor: `${colors.primary}1A` },
            ]}
            onPress={() => onSelect(plan.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
        >
            <MaterialCommunityIcons
                name={plan.icon}
                size={32}
                color={isSelected ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.planTitle, { color: colors.text }]}>{details.title}</Text>
            <View style={styles.priceRow}>
                <Text style={[styles.price, { color: colors.text }]}>{price}</Text>
                <Text style={[styles.period, { color: colors.textSecondary }]}>{details.period}</Text>
            </View>
            <View style={styles.features}>
                {features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                        <MaterialCommunityIcons name="check" size={16} color={colors.success} />
                        <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f}</Text>
                    </View>
                ))}
            </View>
        </TouchableOpacity>
    );
};

/* ───────────────── PAGE ───────────────── */

export default function SubscriptionScreen() {
    const colors = useTheme();
    const { t } = useTranslation();
    const { session } = useSession();
    const fade = useRef(new Animated.Value(1)).current;

    const [profile, setProfile] = useState<Profile>(null);
    const [loading, setLoading] = useState(true);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isYearly, setIsYearly] = useState(false);

    const [rcReady, setRcReady] = useState(false);
    const [nativeAvailable, setNativeAvailable] = useState(false);
    const [rcError, setRcError] = useState<string | null>(null);

    useEffect(() => {
        fade.setValue(0);
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    }, [colors, fade]);

    useEffect(() => {
        (async () => {
            try {
                const userId = session?.user?.id;

                // Debug environment variables
                console.log('Environment check:', {
                    webKey: RC_WEB_API_KEY ? `${RC_WEB_API_KEY.substring(0, 4)}...` : 'missing',
                    stripeKey: RC_STRIPE_PUBLIC_KEY ? `${RC_STRIPE_PUBLIC_KEY.substring(0, 3)}...` : 'missing',
                    entitlement: ENTITLEMENT_ID,
                    platform: Platform.OS
                });

                if (Platform.OS === 'web') {
                    await configureRCWeb(userId);
                    setRcReady(true);
                } else {
                    const ok = await configureRCNative(userId);
                    setNativeAvailable(ok);
                    setRcReady(true);
                }

                if (userId) {
                    // If already subscribed, go in
                    const { data: sub } = await supabase
                        .from('user_subscriptions')
                        .select('role,is_active')
                        .eq('user_id', userId)
                        .eq('is_active', true)
                        .maybeSingle();
                    if (sub) {
                        router.replace('/(tabs)');
                        return;
                    }

                    // Load profile; default so UI renders
                    const { data: prof } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', userId)
                        .maybeSingle();
                    setProfile(prof ?? ({ role: 'Betrieb' } as any));
                }
            } catch (e: any) {
                console.error('Setup error:', e);
                setRcError(e?.message || String(e));
            } finally {
                setLoading(false);
            }
        })();
    }, [session]);

    async function saveSubscription(planId: string, userId: string) {
        const now = new Date();
        const exp = new Date(now);
        /yearly/i.test(planId) ? exp.setFullYear(now.getFullYear() + 1) : exp.setMonth(now.getMonth() + 1);

        const { error } = await supabase.from('user_subscriptions').upsert({
            user_id: userId,
            role: planId,
            is_active: true,
            subscribed_at: now.toISOString(),
            expires_at: exp.toISOString(),
        });
        if (error) throw error;
    }

    const handlePurchase = async () => {
        if (!selectedPlanId || !session?.user) return;

        /* ── WEB (Stripe via RevenueCat) ── */
        if (Platform.OS === 'web') {
            if (!rcReady || !PurchasesWeb || !rcStripe) {
                Alert.alert('Error', 'Payment system not ready. Please refresh and try again.');
                return;
            }

            setIsSubscribing(true);

            try {
                const rcPackageId = RC_PACKAGE_ID_MAP[selectedPlanId];
                console.log('Attempting purchase for package:', rcPackageId);

                // Get current offerings
                const offerings = await PurchasesWeb.getOfferings();
                console.log('Available offerings:', Object.keys(offerings.all || {}));

                const currentOffering = offerings.current || Object.values(offerings.all || {})[0];

                if (!currentOffering) {
                    throw new Error('No offerings available from RevenueCat');
                }

                console.log('Using offering:', currentOffering.identifier);
                console.log('Available packages:', currentOffering.availablePackages?.map((p: any) => p.identifier));

                // Find the package
                const targetPackage = currentOffering.availablePackages?.find(
                    (pkg: any) => pkg.identifier === rcPackageId
                );

                if (!targetPackage) {
                    console.error('Package not found. Available packages:', currentOffering.availablePackages?.map((p: any) => p.identifier));
                    throw new Error(`Package ${rcPackageId} not found in current offering`);
                }

                console.log('Found target package:', targetPackage.identifier);

                // Attempt purchase
                let customerInfo;
                try {
                    // Try direct purchase first
                    console.log('Attempting direct purchase...');
                    customerInfo = await rcStripe.purchasePackage(targetPackage);
                    console.log('Direct purchase successful');
                } catch (purchaseError: any) {
                    console.log('Direct purchase failed, trying paywall:', purchaseError.message);
                    if (purchaseError.userCancelled) {
                        return; // User cancelled, don't show error
                    }
                    // Fallback to paywall
                    customerInfo = await rcStripe.presentPaywall();
                    console.log('Paywall purchase completed');
                }

                console.log('Customer info after purchase:', customerInfo?.entitlements?.active);

                // Check if purchase was successful
                if (customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]) {
                    console.log('Purchase successful, saving subscription...');
                    await saveSubscription(selectedPlanId, session.user.id);
                    Alert.alert('Success', 'Subscription activated successfully!', [
                        { text: 'Continue', onPress: () => router.replace('/(tabs)') }
                    ]);
                } else {
                    // Try to restore purchases
                    console.log('Checking for existing purchases...');
                    const restoredInfo = await PurchasesWeb.restorePurchases();
                    if (restoredInfo?.entitlements?.active?.[ENTITLEMENT_ID]) {
                        await saveSubscription(selectedPlanId, session.user.id);
                        router.replace('/(tabs)');
                    } else {
                        Alert.alert('Purchase Status', 'Purchase may be processing. Please check back in a few minutes or contact support if the issue persists.');
                    }
                }

            } catch (error: any) {
                console.error('Purchase error:', error);
                if (error.userCancelled) {
                    console.log('User cancelled purchase');
                    return;
                }
                Alert.alert(
                    'Purchase Failed',
                    error.message || 'Something went wrong during purchase. Please try again.'
                );
            } finally {
                setIsSubscribing(false);
            }
            return;
        }

        /* ── NATIVE (App Store) ── */
        if (!rcReady || !nativeAvailable || !PurchasesNative) {
            Alert.alert('Setup', 'Purchases not ready. Use a dev/prod build (not Expo Go).');
            return;
        }

        setIsSubscribing(true);
        try {
            const rcId = RC_PACKAGE_ID_MAP[selectedPlanId];
            const offerings = await PurchasesNative.getOfferings();
            const offering =
                (RC_OFFERING_ID ? offerings?.all?.[RC_OFFERING_ID] : offerings?.current) ||
                Object.values(offerings?.all || {})[0];

            const pkg = offering?.availablePackages?.find(
                (p: any) => p?.identifier === rcId || p?.product?.identifier === rcId
            );
            if (!pkg) {
                Alert.alert('Setup', `Package "${rcId}" not found in offering.`);
                return;
            }

            let info: any | null = null;
            try {
                const { customerInfo } = await PurchasesNative.purchasePackage(pkg);
                info = customerInfo ?? null;
            } catch {
                try { info = await PurchasesNative.getCustomerInfo(); } catch {}
                if (!hasActive(info)) {
                    try { const r = await PurchasesNative.restorePurchases(); info = r?.customerInfo ?? r ?? null; } catch {}
                }
            }

            if (hasActive(info)) {
                await saveSubscription(selectedPlanId, session.user.id);
                await new Promise(r => setTimeout(r, 200));
                router.replace('/(tabs)');
            } else {
                Alert.alert(t('subscribe.infoTitle') || 'Info', t('subscribe.noActiveSub') || 'No active subscription found.');
            }
        } finally {
            setIsSubscribing(false);
        }
    };

    const renderPlans = () => {
        if (loading) return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />;

        if (!profile) {
            const monthly = [subscriptionPlans.farm_s, subscriptionPlans.farm_m, subscriptionPlans.farm_l, subscriptionPlans.admin];
            const yearly  = [subscriptionPlans.farm_s_yearly, subscriptionPlans.farm_m_yearly, subscriptionPlans.farm_l_yearly, subscriptionPlans.employee];
            return (isYearly ? yearly : monthly).map((p) => (
                <PlanCard key={p.id} colors={colors} plan={p} onSelect={setSelectedPlanId} isSelected={selectedPlanId === p.id} t={t} />
            ));
        }

        const farmPlans = isYearly
            ? [subscriptionPlans.farm_s_yearly, subscriptionPlans.farm_m_yearly, subscriptionPlans.farm_l_yearly]
            : [subscriptionPlans.farm_s, subscriptionPlans.farm_m, subscriptionPlans.farm_l];

        switch (profile.role) {
            case 'Arbeitnehmer':
                return <PlanCard colors={colors} plan={subscriptionPlans.employee} onSelect={setSelectedPlanId} isSelected={selectedPlanId === subscriptionPlans.employee.id} t={t} />;
            case 'Rechnungsschreiber':
                return <PlanCard colors={colors} plan={subscriptionPlans.admin} onSelect={setSelectedPlanId} isSelected={selectedPlanId === subscriptionPlans.admin.id} t={t} />;
            case 'Betrieb':
                return (
                    <>
                        <View style={styles.toggleRow}>
                            <Text style={[styles.toggleLabel, { color: colors.textSecondary }]}>{t('subscribe.monthly')}</Text>
                            <Switch
                                value={isYearly}
                                onValueChange={(v) => { setIsYearly(v); setSelectedPlanId(null); }}
                                trackColor={{ false: `${colors.surface}AA`, true: colors.primary }}
                                thumbColor={colors.background}
                            />
                            <Text style={[styles.toggleLabel, { color: colors.textSecondary }]}>{t('subscribe.yearly')}</Text>
                            <View style={[styles.saveBadge, { backgroundColor: colors.success }]}><Text style={styles.saveBadgeText}>{t('subscribe.save10')}</Text></View>
                        </View>
                        {farmPlans.map((p) => (
                            <PlanCard key={p.id} colors={colors} plan={p} onSelect={setSelectedPlanId} isSelected={selectedPlanId === p.id} t={t} />
                        ))}
                    </>
                );
            default:
                return null;
        }
    };

    const buttonDisabled = loading || isSubscribing || !selectedPlanId || !rcReady;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Animated.View style={{ flex: 1, opacity: fade }}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    <MaterialCommunityIcons name="shield-lock-outline" size={60} color={colors.primary} />
                    <Text style={[styles.title, { color: colors.text }]}>{t('subscribe.title')}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {t('subscribe.subtitle')}
                        <Text style={{ fontWeight: 'bold', color: colors.text }}>
                            {profile?.role ? ` ${t(`roles.${profile.role}`)}` : ''}
                        </Text>.
                    </Text>

                    {Platform.OS === 'web' && rcReady && !rcStripe && (
                        <Text style={[styles.subtitle, { color: colors.warning }]}>
                            purchases-js missing Stripe helper. Update @revenuecat/purchases-js or use native app.
                        </Text>
                    )}
                    {rcError && (
                        <Text style={[styles.subtitle, { color: colors.warning }]} numberOfLines={5}>
                            Setup error: {rcError}
                        </Text>
                    )}

                    {renderPlans()}
                </ScrollView>

                <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <TouchableOpacity
                        style={[styles.cta, { backgroundColor: colors.primary }, buttonDisabled && styles.disabled]}
                        onPress={handlePurchase}
                        disabled={buttonDisabled}
                        activeOpacity={0.9}
                    >
                        {isSubscribing ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{t('subscribe.buttonText') || 'Subscribe Now'}</Text>}
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}

/* ───────────────── STYLES ───────────────── */

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { alignItems: 'center', padding: 24, paddingBottom: 150 },
    title: { fontFamily: baseFontFamily, fontSize: 28, fontWeight: 'bold', marginVertical: 16, textAlign: 'center' },
    subtitle: { fontFamily: baseFontFamily, fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 24 },

    planCard: { width: '100%', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 2, alignItems: 'center' },
    planTitle: { fontFamily: baseFontFamily, fontSize: 20, fontWeight: 'bold', marginTop: 12 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginVertical: 8 },
    price: { fontFamily: baseFontFamily, fontSize: 36, fontWeight: 'bold' },
    period: { fontFamily: baseFontFamily, fontSize: 16, marginLeft: 4 },
    features: { width: '100%', marginTop: 12 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
    featureText: { marginLeft: 8, fontFamily: baseFontFamily },

    toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    toggleLabel: { fontFamily: baseFontFamily, fontSize: 14, marginHorizontal: 8 },
    saveBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
    saveBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
    cta: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
    disabled: { opacity: 0.5 },
    ctaText: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: baseFontFamily },
});