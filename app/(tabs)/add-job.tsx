import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, Platform, Switch, Modal, FlatList, StatusBar,
    KeyboardAvoidingView, Keyboard, Animated, useWindowDimensions
} from 'react-native';
import { getThemeColors, Theme } from '@/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);
const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

const DRIVING_LICENSES = ['B', 'BE', 'C', 'CE', 'C1', 'C1E', 'T', 'L'];
const LOCATIONIQ_API_KEY = process.env.EXPO_PUBLIC_LOCATIONIQ_API_KEY;

// --- Animation Constants ---
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
    const scrollY = useRef(new Animated.Value(0)).current;
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;

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

    const availableRegions = country ? t(`filters.regions.${country}`, { returnObjects: true }) as Record<string, string> : {};

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
            const response = await fetch(`https://api.locationiq.com/v1/autocomplete.php?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(query)}&countrycodes=${countryCode}&limit=5&format=json&accept-language=${i18n.language}`);
            const data = await response.json();
            if (data && !data.error) setLocationSuggestions(data);
            else setLocationSuggestions([]);
        } catch (error) { console.error("Failed to fetch location suggestions:", error); }
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

            // Fetch user profile
            supabase.from('profiles').select('role, farm_location_address, farm_latitude, farm_longitude').eq('id', session.user.id).single()
                .then(({ data, error }) => {
                    if (error) console.error('Error fetching user profile:', error);
                    setFarmProfile(data as FarmProfileData | null);
                    setLoadingUser(false);
                });

            // Fetch job quotas using the correct column names from your table
            supabase.from('farm_quotas')
                .select('remaining_jobs, remaining_sos')
                .eq('farm_id', session.user.id)
                .single()
                .then(({ data, error }) => {
                    if (data) {
                        setQuotas({ jobs: data.remaining_jobs || 0, sos: data.remaining_sos || 0 });
                    }
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
        if (regionKeys.length > 0 && !regionKeys.includes(region)) {
            setRegion('');
        }
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

    const toggleLicense = (license: string) => setSelectedLicenses(prev => prev.includes(license) ? prev.filter(l => l !== license) : [...prev, license]);
    const toggleJobType = (typeKey: string) => setJobTypes(prev => prev.includes(typeKey) ? prev.filter(t => t !== typeKey) : [...prev, typeKey]);

    const handlePurchaseSos = async () => {
        Alert.alert(t('addJob.purchaseSimulationTitle'), t('addJob.purchaseSimulationMessage'));
    }

    const handleAddJob = async () => {
        if (farmProfile?.role !== 'Betrieb' || !session?.user) { Alert.alert(t('addJob.permissionDeniedTitle'), t('addJob.permissionDenied')); return; }
        if (!title || !description || !location || !country || !region) { Alert.alert(t('addJob.alertMissingFields'), t('addJob.alertMissingFieldsMessage')); return; }
        if (!selectedLocationCoords) { Alert.alert(t('addJob.alertInvalidLocation'), t('addJob.alertInvalidLocationMessage')); return; }

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
                    Alert.alert(t('addJob.sosQuotaExceededTitle'), t('addJob.sosQuotaExceededMessage'),
                        [
                            { text: t('common.cancel'), style: 'cancel' },
                            { text: t('addJob.purchaseButton'), onPress: handlePurchaseSos }
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
                title, description, location, country, region,
                salary_per_hour: salaryToInsert, required_licenses: selectedLicenses, job_type: jobTypes,
                is_active: isActive, is_urgent: isUrgent, offers_accommodation: offersAccommodation,
                farm_id: session.user.id, latitude: selectedLocationCoords.lat, longitude: selectedLocationCoords.lng,
            });

            if (error) { throw error; }

            await supabase.rpc('decrement_job_quota', { farm_id_input: session.user.id });
            if (isUrgent) {
                await supabase.rpc('decrement_sos_quota', { farm_id_input: session.user.id });
            }

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

    const renderPickerItem = ({ item, isCountryPicker, tempValue, setTempValue }: { item: string; isCountryPicker: boolean; tempValue: string; setTempValue: (val: string) => void; }) => (
        <TouchableOpacity style={[styles.listItem, item === tempValue && styles.selectedListItem]} onPress={() => setTempValue(item)}>
            <Text style={styles.listItemText}>{isCountryPicker ? translatedCountries[item] : availableRegions[item]}</Text>
            {item === tempValue && <MaterialCommunityIcons name="check" size={20} color={themeColors.primary} />}
        </TouchableOpacity>
    );

    const headerHeight = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT + insets.top],
        extrapolate: 'clamp',
    });
    const titleScale = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
        outputRange: [1, 1, 0.8],
        extrapolate: 'clamp',
    });
    const titleTranslateY = scrollY.interpolate({
        inputRange: [0, HEADER_SCROLL_DISTANCE],
        outputRange: [0, -20],
        extrapolate: 'clamp',
    });

    if (loadingUser) { return <View style={styles.centeredContainer}><ActivityIndicator size="large" color={themeColors.primary} /></View>; }
    if (farmProfile?.role !== 'Betrieb') {
        return (
            <View style={styles.safeAreaContainer}>
                <View style={[styles.headerStatic, { paddingTop: insets.top }]}><Text style={styles.pageTitleStatic}>{t('addJob.pageTitle')}</Text></View>
                <View style={styles.permissionDeniedContainer}>
                    <MaterialCommunityIcons name="lock-alert-outline" size={80} color={themeColors.textSecondary} />
                    <Text style={styles.permissionDeniedText}>{t('addJob.permissionDenied')}</Text>
                </View>
            </View>
        );
    }
    return (
        <View style={styles.safeAreaContainer}>
            <StatusBar barStyle="light-content" />
            <Animated.View style={[styles.header, { height: headerHeight }]}>
                <Animated.View style={[{ transform: [{ scale: titleScale }, { translateY: titleTranslateY }] }]}>
                    <Text style={styles.pageTitle}>{t('addJob.pageTitle')}</Text>
                </Animated.View>
            </Animated.View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <Animated.ScrollView
                    contentContainerStyle={{ paddingTop: HEADER_MAX_HEIGHT, paddingBottom: insets.bottom + 20 }}
                    scrollEventThrottle={16}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.formContainer, { paddingHorizontal: width * 0.05 }]}> 
                        <View style={[styles.sectionCard, { width: isLargeScreen ? width * 0.8 : '100%' }]}>
                            <Text style={styles.sectionTitle}>{t('addJob.sectionJobDetails')}</Text>
                            <Text style={styles.label}>{t('addJob.labelJobTitle')} <Text style={styles.requiredIndicator}>*</Text></Text>
                            <TextInput style={styles.input} placeholder={t('addJob.placeholderJobTitle')} placeholderTextColor={themeColors.textHint} value={title} onChangeText={setTitle} />
                            <Text style={styles.label}>{t('addJob.labelDescription')} <Text style={styles.requiredIndicator}>*</Text></Text>
                            <TextInput style={[styles.input, styles.textArea]} placeholder={t('addJob.placeholderDescription')} placeholderTextColor={themeColors.textHint} multiline value={description} onChangeText={setDescription} />
                        </View>
                        <View style={[styles.sectionCard, { width: isLargeScreen ? width * 0.8 : '100%' }]}>
                            <Text style={styles.sectionTitle}>{t('addJob.sectionLocation')}</Text>
                            {farmProfile?.role === 'Betrieb' && (
                                <TouchableOpacity style={styles.useFarmAddressButton} onPress={useFarmAddress}>
                                    <MaterialCommunityIcons name="office-building-marker-outline" size={20} color={themeColors.primary} />
                                    <Text style={styles.useFarmAddressButtonText}>{t('addJob.useFarmAddress')}</Text>
                                </TouchableOpacity>
                            )}
                            <Text style={styles.label}>{t('addJob.labelCountry')} <Text style={styles.requiredIndicator}>*</Text></Text>
                            <TouchableOpacity style={styles.modalPickerButton} onPress={() => setCountryPickerVisible(true)}><Text style={styles.modalPickerButtonText}>{translatedCountries[country] || t('addJob.selectCountry')}</Text><MaterialCommunityIcons name="chevron-down" size={24} color={themeColors.textSecondary} /></TouchableOpacity>
                            <Text style={styles.label}>{t('addJob.labelRegion')} <Text style={styles.requiredIndicator}>*</Text></Text>
                            <TouchableOpacity style={[styles.modalPickerButton, !Object.keys(availableRegions).length && styles.modalPickerButtonDisabled]} onPress={() => Object.keys(availableRegions).length && setRegionPickerVisible(true)} disabled={!Object.keys(availableRegions).length}><Text style={[styles.modalPickerButtonText, !Object.keys(availableRegions).length && styles.modalPickerButtonTextDisabled]}>{availableRegions[region] || t('addJob.selectRegion')}</Text><MaterialCommunityIcons name="chevron-down" size={24} color={!Object.keys(availableRegions).length ? themeColors.textHint : themeColors.textSecondary} /></TouchableOpacity>
                            <Text style={styles.label}>{t('addJob.labelExactLocation')} <Text style={styles.requiredIndicator}>*</Text></Text>
                            <TextInput
                                style={styles.input}
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
                                    style={styles.suggestionsList}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity onPress={() => onLocationSuggestionSelect(item)} style={styles.suggestionItem}>
                                            <Text style={styles.suggestionText}>{item.display_name}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                        </View>
                        <View style={[styles.sectionCard, { width: isLargeScreen ? width * 0.8 : '100%' }]}>
                            <Text style={styles.sectionTitle}>{t('addJob.sectionCompensation')}</Text>
                            <Text style={styles.label}>{t('addJob.labelSalary')}</Text>
                            <TextInput style={styles.input} placeholder={t('addJob.placeholderSalary')} placeholderTextColor={themeColors.textHint} keyboardType="numeric" value={salaryPerHour} onChangeText={setSalaryPerHour} />
                            <Text style={styles.label}>{t('addJob.labelJobType')}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobTypeScrollContainer}>{jobTypeKeys.map((key) => { return (<TouchableOpacity key={key} style={[styles.jobTypeButton, jobTypes.includes(key) && styles.jobTypeButtonSelected]} onPress={() => toggleJobType(key)}><Text style={[styles.jobTypeText, jobTypes.includes(key) && styles.jobTypeTextSelected]}>{jobTypesOptions[key]}</Text></TouchableOpacity>); })}</ScrollView>
                        </View>
                        <View style={[styles.sectionCard, { width: isLargeScreen ? width * 0.8 : '100%' }]}>
                            <Text style={styles.sectionTitle}>{t('addJob.sectionRequirements')}</Text>
                            <Text style={styles.label}>{t('addJob.labelLicenses')}</Text>
                            <View style={styles.licensesContainer}>{DRIVING_LICENSES.map((license) => (<TouchableOpacity key={license} style={[styles.licenseCheckbox, selectedLicenses.includes(license) && styles.licenseCheckboxSelected]} onPress={() => toggleLicense(license)}><Text style={[styles.licenseText, selectedLicenses.includes(license) && styles.licenseTextSelected]}>{license}</Text></TouchableOpacity>))}</View>
                        </View>
                        <View style={[styles.sectionCard, { width: isLargeScreen ? width * 0.8 : '100%' }]}>
                            <Text style={styles.sectionTitle}>{t('addJob.sectionStatus')}</Text>
                            <View style={styles.toggleRow}><Text style={styles.label}>{t('addJob.labelActive')}</Text><Switch trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary + '80' }} thumbColor={isActive ? themeColors.primary : themeColors.textSecondary} onValueChange={setIsActive} value={isActive} /></View>
                            <View style={styles.toggleRow}><Text style={styles.label}>{t('addJob.labelUrgent')}</Text><Switch trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary + '80' }} thumbColor={isUrgent ? themeColors.primary : themeColors.textSecondary} onValueChange={setIsUrgent} value={isUrgent} /></View>
                            <View style={styles.toggleRow}>
                                <Text style={styles.label}>{t('addJob.labelOffersAccommodation')}</Text>
                                <Switch trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary + '80' }} thumbColor={offersAccommodation ? themeColors.primary : themeColors.textSecondary} onValueChange={setOffersAccommodation} value={offersAccommodation} />
                            </View>
                        </View>

                        <View style={styles.quotaContainer}>
                            {loadingQuotas ? (
                                <ActivityIndicator color={themeColors.textSecondary} />
                            ) : (
                                <Text style={styles.quotaText}>
                                    {`Jobs: ${quotas.jobs}   SOS: ${quotas.sos}`}
                                </Text>
                            )}
                        </View>

                        <TouchableOpacity style={styles.submitButton} onPress={handleAddJob} disabled={submitting}>{submitting ? <ActivityIndicator color={themeColors.background} /> : <Text style={styles.submitButtonText}>{t('addJob.buttonPublish')}</Text>}</TouchableOpacity>
                    </View>
                </Animated.ScrollView>
            </KeyboardAvoidingView>
            <Modal animationType="slide" transparent={true} visible={countryPickerVisible} onRequestClose={handleCountrySelectionCancel}><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>{t('addJob.modalSelectCountry')}</Text><TextInput style={styles.modalSearchInput} placeholder={t('addJob.modalSearchPlaceholder')} value={countrySearch} onChangeText={setCountrySearch} placeholderTextColor={themeColors.textHint} /><FlatList data={filteredCountries} keyExtractor={item => item} renderItem={({ item }) => renderPickerItem({ item, isCountryPicker: true, tempValue: tempCountry, setTempValue: setTempCountry })} ListEmptyComponent={!filteredCountries.length ? <Text style={styles.emptyListText}>{t('addJob.modalNoResults')}</Text> : null} style={styles.listContainer} /><View style={styles.modalButtonContainer}><TouchableOpacity style={[styles.modalActionButton, styles.modalCancelButton]} onPress={handleCountrySelectionCancel}><Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text></TouchableOpacity><TouchableOpacity style={[styles.modalActionButton, styles.modalDoneButton]} onPress={handleCountrySelectionDone}><Text style={styles.modalDoneButtonText}>{t('common.done')}</Text></TouchableOpacity></View></View></View></Modal>
            <Modal animationType="slide" transparent={true} visible={regionPickerVisible} onRequestClose={handleRegionSelectionCancel}><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>{t('addJob.modalSelectRegion')}</Text><TextInput style={styles.modalSearchInput} placeholder={t('addJob.modalSearchPlaceholder')} value={regionSearch} onChangeText={setRegionSearch} placeholderTextColor={themeColors.textHint} /><FlatList data={filteredRegions} keyExtractor={item => item} renderItem={({ item }) => renderPickerItem({ item, isCountryPicker: false, tempValue: tempRegion, setTempValue: setTempRegion })} ListEmptyComponent={!filteredRegions.length ? <Text style={styles.emptyListText}>{t('addJob.modalNoResults')}</Text> : null} style={styles.listContainer} /><View style={styles.modalButtonContainer}><TouchableOpacity style={[styles.modalActionButton, styles.modalCancelButton]} onPress={handleRegionSelectionCancel}><Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text></TouchableOpacity><TouchableOpacity style={[styles.modalActionButton, styles.modalDoneButton]} onPress={handleRegionSelectionDone}><Text style={styles.modalDoneButtonText}>{t('common.done')}</Text></TouchableOpacity></View></View></View></Modal>
        </View>
    );
}

