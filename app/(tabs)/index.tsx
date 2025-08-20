import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
    StyleSheet, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Modal, ScrollView, Platform, Alert, Animated, Linking, Switch,
    useColorScheme, useWindowDimensions, Pressable
} from 'react-native';
import '@/lib/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, Theme } from '@/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation, Trans } from 'react-i18next';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';

// Fonts (system — no assets)
const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
});

const DRIVING_LICENSES = ['B', 'BE', 'C', 'CE', 'C1', 'C1E', 'T', 'L'] as const;

// --- Haversine Distance Calculation Helper ---
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function deg2rad(deg: number): number { return deg * (Math.PI / 180); }

// Interfaces
interface FarmProfile {
    id: string; full_name: string; farm_description?: string; website?: string; contact_email?: string;
    address_street?: string; address_city?: string; address_postal_code?: string; address_country?: string;
    farm_specialization?: string[]; farm_size_hectares?: number; number_of_employees?: string;
    accommodation_offered?: boolean; machinery_brands?: string[];
}
interface Job {
    id: string; title: string; description: string; location: string; country: string; region: string;
    required_licenses: string[]; salary_per_hour: number | null; job_type: string[] | null; is_active: boolean;
    is_urgent: boolean; offers_accommodation: boolean; farm: FarmProfile; latitude: number | null; longitude: number | null;
}
interface ChatCreationResult { chat_id: string; is_new: boolean; }
interface UserLocation { latitude: number; longitude: number; }

