import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, Platform, Switch, Modal, FlatList,
    KeyboardAvoidingView, Keyboard, Animated, useColorScheme
} from 'react-native';
import { getThemeColors, Theme } from '@/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';


const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' });

const DRIVING_LICENSES = ['B', 'BE', 'C', 'CE', 'C1', 'C1E', 'T', 'L'];
const LOCATIONIQ_API_KEY = process.env.EXPO_PUBLIC_LOCATIONIQ_API_KEY;

// --- Animation Constants (kept, but tuned slightly) ---
const HEADER_MAX_HEIGHT = 120;
const HEADER_MIN_HEIGHT = Platform.OS === 'ios' ? 60 : 70;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

interface LocationIQSuggestion {
    place_id: string;
    display_name: string;
    lat: string;
    lon: string;
}

interface FarmProfileData {
    role: string | null;
    farm_location_address?: string | null;
    farm_latitude?: number | null;
    farm_longitude?: number | null;
}

interface QuotaData {
    jobs: number;
    sos: number;
}

export default function AddJobScreen() {
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const scheme = useColorScheme();
    const themeColors = useMemo(
        () => getThemeColors((scheme ?? 'light') as Theme),
        [scheme]
    );
    const scrollY = useRef(new Animated.Value(0)).current;

    const jobTypesOptions = t('jobTypes', { returnObjects: true }) as Record<string, string>;
    const jobTypeKeys = Object.keys(jobTypesOptions);
    const translatedCountries = t('filters.countries', { returnObjects: true }) as Record<string, string>;
    const countryKeys = Object.keys(translatedCountries);

    const [session, setSession] = useState<Session | null>(null);
    const [farmProfile, setFarmProfile] = useState<FarmProfileData | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [quotas, setQuotas] = useState<QuotaData>({ jobs: 0, sos: 0 });
    const [loadingQuotas, setLoadingQuotas] = useState(true);

    // Form States
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [country, setCountry] = useState<string>(countryKeys[0] || '');
    const [region, setRegion] = useState<string>('');
    const [salaryPerHour, setSalaryPerHour] = useState('');
    const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
    const [jobTypes, setJobTypes] = useState<string[]>([]);
    const [isActive, setIsActive] = useState(true);
    const [isUrgent, setIsUrgent] = useState(false);
    const [offersAccommodation, setOffersAccommodation] = useState(false);

    // Autocomplete States
    const [locationSuggestions, setLocationSuggestions] = useState<LocationIQSuggestion[]>([]);
    const [selectedLocationCoords, setSelectedLocationCoords] = useState<{ lat: number; lng: number } | null>(null);

    // UI States
    const [countryPickerVisible, setCountryPickerVisible] = useState(false);
    const [regionPickerVisible, setRegionPickerVisible] = useState(false);
    const [tempCountry, setTempCountry] = useState<string>(country);
    const [tempRegion, setTempRegion] = useState<string>(region);
    const [countrySearch, setCountrySearch] = useState('');
    const [regionSearch, setRegionSearch] = useState('');

    const availableRegions = country ? (t(`filters.regions.${country}`, { returnObjects: true }) as Record<string, string>) : {};

    useEffect(() => {
        const handler = setTimeout(() => {
            if (location.trim().length > 2 && selectedLocationCoords === null) {
                fetchLocationSuggestions(location);
            } else {
                setLocationSuggestions([]);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [location, country, i18n.language]);

    const fetchLocationSuggestions = async (query: string) => {
        if (!query || !LOCATIONIQ_API_KEY) return;
        try {
            const countryCode = country === 'germany' ? 'de' : country === 'austria' ? 'at' : 'ch';
            const response = await fetch(
                `https://api.locationiq.com/v1/autocomplete.php?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(
                    query
                )}&countrycodes=${countryCode}&limit=5&format=json&accept-language=${i18n.language}`
            );
            const data = await response.json();
            if (data && !data.error) setLocationSuggestions(data);
            else setLocationSuggestions([]);
        } catch (error) {
            console.error('Failed to fetch location suggestions:', error);
        }
    };

    const onLocationSuggestionSelect = (suggestion: LocationIQSuggestion) => {
        setLocation(suggestion.display_name);
        setSelectedLocationCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
        setLocationSuggestions([]);
        Keyboard.dismiss();
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
        return () => subscription?.unsubscribe();
    }, []);

    useEffect(() => {
        if (session?.user) {
            setLoadingUser(true);
            setLoadingQuotas(true);

            supabase
                .from('profiles')
                .select('role, farm_location_address, farm_latitude, farm_longitude')
                .eq('id', session.user.id)
                .single()
                .then(({ data, error }) => {
                    if (error) console.error('Error fetching user profile:', error);
                    setFarmProfile(data as FarmProfileData | null);
                    setLoadingUser(false);
                });

            supabase
                .from('farm_quotas')
                .select('remaining_jobs, remaining_sos')
                .eq('farm_id', session.user.id)
                .single()
                .then(({ data, error }) => {
                    if (data) setQuotas({ jobs: data.remaining_jobs || 0, sos: data.remaining_sos || 0 });
                    if (error) {
                        console.error('Error fetching quotas:', error);
                        setQuotas({ jobs: 0, sos: 0 });
                    }
                    setLoadingQuotas(false);
                });
        } else {
            setFarmProfile(null);
            setLoadingUser(false);
            setLoadingQuotas(false);
        }
    }, [session]);

    useEffect(() => { setTempCountry(country); }, [country, countryPickerVisible]);
    useEffect(() => { setTempRegion(region); }, [region, regionPickerVisible]);
    useEffect(() => {
        if (!country) return;
        const regionKeys = Object.keys(availableRegions);
        if (regionKeys.length > 0 && !regionKeys.includes(region)) setRegion('');
    }, [country, t, region, availableRegions]);

    const useFarmAddress = () => {
        if (farmProfile?.farm_location_address && farmProfile.farm_latitude && farmProfile.farm_longitude) {
            setLocation(farmProfile.farm_location_address);
            setSelectedLocationCoords({ lat: farmProfile.farm_latitude, lng: farmProfile.farm_longitude });
            Alert.alert(t('addJob.locationSet'), t('addJob.locationSetMessage'));
        } else {
            Alert.alert(t('addJob.alertNoFarmAddressTitle'), t('addJob.alertNoFarmAddressMessage'));
        }
    };

    const toggleLicense = (license: string) =>
        setSelectedLicenses(prev => (prev.includes(license) ? prev.filter(l => l !== license) : [...prev, license]));
    const toggleJobType = (typeKey: string) =>
        setJobTypes(prev => (prev.includes(typeKey) ? prev.filter(t => t !== typeKey) : [...prev, typeKey]));

    const handlePurchaseSos = async () => {
        Alert.alert(t('addJob.purchaseSimulationTitle'), t('addJob.purchaseSimulationMessage'));
    };

    const handleAddJob = async () => {
        if (farmProfile?.role !== 'Betrieb' || !session?.user) {
            Alert.alert(t('addJob.permissionDeniedTitle'), t('addJob.permissionDenied'));
            return;
        }
        if (!title || !description || !location || !country || !region) {
            Alert.alert(t('addJob.alertMissingFields'), t('addJob.alertMissingFieldsMessage'));
            return;
        }
        if (!selectedLocationCoords) {
            Alert.alert(t('addJob.alertInvalidLocation'), t('addJob.alertInvalidLocationMessage'));
            return;
        }

        setSubmitting(true);

        try {
            const { data: canPostJob, error: jobQuotaError } = await supabase.rpc('can_post_job', { farm_id_input: session.user.id });
            if (jobQuotaError || !canPostJob) {
                Alert.alert(t('addJob.quotaExceededTitle'), t('addJob.quotaExceededMessage'));
                setSubmitting(false);
                return;
            }

            if (isUrgent) {
                const { data: canPostSos, error: sosQuotaError } = await supabase.rpc('can_post_sos', { farm_id_input: session.user.id });
                if (sosQuotaError || !canPostSos) {
                    Alert.alert(
                        t('addJob.sosQuotaExceededTitle'),
                        t('addJob.sosQuotaExceededMessage'),
                        [
                            { text: t('common.cancel'), style: 'cancel' },
                            { text: t('addJob.purchaseButton'), onPress: handlePurchaseSos },
                        ]
                    );
                    setSubmitting(false);
                    return;
                }
            }

            let salaryToInsert: number | null = null;
            if (salaryPerHour) {
                const parsedSalary = parseFloat(salaryPerHour.replace(',', '.'));
                if (isNaN(parsedSalary)) {
                    Alert.alert(t('addJob.alertInvalidSalary'), t('addJob.alertInvalidSalaryMessage'));
                    setSubmitting(false);
                    return;
                }
                salaryToInsert = parsedSalary;
            }

            const { error } = await supabase.from('jobs').insert({
                title,
                description,
                location,
                country,
                region,
                salary_per_hour: salaryToInsert,
                required_licenses: selectedLicenses,
                job_type: jobTypes,
                is_active: isActive,
                is_urgent: isUrgent,
                offers_accommodation: offersAccommodation,
                farm_id: session.user.id,
                latitude: selectedLocationCoords.lat,
                longitude: selectedLocationCoords.lng,
            });

            if (error) throw error;

            await supabase.rpc('decrement_job_quota', { farm_id_input: session.user.id });
            if (isUrgent) await supabase.rpc('decrement_sos_quota', { farm_id_input: session.user.id });

            Alert.alert(t('addJob.alertSuccess'), t('addJob.alertSuccessMessage'));
            setTitle(''); setDescription(''); setLocation('');
            setCountry(countryKeys[0]); setRegion(''); setSalaryPerHour('');
            setSelectedLicenses([]); setJobTypes([]); setIsActive(true); setIsUrgent(false);
            setOffersAccommodation(false); setSelectedLocationCoords(null);
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message || t('addJob.alertSubmitError'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleCountrySelectionDone = () => { setCountry(tempCountry); setRegion(''); setCountryPickerVisible(false); setCountrySearch(''); };
    const handleCountrySelectionCancel = () => { setTempCountry(country); setCountryPickerVisible(false); setCountrySearch(''); };
    const handleRegionSelectionDone = () => { setRegion(tempRegion); setRegionPickerVisible(false); setRegionSearch(''); };
    const handleRegionSelectionCancel = () => { setTempRegion(region); setRegionPickerVisible(false); setRegionSearch(''); };

    const filteredCountries = countryKeys.filter(c => translatedCountries[c].toLowerCase().includes(countrySearch.toLowerCase()));
    const filteredRegions = Object.keys(availableRegions).filter(r => availableRegions[r].toLowerCase().includes(regionSearch.toLowerCase()));

    const renderPickerItem = ({
                                  item, isCountryPicker, tempValue, setTempValue,
                              }: {
        item: string; isCountryPicker: boolean; tempValue: string; setTempValue: (val: string) => void;
    }) => (
        <TouchableOpacity
            style={[styles.listItem, item === tempValue && { backgroundColor: themeColors.primaryLight + '30' }]}
            onPress={() => setTempValue(item)}
            activeOpacity={0.85}
        >
            <Text style={[styles.listItemText, { color: themeColors.text }]}>
                {isCountryPicker ? translatedCountries[item] : availableRegions[item]}
            </Text>
            {item === tempValue && <MaterialCommunityIcons name="check" size={20} color={themeColors.primary} />}
        </TouchableOpacity>
    );

    // Header animations
    const headerHeight = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT + insets.top],
        extrapolate: 'clamp',
    });
    const titleScale = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
        outputRange: [1, 1, 0.9],
        extrapolate: 'clamp',
    });
    const titleTranslateY = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [0, -14],
        extrapolate: 'clamp',
    });

    if (loadingUser) {
        return (
            <View style={[styles.centeredContainer, { backgroundColor: themeColors.background }]}>
                <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
        );
    }

    if (farmProfile?.role !== 'Betrieb') {
        return (
            <View style={[styles.safeAreaContainer, { backgroundColor: themeColors.background }]}>
                <View style={[styles.headerStatic, { paddingTop: insets.top, backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
                    <Text style={[styles.pageTitleStatic, { color: themeColors.text }]}>{t('addJob.pageTitle')}</Text>
                </View>
                <View style={styles.permissionDeniedContainer}>
                    <MaterialCommunityIcons name="lock-alert-outline" size={80} color={themeColors.textSecondary} />
                    <Text style={[styles.permissionDeniedText, { color: themeColors.textSecondary }]}>{t('addJob.permissionDenied')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.safeAreaContainer, { backgroundColor: themeColors.background }]}>
            {/* Make status bar readable on both themes */}

            {/* Animated header */}
            <Animated.View
                style={[
                    styles.header,
                    {
                        height: headerHeight,
                        paddingTop: insets.top,
                        backgroundColor: themeColors.surface,
                        borderBottomColor: themeColors.border,
                    },
                ]}
            >
                <Animated.View style={[{ transform: [{ scale: titleScale }, { translateY: titleTranslateY }] }]}>
                    <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t('addJob.pageTitle')}</Text>
                </Animated.View>
            </Animated.View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
                <Animated.ScrollView
                    contentContainerStyle={{
                        paddingTop: HEADER_MAX_HEIGHT,
                        paddingBottom: insets.bottom + 24,
                        paddingHorizontal: 16,
                        width: '100%',
                        maxWidth: 960, // centered column on laptops
                        alignSelf: 'center',
                    }}
                    scrollEventThrottle={16}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.formContainer}>
                        {/* Job details */}
                        <View style={[styles.sectionCard, cardShadow(themeColors)]}>
                            <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                {t('addJob.sectionJobDetails')}
                            </Text>

                            <Text style={[styles.label, { color: themeColors.text }]}>
                                {t('addJob.labelJobTitle')} <Text style={[styles.requiredIndicator, { color: themeColors.primary }]}>*</Text>
                            </Text>
                            <TextInput
                                style={inputStyle(themeColors)}
                                placeholder={t('addJob.placeholderJobTitle')}
                                placeholderTextColor={themeColors.textHint}
                                value={title}
                                onChangeText={setTitle}
                            />

                            <Text style={[styles.label, { color: themeColors.text }]}>
                                {t('addJob.labelDescription')} <Text style={[styles.requiredIndicator, { color: themeColors.primary }]}>*</Text>
                            </Text>
                            <TextInput
                                style={[inputStyle(themeColors), styles.textArea]}
                                placeholder={t('addJob.placeholderDescription')}
                                placeholderTextColor={themeColors.textHint}
                                multiline
                                value={description}
                                onChangeText={setDescription}
                            />
                        </View>

                        {/* Location */}
                        <View style={[styles.sectionCard, cardShadow(themeColors)]}>
                            <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                {t('addJob.sectionLocation')}
                            </Text>

                            {!!farmProfile?.role && (
                                <TouchableOpacity style={[styles.useFarmAddressButton, { backgroundColor: themeColors.primaryLight + '20', borderColor: themeColors.primary }]} onPress={useFarmAddress} activeOpacity={0.9}>
                                    <MaterialCommunityIcons name="office-building-marker-outline" size={20} color={themeColors.primary} />
                                    <Text style={[styles.useFarmAddressButtonText, { color: themeColors.primary }]}>{t('addJob.useFarmAddress')}</Text>
                                </TouchableOpacity>
                            )}

                            <Text style={[styles.label, { color: themeColors.text }]}>
                                {t('addJob.labelCountry')} <Text style={[styles.requiredIndicator, { color: themeColors.primary }]}>*</Text>
                            </Text>
                            <TouchableOpacity style={pickerButton(themeColors)} onPress={() => setCountryPickerVisible(true)} activeOpacity={0.85}>
                                <Text style={[styles.modalPickerButtonText, { color: themeColors.text }]}>{translatedCountries[country] || t('addJob.selectCountry')}</Text>
                                <MaterialCommunityIcons name="chevron-down" size={24} color={themeColors.textSecondary} />
                            </TouchableOpacity>

                            <Text style={[styles.label, { color: themeColors.text }]}>
                                {t('addJob.labelRegion')} <Text style={[styles.requiredIndicator, { color: themeColors.primary }]}>*</Text>
                            </Text>
                            <TouchableOpacity
                                style={[pickerButton(themeColors), !Object.keys(availableRegions).length && { backgroundColor: themeColors.background, opacity: 0.6 }]}
                                onPress={() => Object.keys(availableRegions).length && setRegionPickerVisible(true)}
                                disabled={!Object.keys(availableRegions).length}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.modalPickerButtonText, { color: Object.keys(availableRegions).length ? themeColors.text : themeColors.textHint }]}>
                                    {availableRegions[region] || t('addJob.selectRegion')}
                                </Text>
                                <MaterialCommunityIcons name="chevron-down" size={24} color={Object.keys(availableRegions).length ? themeColors.textSecondary : themeColors.textHint} />
                            </TouchableOpacity>

                            <Text style={[styles.label, { color: themeColors.text }]}>
                                {t('addJob.labelExactLocation')} <Text style={[styles.requiredIndicator, { color: themeColors.primary }]}>*</Text>
                            </Text>
                            <TextInput
                                style={inputStyle(themeColors)}
                                placeholder={t('addJob.placeholderExactLocation')}
                                placeholderTextColor={themeColors.textHint}
                                value={location}
                                onChangeText={(text) => {
                                    setLocation(text);
                                    setSelectedLocationCoords(null);
                                }}
                            />

                            {locationSuggestions.length > 0 && (
                                <FlatList
                                    data={locationSuggestions}
                                    keyExtractor={(item) => item.place_id}
                                    scrollEnabled={false}
                                    style={[styles.suggestionsList, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity onPress={() => onLocationSuggestionSelect(item)} style={[styles.suggestionItem, { borderBottomColor: themeColors.border }]} activeOpacity={0.9}>
                                            <Text style={[styles.suggestionText, { color: themeColors.text }]}>{item.display_name}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                        </View>

                        {/* Compensation & Types */}
                        <View style={[styles.sectionCard, cardShadow(themeColors)]}>
                            <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                {t('addJob.sectionCompensation')}
                            </Text>

                            <Text style={[styles.label, { color: themeColors.text }]}>{t('addJob.labelSalary')}</Text>
                            <TextInput
                                style={inputStyle(themeColors)}
                                placeholder={t('addJob.placeholderSalary')}
                                placeholderTextColor={themeColors.textHint}
                                keyboardType="numeric"
                                value={salaryPerHour}
                                onChangeText={setSalaryPerHour}
                            />

                            <Text style={[styles.label, { color: themeColors.text }]}>{t('addJob.labelJobType')}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobTypeScrollContainer}>
                                {jobTypeKeys.map((key) => {
                                    const selected = jobTypes.includes(key);
                                    return (
                                        <TouchableOpacity
                                            key={key}
                                            style={[
                                                styles.jobTypeButton,
                                                {
                                                    backgroundColor: selected ? themeColors.primary : themeColors.surfaceHighlight,
                                                    borderColor: selected ? themeColors.primary : themeColors.border,
                                                },
                                            ]}
                                            onPress={() => toggleJobType(key)}
                                            activeOpacity={0.9}
                                        >
                                            <Text
                                                style={[
                                                    styles.jobTypeText,
                                                    { color: selected ? themeColors.background : themeColors.text },
                                                    selected && styles.jobTypeTextSelected,
                                                ]}
                                            >
                                                {jobTypesOptions[key]}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Requirements */}
                        <View style={[styles.sectionCard, cardShadow(themeColors)]}>
                            <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                {t('addJob.sectionRequirements')}
                            </Text>

                            <Text style={[styles.label, { color: themeColors.text }]}>{t('addJob.labelLicenses')}</Text>
                            <View style={styles.licensesContainer}>
                                {DRIVING_LICENSES.map((license) => {
                                    const selected = selectedLicenses.includes(license);
                                    return (
                                        <TouchableOpacity
                                            key={license}
                                            style={[
                                                styles.licenseCheckbox,
                                                {
                                                    backgroundColor: selected ? themeColors.primary : themeColors.surfaceHighlight,
                                                    borderColor: selected ? themeColors.primary : themeColors.border,
                                                },
                                            ]}
                                            onPress={() => toggleLicense(license)}
                                            activeOpacity={0.9}
                                        >
                                            <Text
                                                style={[
                                                    styles.licenseText,
                                                    { color: selected ? themeColors.background : themeColors.text },
                                                    selected && styles.licenseTextSelected,
                                                ]}
                                            >
                                                {license}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Status */}
                        <View style={[styles.sectionCard, cardShadow(themeColors)]}>
                            <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                {t('addJob.sectionStatus')}
                            </Text>

                            <View style={styles.toggleRow}>
                                <Text style={[styles.label, { color: themeColors.text }]}>{t('addJob.labelActive')}</Text>
                                <Switch
                                    trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary + '80' }}
                                    thumbColor={isActive ? themeColors.primary : themeColors.textSecondary}
                                    onValueChange={setIsActive}
                                    value={isActive}
                                />
                            </View>

                            <View style={styles.toggleRow}>
                                <Text style={[styles.label, { color: themeColors.text }]}>{t('addJob.labelUrgent')}</Text>
                                <Switch
                                    trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary + '80' }}
                                    thumbColor={isUrgent ? themeColors.primary : themeColors.textSecondary}
                                    onValueChange={setIsUrgent}
                                    value={isUrgent}
                                />
                            </View>

                            <View style={styles.toggleRow}>
                                <Text style={[styles.label, { color: themeColors.text }]}>{t('addJob.labelOffersAccommodation')}</Text>
                                <Switch
                                    trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary + '80' }}
                                    thumbColor={offersAccommodation ? themeColors.primary : themeColors.textSecondary}
                                    onValueChange={setOffersAccommodation}
                                    value={offersAccommodation}
                                />
                            </View>
                        </View>

                        {/* Quotas */}
                        <View style={styles.quotaContainer}>
                            {loadingQuotas ? (
                                <ActivityIndicator color={themeColors.textSecondary} />
                            ) : (
                                <Text style={[styles.quotaText, { color: themeColors.textSecondary }]}>
                                    {`Jobs: ${quotas.jobs}   SOS: ${quotas.sos}`}
                                </Text>
                            )}
                        </View>

                        {/* Submit */}
                        <TouchableOpacity
                            style={[styles.submitButton, { backgroundColor: themeColors.primary, shadowColor: themeColors.primaryDark }]}
                            onPress={handleAddJob}
                            disabled={submitting}
                            activeOpacity={0.9}
                        >
                            {submitting ? (
                                <ActivityIndicator color={themeColors.background} />
                            ) : (
                                <Text style={[styles.submitButtonText, { color: themeColors.background }]}>
                                    {t('addJob.buttonPublish')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.ScrollView>
            </KeyboardAvoidingView>

            {/* Country Picker */}
            <Modal animationType="slide" transparent visible={countryPickerVisible} onRequestClose={handleCountrySelectionCancel}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
                        <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t('addJob.modalSelectCountry')}</Text>
                        <TextInput
                            style={[styles.modalSearchInput, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border, color: themeColors.text }]}
                            placeholder={t('addJob.modalSearchPlaceholder')}
                            value={countrySearch}
                            onChangeText={setCountrySearch}
                            placeholderTextColor={themeColors.textHint}
                        />
                        <FlatList
                            data={filteredCountries}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => renderPickerItem({ item, isCountryPicker: true, tempValue: tempCountry, setTempValue: setTempCountry })}
                            ListEmptyComponent={!filteredCountries.length ? <Text style={[styles.emptyListText, { color: themeColors.textHint }]}>{t('addJob.modalNoResults')}</Text> : null}
                            style={styles.listContainer}
                        />
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity style={[styles.modalActionButton, styles.modalCancelButton, { backgroundColor: themeColors.surfaceHighlight }]} onPress={handleCountrySelectionCancel}>
                                <Text style={[styles.modalCancelButtonText, { color: themeColors.text }]}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalActionButton, styles.modalDoneButton, { backgroundColor: themeColors.primary }]} onPress={handleCountrySelectionDone}>
                                <Text style={[styles.modalDoneButtonText, { color: themeColors.background }]}>{t('common.done')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Region Picker */}
            <Modal animationType="slide" transparent visible={regionPickerVisible} onRequestClose={handleRegionSelectionCancel}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
                        <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t('addJob.modalSelectRegion')}</Text>
                        <TextInput
                            style={[styles.modalSearchInput, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border, color: themeColors.text }]}
                            placeholder={t('addJob.modalSearchPlaceholder')}
                            value={regionSearch}
                            onChangeText={setRegionSearch}
                            placeholderTextColor={themeColors.textHint}
                        />
                        <FlatList
                            data={filteredRegions}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => renderPickerItem({ item, isCountryPicker: false, tempValue: tempRegion, setTempValue: setTempRegion })}
                            ListEmptyComponent={!filteredRegions.length ? <Text style={[styles.emptyListText, { color: themeColors.textHint }]}>{t('addJob.modalNoResults')}</Text> : null}
                            style={styles.listContainer}
                        />
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity style={[styles.modalActionButton, styles.modalCancelButton, { backgroundColor: themeColors.surfaceHighlight }]} onPress={handleRegionSelectionCancel}>
                                <Text style={[styles.modalCancelButtonText, { color: themeColors.text }]}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalActionButton, styles.modalDoneButton, { backgroundColor: themeColors.primary }]} onPress={handleRegionSelectionDone}>
                                <Text style={[styles.modalDoneButtonText, { color: themeColors.background }]}>{t('common.done')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const SPACING = { xsmall: 4, small: 8, medium: 16, large: 24, xlarge: 32 };

// helper styles that depend on theme colors
const inputStyle = (themeColors: ReturnType<typeof getThemeColors>) => ({
    fontFamily: baseFontFamily,
    width: '100%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: themeColors.surfaceHighlight,
    color: themeColors.text,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    marginBottom: SPACING.medium,
} as const);

const pickerButton = (themeColors: ReturnType<typeof getThemeColors>) => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: themeColors.surfaceHighlight,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    paddingHorizontal: 15,
    height: 52,
    marginBottom: SPACING.medium,
} as const);