const SPACING = { xsmall: 4, small: 8, medium: 16, large: 24, xlarge: 32 };
const styles = StyleSheet.create({
    safeAreaContainer: { flex: 1, backgroundColor: themeColors.background },
    header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: themeColors.surface, justifyContent: 'flex-end', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border, paddingBottom: 12 },
    headerStatic: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: Platform.OS === 'ios' ? 50 : 60, paddingHorizontal: 16, backgroundColor: themeColors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
    pageTitle: { fontFamily: baseFontFamily, fontSize: 34, fontWeight: 'bold', color: themeColors.text },
    pageTitleStatic: { fontFamily: baseFontFamily, fontSize: 17, fontWeight: 'bold', color: themeColors.text },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background },
    permissionDeniedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.large, backgroundColor: themeColors.background },
    permissionDeniedText: { fontFamily: baseFontFamily, fontSize: 18, color: themeColors.textSecondary, textAlign: 'center', marginTop: SPACING.medium },
    keyboardAvoidingView: { flex: 1 },
    formContainer: { paddingBottom: SPACING.xlarge, paddingTop: SPACING.medium },
    sectionCard: { backgroundColor: themeColors.surface, borderRadius: 15, padding: SPACING.large, marginBottom: SPACING.large, shadowColor: 'rgba(0,0,0,0.1)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 },
    sectionTitle: { fontFamily: baseFontFamily, fontSize: 18, fontWeight: 'bold', color: themeColors.text, marginBottom: SPACING.medium, paddingBottom: SPACING.small, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
    label: { fontFamily: baseFontFamily, fontSize: 15, color: themeColors.text, marginBottom: SPACING.xsmall, fontWeight: '500' },
    requiredIndicator: { color: themeColors.primary, fontWeight: 'bold' },
    input: { fontFamily: baseFontFamily, width: '100%', padding: 14, borderRadius: 10, backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, fontSize: 16, borderWidth: 1, borderColor: themeColors.border, marginBottom: SPACING.medium },
    textArea: { minHeight: 100, textAlignVertical: 'top', lineHeight: 20 },
    modalPickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: themeColors.surfaceHighlight, borderRadius: 10, borderWidth: 1, borderColor: themeColors.border, paddingHorizontal: 15, height: 55, marginBottom: SPACING.medium },
    modalPickerButtonDisabled: { backgroundColor: themeColors.background },
    modalPickerButtonText: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text },
    modalPickerButtonTextDisabled: { color: themeColors.textHint },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.7)' },
    modalContent: { backgroundColor: themeColors.surface, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: SPACING.large, height: '75%', shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 20 },
    modalTitle: { fontFamily: baseFontFamily, fontSize: 24, fontWeight: 'bold', color: themeColors.text, marginBottom: SPACING.medium, textAlign: 'center' },
    modalSearchInput: { fontFamily: baseFontFamily, backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderRadius: 10, borderWidth: 1, borderColor: themeColors.border, marginBottom: SPACING.medium, padding: 15, fontSize: 16 },
    listContainer: { flex: 1, width: '100%' },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
    selectedListItem: { backgroundColor: themeColors.primaryLight + '30' },
    listItemText: { fontFamily: baseFontFamily, color: themeColors.text, fontSize: 17 },
    emptyListText: { textAlign: 'center', color: themeColors.textHint, marginTop: 30, fontSize: 16 },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: SPACING.large },
    modalActionButton: { flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginHorizontal: SPACING.small },
    modalDoneButton: { backgroundColor: themeColors.primary },
    modalDoneButtonText: { fontFamily: baseFontFamily, color: themeColors.background, fontSize: 17, fontWeight: 'bold' },
    modalCancelButton: { backgroundColor: themeColors.surfaceHighlight },
    modalCancelButtonText: { fontFamily: baseFontFamily, color: themeColors.text, fontSize: 17 },
    licensesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.medium, marginTop: SPACING.xsmall },
    licenseCheckbox: { flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.surfaceHighlight, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10, marginBottom: 10, marginRight: 10, borderWidth: 1, borderColor: themeColors.border },
    licenseCheckboxSelected: { borderColor: themeColors.primary, backgroundColor: themeColors.primary },
    licenseText: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text },
    licenseTextSelected: { color: themeColors.background, fontWeight: '600' },
    jobTypeScrollContainer: { paddingBottom: 5 },
    jobTypeButton: { backgroundColor: themeColors.surfaceHighlight, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, marginRight: 10, borderWidth: 1, borderColor: themeColors.border, justifyContent: 'center', alignItems: 'center' },
    jobTypeButtonSelected: { borderColor: themeColors.primary, backgroundColor: themeColors.primary },
    jobTypeText: { fontFamily: baseFontFamily, color: themeColors.text, fontSize: 15 },
    jobTypeTextSelected: { color: themeColors.background, fontWeight: 'bold' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.small, marginBottom: SPACING.small },
    submitButton: { backgroundColor: themeColors.primary, paddingVertical: 18, borderRadius: 15, alignItems: 'center', marginTop: SPACING.medium, shadowColor: themeColors.primaryDark, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
    submitButtonText: { fontFamily: baseFontFamily, color: themeColors.background, fontSize: 19, fontWeight: 'bold' },
    suggestionsList: { maxHeight: 200, backgroundColor: themeColors.surface, borderRadius: 10, borderWidth: 1, borderColor: themeColors.border, marginTop: -SPACING.medium + 2, marginBottom: SPACING.medium, },
    suggestionItem: { padding: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border, },
    suggestionText: { color: themeColors.text, fontSize: 16, },
    useFarmAddressButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.primaryLight + '20', paddingVertical: 12, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: themeColors.primary, },
    useFarmAddressButtonText: { color: themeColors.primary, fontSize: 16, fontWeight: '600', marginLeft: 8, },
    quotaContainer: {
        alignItems: 'center',
        marginVertical: SPACING.large,
    },
    quotaText: {
        fontFamily: baseFontFamily,
        fontSize: 15,
        color: themeColors.textSecondary,
        fontStyle: 'italic',
    },
});