export default function IndexScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const themeColors = useMemo(
        () => getThemeColors((colorScheme ?? 'light') as Theme),
        [colorScheme]
    );

    // Responsive layout for laptop/desktop
    const { width } = useWindowDimensions();
    const contentMaxWidth = width >= 1440 ? 1280 : width >= 1200 ? 1120 : 960;
    const columns = width >= 1600 ? 3 : width >= 1024 ? 2 : 1;
    const gutter = 16;
    const horizontalPadding = 16 * 2;
    const cardPxWidth =
        columns === 1
            ? contentMaxWidth - horizontalPadding
            : Math.floor((contentMaxWidth - horizontalPadding - gutter * (columns - 1)) / columns);

    // Slightly smaller titles on big screens
    const TITLE_MAX_FONT_SIZE = width >= 1024 ? 28 : 30;
    const SUBTITLE_MAX_FONT_SIZE = width >= 1024 ? 15 : 16;

    // Header + search animation metrics (derived here so they match font sizes)
    const SEARCH_BAR_HEIGHT = 48;
    const SEARCH_BAR_VERTICAL_PADDING = 10;
    const SEARCH_BAR_HORIZONTAL_PADDING = 20;
    const SEARCH_BAR_TOTAL_HEIGHT = SEARCH_BAR_HEIGHT + (SEARCH_BAR_VERTICAL_PADDING * 2);
    const COLLAPSED_TITLE_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : 56;
    const COLLAPSED_TITLE_FONT_SIZE = 17;
    const INITIAL_TEXT_BLOCK_HEIGHT = TITLE_MAX_FONT_SIZE + 2 + SUBTITLE_MAX_FONT_SIZE;
    const INITIAL_HEADER_TITLE_AREA_HEIGHT = INITIAL_TEXT_BLOCK_HEIGHT + 16;
    const COLLAPSED_HEADER_HEIGHT = COLLAPSED_TITLE_BAR_HEIGHT;
    const SCROLL_DISTANCE = INITIAL_HEADER_TITLE_AREA_HEIGHT - COLLAPSED_HEADER_HEIGHT;
    const TOTAL_HEADER_AND_SEARCH_BAR_HEIGHT_AT_TOP = INITIAL_HEADER_TITLE_AREA_HEIGHT + SEARCH_BAR_TOTAL_HEIGHT;

    const translatedCountries = t('filters.countries', { returnObjects: true }) as Record<string, string>;
    const countryKeys = Object.keys(translatedCountries);
    const jobTypesOptions = t('jobTypes', { returnObjects: true }) as Record<string, string>;
    const jobTypeKeys = Object.keys(jobTypesOptions);

    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);
    const [isDetailsModalVisible, setDetailsModalVisible] = useState(false);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);

    // Filter states (UI)
    const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [radius, setRadius] = useState<number>(200);
    const [offersAccommodation, setOffersAccommodation] = useState(false);
    const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);

    // Applied filters
    const [appliedLicenses, setAppliedLicenses] = useState<string[]>([]);
    const [appliedCountry, setAppliedCountry] = useState<string | null>(null);
    const [appliedRegions, setAppliedRegions] = useState<string[]>([]);
    const [appliedRadius, setAppliedRadius] = useState<number>(200);
    const [appliedOffersAccommodation, setAppliedOffersAccommodation] = useState(false);
    const [appliedJobTypes, setAppliedJobTypes] = useState<string[]>([]);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

    const scrollY = useRef(new Animated.Value(0)).current;

    const getUserLocation = async (): Promise<UserLocation | null> => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('jobList.locationPermissionTitle'), t('jobList.locationPermissionMessage'));
            return null;
        }
        try {
            const location = await Location.getCurrentPositionAsync({});
            return { latitude: location.coords.latitude, longitude: location.coords.longitude };
        } catch (error) {
            Alert.alert('Error', t('jobList.locationError'));
            console.error(error);
            return null;
        }
    };

    const fetchAndFilterJobs = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('jobs')
                .select(`*, profiles (*)`)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (appliedRadius < 200 && userLocation) {
                query = query.not('latitude', 'is', null).not('longitude', 'is', null);
            }

            const { data, error } = await query;
            if (error) throw error;

            let fetchedJobs: Job[] = (data as any[]).map((job) => ({
                id: job.id,
                title: job.title,
                description: job.description,
                location: job.location,
                country: job.country,
                region: job.region,
                salary_per_hour: job.salary_per_hour,
                required_licenses: job.required_licenses || [],
                job_type: job.job_type || [],
                is_active: job.is_active,
                is_urgent: job.is_urgent || false,
                offers_accommodation: job.offers_accommodation || false,
                farm: job.profiles ? { ...job.profiles } : { id: '', full_name: 'Unknown Farm' },
                latitude: job.latitude,
                longitude: job.longitude,
            }));

            fetchedJobs = fetchedJobs.filter(job => {
                const searchLower = searchText.toLowerCase();
                const matchesSearch =
                    job.title.toLowerCase().includes(searchLower) ||
                    job.description.toLowerCase().includes(searchLower) ||
                    job.farm.full_name.toLowerCase().includes(searchLower) ||
                    job.location.toLowerCase().includes(searchLower);

                const matchesLicenses = appliedLicenses.length === 0 || appliedLicenses.every(license => job.required_licenses.includes(license));
                const matchesCountry = !appliedCountry || job.country === appliedCountry;
                const matchesRegion = appliedRegions.length === 0 || appliedRegions.includes(job.region);
                const matchesAccommodation = !appliedOffersAccommodation || job.offers_accommodation;
                const matchesJobTypes = appliedJobTypes.length === 0 || (job.job_type && appliedJobTypes.some(type => job.job_type!.includes(type)));

                const matchesRadius = (() => {
                    if (appliedRadius >= 200 || !userLocation || !job.latitude || !job.longitude) return true;
                    const distance = getDistanceFromLatLonInKm(userLocation.latitude, userLocation.longitude, job.latitude, job.longitude);
                    return distance <= appliedRadius;
                })();

                return matchesSearch && matchesLicenses && matchesCountry && matchesRegion && matchesRadius && matchesAccommodation && matchesJobTypes;
            });

            fetchedJobs.sort((a, b) => (a.is_urgent && !b.is_urgent ? -1 : !a.is_urgent && b.is_urgent ? 1 : 0));
            setJobs(fetchedJobs);
        } catch (err) {
            console.error('Error fetching jobs:', err);
            Alert.alert('Error', 'An unexpected error occurred.');
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, [searchText, appliedLicenses, appliedCountry, appliedRegions, appliedRadius, userLocation, appliedOffersAccommodation, appliedJobTypes, t]);

    useFocusEffect(useCallback(() => { fetchAndFilterJobs(); }, [fetchAndFilterJobs]));

    const handleViewDetails = (job: Job) => { setSelectedJob(job); setDetailsModalVisible(true); };
    const handleStartChat = async (jobPosterId: string) => {
        if (!jobPosterId) { Alert.alert("Error", "This job posting is missing an owner."); return; }
        const { data, error } = await supabase.rpc('create_or_get_chat', { other_user_id: jobPosterId }).single();
        if (error) { console.error("Error starting chat:", error); Alert.alert("Error", `Could not start a chat. ${error.message}`); return; }
        const chatData = data as ChatCreationResult;
        if (chatData) router.push({ pathname: "/(tabs)/chats/[id]", params: { id: chatData.chat_id } });
    };

    const handleSelectCountry = (countryKey: string) => { setSelectedCountry(prev => (prev === countryKey ? null : countryKey)); setSelectedRegions([]); };
    const toggleRegion  = (regionKey: string) => setSelectedRegions(prev => prev.includes(regionKey) ? prev.filter(r => r !== regionKey) : [...prev, regionKey]);
    const toggleLicense = (license: string)  => setSelectedLicenses(prev => prev.includes(license) ? prev.filter(l => l !== license) : [...prev, license]);
    const toggleJobType = (typeKey: string)  => setSelectedJobTypes(prev => prev.includes(typeKey) ? prev.filter(t => t !== typeKey) : [...prev, typeKey]);

    const applyFilters = async () => {
        let location: UserLocation | null = userLocation;
        if (radius < 200 && !location) {
            location = await getUserLocation();
            if (location) setUserLocation(location);
        }
        setAppliedLicenses(selectedLicenses);
        setAppliedCountry(selectedCountry);
        setAppliedRegions(selectedRegions);
        setAppliedRadius(location ? radius : 200);
        setAppliedOffersAccommodation(offersAccommodation);
        setAppliedJobTypes(selectedJobTypes);
        setFilterModalVisible(false);
    };

    const resetFilters = () => {
        setSelectedLicenses([]); setSelectedCountry(null); setSelectedRegions([]);
        setRadius(200); setOffersAccommodation(false); setSelectedJobTypes([]);
        setAppliedLicenses([]); setAppliedCountry(null); setAppliedRegions([]);
        setAppliedRadius(200); setAppliedOffersAccommodation(false); setAppliedJobTypes([]);
        setUserLocation(null); setFilterModalVisible(false);
    };

    const renderJobCardContent = (item: Job) => {
        const countryDisplay = item.country ? t(`filters.countries.${item.country}`) : item.country;
        const regionDisplay  = item.country && item.region ? t(`filters.regions.${item.country}.${item.region}`) : item.region;
        const translatedJobTypes = item.job_type ? item.job_type.map(key => t(`jobTypes.${key}`)).join(', ') : '';
        const salaryDisplay = item.salary_per_hour ? t('jobList.salaryPerHour', { salary: item.salary_per_hour }) : null;

        return (
            <View style={[styles.jobCard, { borderColor: themeColors.border, backgroundColor: themeColors.surface, shadowColor: Platform.OS === 'ios' ? '#000' : themeColors.surface }]}>
                <View style={styles.jobCardHeader}>
                    <Text style={[styles.jobCardTitle, { color: themeColors.text }]} numberOfLines={2}>{item.title}</Text>
                    {item.is_urgent && (
                        <View style={[styles.urgentTagContainer, { backgroundColor: themeColors.danger }]}>
                            <Text style={styles.urgentTagText}>{t('SOS')}</Text>
                        </View>
                    )}
                </View>

                <Text style={[styles.jobCardSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    {item.farm.full_name} • {item.location} {regionDisplay ? `(${regionDisplay}, ${countryDisplay})` : ''}
                </Text>

                <Text style={[styles.jobCardDescription, { color: themeColors.text }]} numberOfLines={3}>
                    {item.description}
                </Text>

                <View style={styles.jobCardDetailRow}>
                    {salaryDisplay && (
                        <View style={styles.jobCardIconText}>
                            <MaterialCommunityIcons name="currency-eur" size={16} color={themeColors.textSecondary} />
                            <Text style={[styles.jobCardDetailText, { color: themeColors.textSecondary }]}>{salaryDisplay}</Text>
                        </View>
                    )}
                    {item.offers_accommodation && (
                        <View style={styles.jobCardIconText}>
                            <MaterialCommunityIcons name="home-outline" size={16} color={themeColors.textSecondary} />
                            <Text style={[styles.jobCardDetailText, { color: themeColors.textSecondary }]}>{t('jobList.accommodationOffered')}</Text>
                        </View>
                    )}
                    {!!translatedJobTypes && (
                        <View style={styles.jobCardIconText}>
                            <MaterialCommunityIcons name="briefcase-outline" size={16} color={themeColors.textSecondary} />
                            <Text style={[styles.jobCardDetailText, { color: themeColors.textSecondary }]}>{translatedJobTypes}</Text>
                        </View>
                    )}
                    {item.required_licenses.length > 0 && (
                        <View style={styles.jobCardIconText}>
                            <MaterialCommunityIcons name="card-account-details-outline" size={16} color={themeColors.textSecondary} />
                            <Text style={[styles.jobCardDetailText, { color: themeColors.textSecondary }]}>{item.required_licenses.join(', ')}</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.applyButton, { backgroundColor: themeColors.primary }]}
                    onPress={() => handleStartChat(item.farm.id)}
                    activeOpacity={0.9}
                >
                    <Text style={[styles.applyButtonText, { color: themeColors.background }]}>{t('jobList.applyNow')}</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // Animated header metrics
    const headerHeight = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE], outputRange: [INITIAL_HEADER_TITLE_AREA_HEIGHT, COLLAPSED_HEADER_HEIGHT], extrapolate: 'clamp' });
    const headerTranslateY = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE], outputRange: [0, -SCROLL_DISTANCE], extrapolate: 'clamp' });
    const titleFontSize = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE], outputRange: [TITLE_MAX_FONT_SIZE, COLLAPSED_TITLE_FONT_SIZE], extrapolate: 'clamp' });
    const subtitleOpacity = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE * 0.7], outputRange: [1, 0], extrapolate: 'clamp' });
    const titleTextTranslateY = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE], outputRange: [0, COLLAPSED_HEADER_HEIGHT / 2 - COLLAPSED_TITLE_FONT_SIZE / 2 - (INITIAL_HEADER_TITLE_AREA_HEIGHT - INITIAL_TEXT_BLOCK_HEIGHT) / 2], extrapolate: 'clamp' });
    const searchBarTranslateY = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE], outputRange: [0, -SCROLL_DISTANCE], extrapolate: 'clamp' });

    const ProfileInfoRow = ({ icon, label, value }: { icon: any, label: string, value?: string | null | number }) => {
        if (!value) return null;
        return (
            <View style={styles.profileInfoRow}>
                <MaterialCommunityIcons name={icon} size={20} color={themeColors.textSecondary} style={styles.profileInfoIcon} />
                <View>
                    <Text style={[styles.profileInfoLabel, { color: themeColors.textSecondary }]}>{label}</Text>
                    <Text style={[styles.profileInfoValue, { color: themeColors.text }]}>{value}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
            {/* Status bar spacer */}
            <Animated.View style={[styles.fixedTopSpacer, { height: insets.top, backgroundColor: themeColors.background }]} />

            {/* Animated header */}
            <Animated.View
                style={[
                    styles.animatedHeaderContainer,
                    {
                        top: insets.top,
                        height: headerHeight,
                        transform: [{ translateY: headerTranslateY }],
                        paddingTop: (INITIAL_HEADER_TITLE_AREA_HEIGHT - INITIAL_TEXT_BLOCK_HEIGHT) / 2,
                        paddingBottom: (INITIAL_HEADER_TITLE_AREA_HEIGHT - INITIAL_TEXT_BLOCK_HEIGHT) / 2,
                        backgroundColor: themeColors.background,
                        borderBottomColor: themeColors.border,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        shadowOpacity: 0,
                    },
                ]}
            >
                <Animated.View style={[styles.headerTextContainer, { transform: [{ translateY: titleTextTranslateY }] }]}>
                    <Animated.Text style={[styles.screenTitle, { fontSize: titleFontSize, color: themeColors.text }]}>
                        {t('jobList.title')}
                    </Animated.Text>
                    <Animated.Text style={[styles.pageSubtitle, { opacity: subtitleOpacity, fontSize: SUBTITLE_MAX_FONT_SIZE, color: themeColors.textSecondary }]}>
                        <Trans i18nKey="jobList.subtitle">
                            Your <Text style={{ color: themeColors.primary, fontWeight: '700' as const }}>Adventure</Text> Starts Here!
                        </Trans>
                    </Animated.Text>
                </Animated.View>
            </Animated.View>

            {/* Sticky search bar */}
            <Animated.View
                style={[
                    styles.stickySearchBarContainer,
                    {
                        top: Animated.add(insets.top, headerHeight),
                        transform: [{ translateY: searchBarTranslateY }],
                        backgroundColor: themeColors.background,
                        borderBottomColor: themeColors.border,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        elevation: 0,
                        shadowOpacity: 0,
                    },
                ]}
            >
                <View style={[styles.searchBar, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border }]}>
                    <MaterialCommunityIcons name="magnify" size={22} color={themeColors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: themeColors.text }]}
                        placeholder={t('jobList.searchPlaceholder')}
                        placeholderTextColor={themeColors.textHint}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>
                <TouchableOpacity
                    style={[styles.filterButton, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border }]}
                    onPress={() => setFilterModalVisible(true)}
                >
                    <MaterialCommunityIcons name="filter-variant" size={22} color={themeColors.primary} />
                </TouchableOpacity>
            </Animated.View>

            {/* Jobs list — responsive columns */}
            <Animated.FlatList
                data={jobs}
                renderItem={({ item, index }) => (
                    <View
                        style={{
                            width: columns === 1 ? '100%' : cardPxWidth,
                            marginRight: columns > 1 && (index % columns !== columns - 1) ? gutter : 0,
                        }}
                    >
                        <Pressable
                            onPress={() => handleViewDetails(item)}
                            // 👇 This callback is where you "put it"
                            style={(state) => {
                                const { pressed } = state;
                                const hovered = (state as any).hovered; // TS-safe cast for RN Web hover
                                return [
                                    styles.cardPressable,
                                    Platform.OS === 'web' && hovered ? styles.cardHover : null,
                                    pressed ? { opacity: 0.9 } : null,
                                ];
                            }}
                        >
                            {renderJobCardContent(item)}
                        </Pressable>
                    </View>
                )}
                keyExtractor={(item) => item.id}
                key={columns}
                numColumns={columns}
                columnWrapperStyle={columns > 1 ? { marginBottom: 12 } : undefined}
                contentContainerStyle={{
                    paddingTop: insets.top + TOTAL_HEADER_AND_SEARCH_BAR_HEIGHT_AT_TOP,
                    paddingBottom: insets.bottom + 20,
                    paddingHorizontal: 16,
                    width: '100%',
                    maxWidth: contentMaxWidth,
                    alignSelf: 'center',
                }}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                scrollEventThrottle={16}
                ListFooterComponent={<View style={{ height: 12 }} />}
            />

            {/* Loading & empty states */}
            {loading && (
                <View style={[styles.overlayLoadingContainer, { paddingTop: insets.top + TOTAL_HEADER_AND_SEARCH_BAR_HEIGHT_AT_TOP, backgroundColor: themeColors.background }]}>
                    <ActivityIndicator size="large" color={themeColors.primary} />
                    <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>{t('jobList.loading')}</Text>
                </View>
            )}
            {!loading && jobs.length === 0 && (
                <View style={[styles.overlayEmptyContainer, { paddingTop: insets.top + TOTAL_HEADER_AND_SEARCH_BAR_HEIGHT_AT_TOP, backgroundColor: themeColors.background }]}>
                    <MaterialCommunityIcons name="information-outline" size={48} color={themeColors.textSecondary} />
                    <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>{t('jobList.noJobs')}</Text>
                </View>
            )}

            {/* Filters Modal */}
            <Modal animationType="slide" transparent visible={isFilterModalVisible} onRequestClose={() => setFilterModalVisible(false)}>
                <View style={styles.centeredView}>
                    <View style={[styles.filterModalView, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
                            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t('jobList.filterTitle')}</Text>

                            <View style={styles.filterSection}>
                                <View style={styles.radiusLabelContainer}>
                                    <Text style={[styles.filterLabel, { color: themeColors.text }]}>{t('jobList.radius')}</Text>
                                    <Text style={[styles.radiusValueText, { color: themeColors.primary }]}>
                                        {radius >= 200 ? t('jobList.all') : `< ${Math.round(radius)} km`}
                                    </Text>
                                </View>
                                <Slider
                                    style={{ width: '100%', height: 40 }}
                                    minimumValue={0}
                                    maximumValue={200}
                                    step={5}
                                    value={radius}
                                    onValueChange={setRadius}
                                    minimumTrackTintColor={themeColors.primary}
                                    maximumTrackTintColor={themeColors.textHint}
                                    thumbTintColor={themeColors.primary}
                                />
                            </View>

                            <View style={styles.filterSection}>
                                <Text style={[styles.filterLabel, { color: themeColors.text }]}>{t('jobList.jobType')}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.chipsRow}>
                                        {jobTypeKeys.map((key) => {
                                            const isSelected = selectedJobTypes.includes(key);
                                            return (
                                                <TouchableOpacity
                                                    key={`job-type-${key}`}
                                                    onPress={() => toggleJobType(key)}
                                                    style={[
                                                        styles.chip,
                                                        { borderColor: isSelected ? themeColors.primary : themeColors.border, backgroundColor: isSelected ? themeColors.primary + '1A' : themeColors.surfaceHighlight }
                                                    ]}
                                                    activeOpacity={0.9}
                                                >
                                                    <MaterialCommunityIcons name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={isSelected ? themeColors.primary : themeColors.textSecondary} />
                                                    <Text style={[styles.chipText, { color: isSelected ? themeColors.primary : themeColors.text }]}>{jobTypesOptions[key]}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            </View>

                            <View style={styles.filterSection}>
                                <Text style={[styles.filterLabel, { color: themeColors.text }]}>{t('jobList.country')}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.chipsRow}>
                                        {countryKeys.map((key, index) => {
                                            const selected = selectedCountry === key;
                                            return (
                                                <TouchableOpacity
                                                    key={`country-${key}-${index}`}
                                                    onPress={() => handleSelectCountry(key)}
                                                    style={[
                                                        styles.chip,
                                                        { borderColor: selected ? themeColors.primary : themeColors.border, backgroundColor: selected ? themeColors.primary + '1A' : themeColors.surfaceHighlight }
                                                    ]}
                                                    activeOpacity={0.9}
                                                >
                                                    <Text style={[styles.chipText, { color: selected ? themeColors.primary : themeColors.text, fontWeight: '600' as const }]}>{translatedCountries[key]}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            </View>

                            {selectedCountry && (
                                <View style={styles.filterSection}>
                                    <Text style={[styles.filterLabel, { color: themeColors.text }]}>{t('jobList.region')}</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <View style={styles.chipsRow}>
                                            {Object.entries(t(`filters.regions.${selectedCountry}`, { returnObjects: true }) as Record<string, string>)
                                                .map(([key, value], index) => {
                                                    const isSelected = selectedRegions.includes(key);
                                                    return (
                                                        <TouchableOpacity
                                                            key={`region-${key}-${index}`}
                                                            onPress={() => toggleRegion(key)}
                                                            style={[
                                                                styles.chip,
                                                                { borderColor: isSelected ? themeColors.primary : themeColors.border, backgroundColor: isSelected ? themeColors.primary + '1A' : themeColors.surfaceHighlight }
                                                            ]}
                                                            activeOpacity={0.9}
                                                        >
                                                            <Text style={[styles.chipText, { color: isSelected ? themeColors.primary : themeColors.text }]}>{value}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                        </View>
                                    </ScrollView>
                                </View>
                            )}

                            <View style={styles.filterSection}>
                                <Text style={[styles.filterLabel, { color: themeColors.text }]}>{t('jobList.licenses')}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.chipsRow}>
                                        {DRIVING_LICENSES.map((license, i) => {
                                            const isSelected = selectedLicenses.includes(license);
                                            return (
                                                <TouchableOpacity
                                                    key={`license-${license}-${i}`}
                                                    onPress={() => toggleLicense(license)}
                                                    style={[
                                                        styles.chip,
                                                        { borderColor: isSelected ? themeColors.primary : themeColors.border, backgroundColor: isSelected ? themeColors.primary + '1A' : themeColors.surfaceHighlight }
                                                    ]}
                                                    activeOpacity={0.9}
                                                >
                                                    <MaterialCommunityIcons name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={isSelected ? themeColors.primary : themeColors.textSecondary} />
                                                    <Text style={[styles.chipText, { color: isSelected ? themeColors.primary : themeColors.text }]}>{license}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            </View>

                            <View style={styles.filterSection}>
                                <View style={styles.filterSwitchRow}>
                                    <Text style={[styles.filterLabel, { color: themeColors.text }]}>{t('jobList.filterByAccommodation')}</Text>
                                    <Switch
                                        trackColor={{ false: themeColors.textHint, true: themeColors.primary + '80' }}
                                        thumbColor={offersAccommodation ? themeColors.primary : themeColors.surfaceHighlight}
                                        ios_backgroundColor={themeColors.textHint}
                                        onValueChange={setOffersAccommodation}
                                        value={offersAccommodation}
                                    />
                                </View>
                            </View>

                            <View style={styles.modalButtonsContainer}>
                                <TouchableOpacity style={[styles.modalButton, styles.resetButton, { borderColor: themeColors.border, backgroundColor: themeColors.surfaceHighlight }]} onPress={resetFilters}>
                                    <Text style={[styles.modalButtonText, { color: themeColors.text }]}>{t('jobList.reset')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, { backgroundColor: themeColors.primary }]} onPress={applyFilters}>
                                    <Text style={[styles.modalButtonText, { color: themeColors.background }]}>{t('jobList.applyFilters')}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.closeModalButton} onPress={() => setFilterModalVisible(false)}>
                            <MaterialCommunityIcons name="close-circle-outline" size={28} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Details Modal */}
            <Modal animationType="slide" transparent visible={isDetailsModalVisible} onRequestClose={() => setDetailsModalVisible(false)}>
                <View style={styles.centeredView}>
                    <View style={[styles.detailsModalView, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                        {selectedJob && (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                                <Text style={[styles.profileName, { color: themeColors.text }]}>{selectedJob.title}</Text>
                                <Text style={[styles.modalLocation, { color: themeColors.textSecondary }]}>{selectedJob.farm.full_name} • {selectedJob.location}</Text>
                                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                                <Text style={[styles.profileSectionTitle, { color: themeColors.textSecondary }]}>{selectedJob.title}</Text>
                                <Text style={[styles.profileDescription, { color: themeColors.text }]}>{selectedJob.description}</Text>

                                <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

                                <Text style={[styles.profileSectionTitle, { color: themeColors.textSecondary }]}>{t('jobList.profile.about')}</Text>
                                {selectedJob.farm.farm_description && (<Text style={[styles.profileDescription, { color: themeColors.text }]}>{selectedJob.farm.farm_description}</Text>)}
                                <ProfileInfoRow icon="map-marker-outline" label={t('jobList.profile.address')} value={selectedJob.farm.address_street ? `${selectedJob.farm.address_street}, ${selectedJob.farm.address_postal_code} ${selectedJob.farm.address_city}` : null} />
                                {selectedJob.farm.contact_email && <ProfileInfoRow icon="email-outline" label={t('jobList.profile.email')} value={selectedJob.farm.contact_email} />}
                                {selectedJob.farm.website && (
                                    <TouchableOpacity onPress={() => Linking.openURL(selectedJob.farm.website!)}>
                                        <View style={styles.profileInfoRow}>
                                            <MaterialCommunityIcons name="web" size={20} color={themeColors.textSecondary} style={styles.profileInfoIcon} />
                                            <View>
                                                <Text style={[styles.profileInfoLabel, { color: themeColors.textSecondary }]}>{t('jobList.profile.website')}</Text>
                                                <Text style={[styles.profileInfoValue, { color: themeColors.primary, textDecorationLine: 'underline' }]}>{selectedJob.farm.website}</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                <ProfileInfoRow icon="pine-tree" label={t('jobList.profile.farmSize')} value={selectedJob.farm.farm_size_hectares ? `${selectedJob.farm.farm_size_hectares} ha` : null} />
                                <ProfileInfoRow icon="account-group-outline" label={t('jobList.profile.employees')} value={selectedJob.farm.number_of_employees} />
                            </ScrollView>
                        )}
                        <TouchableOpacity style={styles.closeModalButton} onPress={() => setDetailsModalVisible(false)}>
                            <MaterialCommunityIcons name="close-circle-outline" size={28} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    fixedTopSpacer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 12 },

    animatedHeaderContainer: {
        position: 'absolute',
        left: 0, right: 0,
        overflow: 'hidden',
        zIndex: 11,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },

    headerTextContainer: {},
    screenTitle: { fontFamily: baseFontFamily, fontWeight: '700' as const, letterSpacing: 0.2 },
    pageSubtitle: { fontFamily: baseFontFamily, fontWeight: '600' as const, marginTop: 2 },

    stickySearchBarContainer: {
        position: 'absolute',
        left: 0, right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        height: 48 + 20, // SEARCH_BAR_TOTAL_HEIGHT for readability here
        paddingHorizontal: 20,
        paddingVertical: 10,
        zIndex: 10,
    },

    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginRight: 10,
        height: 48,
        borderWidth: StyleSheet.hairlineWidth,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontFamily: baseFontFamily, fontSize: 16 },

    filterButton: {
        borderRadius: 12,
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },

    // Hover wrapper (web)
    cardPressable: {
        transform: [{ translateY: 0 }],
    },
    cardHover: {
        transform: [{ translateY: -2 }],
        ...Platform.select({
            default: {
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                transitionProperty: 'transform, box-shadow',
                transitionDuration: '120ms',
            } as any,
        }),
    },

    // Cards
    jobCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth,
        ...Platform.select({
            ios: { shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 2 },
            default: {},
        }),
    },
    jobCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    jobCardTitle: { fontFamily: baseFontFamily, fontSize: 20, fontWeight: '700' as const, flex: 1 },
    jobCardSubtitle: { fontFamily: baseFontFamily, fontSize: 14, marginBottom: 6 },
    jobCardDescription: { fontFamily: baseFontFamily, fontSize: 15, lineHeight: 22, marginTop: 2, marginBottom: 10 },
    jobCardDetailRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 2, marginBottom: 12 },
    jobCardIconText: { flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 6 },
    jobCardDetailText: { fontFamily: baseFontFamily, fontSize: 13, marginLeft: 6 },

    applyButton: {
        height: 44,
        paddingHorizontal: 14,
        borderRadius: 12,
        alignSelf: 'flex-end',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 140,
        ...Platform.select({
            ios: { shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 2 },
            default: {},
        }),
    },
    applyButtonText: { fontFamily: baseFontFamily, fontSize: 15, fontWeight: '600' as const },

    urgentTagContainer: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    urgentTagText: { fontFamily: baseFontFamily, fontSize: 12, fontWeight: '700' as const, color: '#fff' },

    overlayLoadingContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 9 },
    loadingText: { fontFamily: baseFontFamily, marginTop: 10, fontSize: 14 },
    overlayEmptyContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 9 },
    emptyText: { fontFamily: baseFontFamily, fontSize: 16, textAlign: 'center', marginTop: 10 },

    centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },

    filterModalView: {
        width: '92%',
        maxHeight: '85%',
        borderRadius: 16,
        padding: 20,
        borderWidth: StyleSheet.hairlineWidth,
        ...Platform.select({
            ios: { shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
            android: { elevation: 6 },
            default: {},
        }),
    },
    detailsModalView: {
        width: '92%',
        maxHeight: '85%',
        borderRadius: 16,
        padding: 20,
        borderWidth: StyleSheet.hairlineWidth,
        ...Platform.select({
            ios: { shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
            android: { elevation: 6 },
            default: {},
        }),
    },

    modalTitle: { fontFamily: baseFontFamily, fontSize: 20, fontWeight: '700' as const, textAlign: 'center', marginBottom: 20 },
    filterSection: { width: '100%', marginBottom: 18 },
    filterLabel: { fontFamily: baseFontFamily, fontSize: 14, fontWeight: '600' as const, marginBottom: 10 },

    // Radius display + switch row
    radiusLabelContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    radiusValueText: {
        fontFamily: baseFontFamily,
        fontSize: 16,
        fontWeight: '600' as const,
    },
    filterSwitchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    // Chips
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: StyleSheet.hairlineWidth,
    },
    chipText: { fontFamily: baseFontFamily, marginLeft: 8, fontSize: 14 },

    // Modal buttons
    modalButtonsContainer: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
    modalButton: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, flex: 1, alignItems: 'center', justifyContent: 'center' },
    resetButton: {},
    modalButtonText: { fontFamily: baseFontFamily, fontSize: 16, fontWeight: '600' as const },

    closeModalButton: { position: 'absolute', top: 12, right: 12, zIndex: 1 },

    modalLocation: { fontFamily: baseFontFamily, fontSize: 14, textAlign: 'center', marginBottom: 14 },
    divider: { height: 1, marginVertical: 14 },
    profileName: { fontFamily: baseFontFamily, fontSize: 22, fontWeight: '700' as const, textAlign: 'center' },
    profileSectionTitle: { fontFamily: baseFontFamily, fontSize: 12, fontWeight: '700' as const, marginTop: 10, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    profileDescription: { fontFamily: baseFontFamily, fontSize: 15, lineHeight: 22 },
    profileInfoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    profileInfoIcon: { marginRight: 12, marginTop: 2 },
    profileInfoLabel: { fontFamily: baseFontFamily, fontSize: 12, marginBottom: 2 },
    profileInfoValue: { fontFamily: baseFontFamily, fontSize: 15, flexShrink: 1 },

});