const cardShadow = (themeColors: ReturnType<typeof getThemeColors>) =>
    ({
        shadowColor: Platform.OS === 'ios' ? '#000' : themeColors.surface,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: Platform.OS === 'ios' ? 0.08 : 0,
        shadowRadius: 12,
        elevation: Platform.OS === 'android' ? 2 : 0,
    } as const);

const styles = StyleSheet.create({
    safeAreaContainer: { flex: 1 },
    header: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 10,
        justifyContent: 'flex-end',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingBottom: 10,
    },
    headerStatic: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: Platform.OS === 'ios' ? 50 : 60,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pageTitle: { fontFamily: baseFontFamily, fontSize: 32, fontWeight: '700' as const, letterSpacing: 0.2 },
    pageTitleStatic: { fontFamily: baseFontFamily, fontSize: 18, fontWeight: '700' as const },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    permissionDeniedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.large },
    permissionDeniedText: { fontFamily: baseFontFamily, fontSize: 18, textAlign: 'center', marginTop: SPACING.medium },

    keyboardAvoidingView: { flex: 1 },
    formContainer: { paddingBottom: SPACING.xlarge, paddingTop: SPACING.medium },

    sectionCard: {
        width: '100%',
        borderRadius: 16,
        padding: SPACING.large,
        marginBottom: SPACING.large,
        borderWidth: StyleSheet.hairlineWidth,
    },
    sectionTitle: {
        fontFamily: baseFontFamily,
        fontSize: 16,
        fontWeight: '700' as const,
        marginBottom: SPACING.medium,
        paddingBottom: SPACING.small,
        borderBottomWidth: StyleSheet.hairlineWidth,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    label: { fontFamily: baseFontFamily, fontSize: 14, marginBottom: SPACING.xsmall, fontWeight: '600' as const },
    requiredIndicator: { fontWeight: '700' as const },

    textArea: { minHeight: 120, textAlignVertical: 'top', lineHeight: 20 },

    modalPickerButtonText: { fontFamily: baseFontFamily, fontSize: 16 },

    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: SPACING.large,
        height: '75%',
    },
    modalTitle: { fontFamily: baseFontFamily, fontSize: 20, fontWeight: '700' as const, marginBottom: SPACING.medium, textAlign: 'center' },
    modalSearchInput: { fontFamily: baseFontFamily, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: SPACING.medium, padding: 14, fontSize: 16 },
    listContainer: { flex: 1, width: '100%' },
    listItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 16, paddingHorizontal: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    listItemText: { fontFamily: baseFontFamily, fontSize: 16 },
    emptyListText: { textAlign: 'center', marginTop: 30, fontSize: 16 },

    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: SPACING.large, gap: 12 },
    modalActionButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    modalDoneButton: {},
    modalDoneButtonText: { fontFamily: baseFontFamily, fontSize: 16, fontWeight: '700' as const },
    modalCancelButton: {},
    modalCancelButtonText: { fontFamily: baseFontFamily, fontSize: 16 },

    licensesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.small, marginTop: SPACING.xsmall },
    licenseCheckbox: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, paddingHorizontal: 14,
        borderRadius: 999,
        marginBottom: 10, marginRight: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    licenseText: { fontFamily: baseFontFamily, fontSize: 15 },
    licenseTextSelected: { fontWeight: '600' as const },

    jobTypeScrollContainer: { paddingBottom: 4 },
    jobTypeButton: {
        paddingVertical: 10, paddingHorizontal: 14,
        borderRadius: 999,
        marginRight: 10, marginBottom: 8,
        borderWidth: StyleSheet.hairlineWidth,
        justifyContent: 'center', alignItems: 'center',
    },
    jobTypeText: { fontFamily: baseFontFamily, fontSize: 14 },
    jobTypeTextSelected: { fontWeight: '700' as const },

    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.small, marginBottom: SPACING.small },

    submitButton: {
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: SPACING.medium,
        ...Platform.select({
            ios: { shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
            android: { elevation: 3 },
            default: {},
        }),
    },
    submitButtonText: { fontFamily: baseFontFamily, fontSize: 17, fontWeight: '700' as const },

    suggestionsList: { maxHeight: 220, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: -SPACING.small + 2, marginBottom: SPACING.medium },
    suggestionItem: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
    suggestionText: { fontSize: 15 },

    useFarmAddressButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 12, borderRadius: 12, marginBottom: 18,
        borderWidth: StyleSheet.hairlineWidth,
    },
    useFarmAddressButtonText: { fontSize: 15, fontWeight: '600' as const, marginLeft: 8 },

    quotaContainer: { alignItems: 'center', marginVertical: SPACING.large },
    quotaText: { fontFamily: baseFontFamily, fontSize: 15, fontStyle: 'italic' },
});