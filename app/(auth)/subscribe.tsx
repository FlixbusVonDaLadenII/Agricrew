// app/(auth)/subscribe.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Purchases, { PurchasesOffering, PurchasesPackage, PACKAGE_TYPE } from 'react-native-purchases';


import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/SessionProvider';
import { getThemeColors, Theme } from '@/theme/colors';

const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Profile = { role: 'Arbeitnehmer' | 'Betrieb' | 'Rechnungsschreiber' } | null;

// This can be kept for mapping icons, but the source of truth will be RevenueCat
const PLAN_ICONS: { [key: string]: IconName } = {
    employee: 'account-hard-hat',
    admin: 'file-document-outline',
    farm: 'tractor-variant',
};

function useTheme() {
    const scheme = useColorScheme();
    return useMemo(() => getThemeColors((scheme || 'light') as Theme), [scheme]);
}

function Radio({ selected, color }: { selected: boolean; color: string }) {
    return (
        <View
            style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: selected ? color : `${color}55`,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} /> : null}
        </View>
    );
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
    return (
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: bg }}>
            <Text style={{ color: fg, fontSize: 12, fontWeight: '700', fontFamily: baseFontFamily }}>{label}</Text>
        </View>
    );
}

function PlanCard({
                      rcPackage,
                      selected,
                      onSelect,
                      t,
                      colors,
                      highlight,
                      icon
                  }: {
    rcPackage: PurchasesPackage;
    selected: boolean;
    onSelect: (pkg: PurchasesPackage) => void;
    t: (k: string, opts?: any) => any;
    colors: ReturnType<typeof getThemeColors>;
    highlight?: boolean;
    icon: IconName;
}) {
    const { product } = rcPackage;

    return (
        <Pressable
            onPress={() => onSelect(rcPackage)}
            style={({ pressed }) => [
                styles.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                },
                stylesShadow.card(colors),
                highlight && { borderColor: colors.primary },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
        >
            <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons
                        name={icon}
                        size={26}
                        color={selected ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{product.title}</Text>
                </View>
                <Radio selected={selected} color={colors.primary} />
            </View>

            <View style={styles.priceRow}>
                <Text style={[styles.price, { color: colors.text }]}>{product.priceString}</Text>
                {/* You might want to add a "per month/year" text from your translations if needed */}
            </View>

            <View style={styles.features}>
                {/* Features can be hardcoded or managed in RevenueCat's metadata */}
                <View style={styles.featureRow}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                    <Text style={[styles.featureText, { color: colors.textSecondary }]}>{product.description}</Text>
                </View>
            </View>
        </Pressable>
    );
}

export default function SubscriptionScreen() {
    const colors = useTheme();
    const insets = useSafeAreaInsets();
    const fade = useRef(new Animated.Value(1)).current;

    const { t } = useTranslation();
    const { session } = useSession();

    const [profile, setProfile] = useState<Profile>(null);
    const [loading, setLoading] = useState(true);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
    const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
    const [isYearly, setIsYearly] = useState(false);

    useEffect(() => {
        fade.setValue(0);
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    }, [colors, fade]);

    useEffect(() => {
        const loadData = async () => {
            if (!session?.user) {
                setLoading(false);
                return;
            }
            // First, set user identity with RevenueCat
            await Purchases.logIn(session.user.id);


            // Load offerings from RevenueCat
            try {
                const fetchedOfferings = await Purchases.getOfferings();
                if (fetchedOfferings.current) {
                    setOfferings(fetchedOfferings.current);
                }
            } catch (e) {
                Alert.alert("Error", "Could not fetch subscription plans.");
            }


            // Load profile from Supabase
            const { data: prof, error: profErr } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profErr) {
                Alert.alert(t('subscribe.errorTitle'), t('subscribe.profileError'));
            } else {
                setProfile(prof as Profile);
            }
            setLoading(false);
        };
        loadData();
    }, [session, t]);

    const handlePurchase = async () => {
        if (!selectedPackage) return;
        setIsSubscribing(true);
        try {
            const { customerInfo } = await Purchases.purchasePackage(selectedPackage);

            // Here you can check for active entitlements
            // For example, if you have an entitlement called "premium"
            if (typeof customerInfo.entitlements.active.premium !== "undefined") {
                // The purchase was successful
                Alert.alert(t('subscribe.successTitle'), t('subscribe.purchaseSuccess'));
                router.replace('/');
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                Alert.alert(t('subscribe.purchaseErrorTitle'), e.message);
            }
        } finally {
            setIsSubscribing(false);
        }
    };

    const packages = useMemo(() => {
        if (!offerings) return [];
        const duration = isYearly ? PACKAGE_TYPE.ANNUAL : PACKAGE_TYPE.MONTHLY;
        return offerings.availablePackages.filter(p => p.packageType === duration);
    }, [offerings, isYearly]);


    const getIconForPackage = (pkg: PurchasesPackage): IconName => {
        const id = pkg.product.identifier.toLowerCase();
        if (id.includes('employee')) return PLAN_ICONS.employee;
        if (id.includes('admin')) return PLAN_ICONS.admin;
        return PLAN_ICONS.farm;
    }


    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <Animated.View style={{ flex: 1, opacity: fade }}>
                <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 20 }]}>
                    {/* Hero */}
                    <View style={{ alignItems: 'center' }}>
                        <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}1A` }]}>
                            <MaterialCommunityIcons name="shield-lock-outline" size={36} color={colors.primary} />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>{t('subscribe.title')}</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {t('subscribe.subtitle')}
                            <Text style={{ fontWeight: '700', color: colors.text }}>
                                {profile?.role ? ` ${t(`roles.${profile.role}`)}` : ''}
                            </Text>
                            .
                        </Text>
                    </View>

                    {profile?.role === 'Betrieb' && (
                        <View style={[styles.segmentWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Pressable
                                onPress={() => setIsYearly(false)}
                                style={[
                                    styles.segmentBtn,
                                    { backgroundColor: !isYearly ? colors.primary : 'transparent' },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.segmentText,
                                        { color: !isYearly ? colors.background : colors.text },
                                    ]}
                                >
                                    {t('subscribe.monthly')}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => setIsYearly(true)}
                                style={[
                                    styles.segmentBtn,
                                    { backgroundColor: isYearly ? colors.primary : 'transparent' },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.segmentText,
                                        { color: isYearly ? colors.background : colors.text },
                                    ]}
                                >
                                    {t('subscribe.yearly')}
                                </Text>
                            </Pressable>

                            <View style={{ marginLeft: 8 }}>
                                <Badge label={t('subscribe.save10')} bg={colors.success} fg="#fff" />
                            </View>
                        </View>
                    )}

                    {loading ? (
                        <View style={{ paddingTop: 40 }}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        packages.map((pkg) => (
                            <PlanCard
                                key={pkg.identifier}
                                rcPackage={pkg}
                                icon={getIconForPackage(pkg)}
                                selected={selectedPackage?.identifier === pkg.identifier}
                                onSelect={setSelectedPackage}
                                t={t}
                                colors={colors}
                            />
                        ))
                    )}
                </ScrollView>
                <View
                    style={[
                        styles.footer,
                        {
                            backgroundColor: colors.background,
                            borderTopColor: colors.border,
                            paddingBottom: Math.max(insets.bottom, 12),
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.cta,
                            { backgroundColor: colors.primary },
                            (!selectedPackage || isSubscribing) && { opacity: 0.5 },
                        ]}
                        onPress={handlePurchase}
                        disabled={loading || isSubscribing || !selectedPackage}
                        activeOpacity={0.9}
                    >
                        {isSubscribing ? (
                            <ActivityIndicator color={colors.background} />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="credit-card-check-outline" size={18} color={colors.background} />
                                <Text style={[styles.ctaText, { color: colors.background }]}>
                                    {t('subscribe.buttonText')}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    scroll: { paddingHorizontal: 20, paddingTop: 20 },

    heroIcon: {
        width: 64,
        height: 64,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontFamily: baseFontFamily,
        fontSize: 26,
        fontWeight: '800',
        marginTop: 16,
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    subtitle: {
        fontFamily: baseFontFamily,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginTop: 8,
        marginBottom: 18,
    },
    current: {
        marginTop: 8,
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: 8,
    },
    currentText: { fontFamily: baseFontFamily, fontWeight: '700' },

    segmentWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
        padding: 6,
        marginBottom: 12,
    },
    segmentBtn: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentText: {
        fontFamily: baseFontFamily,
        fontSize: 14,
        fontWeight: '700',
    },

    card: {
        borderWidth: 2,
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontFamily: baseFontFamily, fontSize: 18, fontWeight: '700', marginLeft: 10 },

    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
    price: { fontFamily: baseFontFamily, fontSize: 32, fontWeight: '800' },
    period: { fontFamily: baseFontFamily, fontSize: 14, marginLeft: 6 },

    features: { marginTop: 12, gap: 8 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    featureText: { fontFamily: baseFontFamily, fontSize: 14 },

    footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    cta: {
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    ctaText: { fontFamily: baseFontFamily, fontSize: 16, fontWeight: '800' },
});

const stylesShadow = {
    card: (c: ReturnType<typeof getThemeColors>) =>
        Platform.select({
            ios: { shadowColor: c.border, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 2 },
        }) as any,
};