import React, { useState, useCallback, useRef } from 'react';
import {
    StyleSheet, View, Text, TextInput, FlatList, TouchableOpacity,
    ActivityIndicator, Modal, ScrollView, Platform, Alert, Animated, Linking, Switch
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


const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);
const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

const DRIVING_LICENSES = ['B', 'BE', 'C', 'CE', 'C1', 'C1E', 'T', 'L'];


// Interface definitions
interface FarmProfile {
    id: string; full_name: string; farm_description?: string; website?: string; contact_email?: string;
    address_street?: string; address_city?: string; address_postal_code?: string; address_country?: string;
    farm_specialization?: string[]; farm_size_hectares?: number; number_of_employees?: string;
    accommodation_offered?: boolean; machinery_brands?: string[];
}
interface Job {
    id: string; title: string; description: string; location: string; country: string; region: string;
    required_licenses: string[]; salary_per_hour: number | null; job_type: string[] | null; is_active: boolean;
    is_urgent: boolean;
    offers_accommodation: boolean;
    farm: FarmProfile;
    latitude: number | null;
    longitude: number | null;
}
interface ChatCreationResult { chat_id: string; is_new: boolean; }
interface UserLocation { latitude: number; longitude: number; }

// Animation config values
const SEARCH_BAR_HEIGHT = 48;
const SEARCH_BAR_VERTICAL_PADDING = 10;
const SEARCH_BAR_HORIZONTAL_PADDING = 20;
const SEARCH_BAR_TOTAL_HEIGHT = SEARCH_BAR_HEIGHT + (SEARCH_BAR_VERTICAL_PADDING * 2);
const COLLAPSED_TITLE_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : 56;
const COLLAPSED_TITLE_FONT_SIZE = 17;
const TITLE_MAX_FONT_SIZE = 34;
const SUBTITLE_MAX_FONT_SIZE = 20;
const INITIAL_TEXT_BLOCK_HEIGHT = TITLE_MAX_FONT_SIZE + 2 + SUBTITLE_MAX_FONT_SIZE;
const INITIAL_HEADER_TITLE_AREA_HEIGHT = INITIAL_TEXT_BLOCK_HEIGHT + 20;
const COLLAPSED_HEADER_HEIGHT = COLLAPSED_TITLE_BAR_HEIGHT;
const SCROLL_DISTANCE = INITIAL_HEADER_TITLE_AREA_HEIGHT - COLLAPSED_HEADER_HEIGHT;
const TOTAL_HEADER_AND_SEARCH_BAR_HEIGHT_AT_TOP = INITIAL_HEADER_TITLE_AREA_HEIGHT + SEARCH_BAR_TOTAL_HEIGHT;


// --- Haversine Distance Calculation Helper ---
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}


export default function IndexScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const translatedCountries = t('filters.countries', { returnObjects: true }) as Record<string, string>;
    const countryKeys = Object.keys(translatedCountries);

    // ADDED: Get job types from translation files
    const jobTypesOptions = t('jobTypes', { returnObjects: true }) as Record<string, string>;
    const jobTypeKeys = Object.keys(jobTypesOptions);

    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);
    const [isDetailsModalVisible, setDetailsModalVisible] = useState(false);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);

    // Filter states for the modal UI
    const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [radius, setRadius] = useState<number>(200);
    const [offersAccommodation, setOffersAccommodation] = useState(false);
    const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]); // ADDED

    // Applied filter states
    const [appliedLicenses, setAppliedLicenses] = useState<string[]>([]);
    const [appliedCountry, setAppliedCountry] = useState<string | null>(null);
    const [appliedRegions, setAppliedRegions] = useState<string[]>([]);
    const [appliedRadius, setAppliedRadius] = useState<number>(200);
    const [appliedOffersAccommodation, setAppliedOffersAccommodation] = useState(false);
    const [appliedJobTypes, setAppliedJobTypes] = useState<string[]>([]); // ADDED
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

    const scrollY = useRef(new Animated.Value(0)).current;

    const getUserLocation = async (): Promise<UserLocation | null> => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                t('jobList.locationPermissionTitle'),
                t('jobList.locationPermissionMessage')
            );
            return null;
        }

        try {
            let location = await Location.getCurrentPositionAsync({});
            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };
        } catch (error) {
            Alert.alert('Error', t('jobList.locationError'));
            console.error(error);
            return null;
        }
    };


    // MODIFIED: Added appliedJobTypes to dependency array and filter logic
    const fetchAndFilterJobs = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from('jobs').select(`*, profiles (*)`).eq('is_active', true);

            if (appliedRadius < 200 && userLocation) {
                query = query.not('latitude', 'is', null).not('longitude', 'is', null);
            }

            const { data, error } = await query;
            if (error) { throw error; }

            let fetchedJobs: Job[] = data.map((job: any) => ({
                id: job.id, title: job.title, description: job.description, location: job.location, country: job.country,
                region: job.region, salary_per_hour: job.salary_per_hour, required_licenses: job.required_licenses || [],
                job_type: job.job_type || [], is_active: job.is_active, is_urgent: job.is_urgent || false,
                offers_accommodation: job.offers_accommodation || false,
                farm: job.profiles ? { ...job.profiles } : { id: '', full_name: 'Unknown Farm' },
                latitude: job.latitude,
                longitude: job.longitude,
            }));

            fetchedJobs = fetchedJobs.filter(job => {
                const searchLower = searchText.toLowerCase();
                const matchesSearch = job.title.toLowerCase().includes(searchLower) ||
                    job.description.toLowerCase().includes(searchLower) ||
                    job.farm.full_name.toLowerCase().includes(searchLower) ||
                    job.location.toLowerCase().includes(searchLower);

                const matchesLicenses = appliedLicenses.length === 0 || appliedLicenses.every(license => job.required_licenses.includes(license));
                const matchesCountry = !appliedCountry || job.country === appliedCountry;
                const matchesRegion = appliedRegions.length === 0 || appliedRegions.includes(job.region);
                const matchesAccommodation = !appliedOffersAccommodation || job.offers_accommodation;
                // ADDED: Logic for job type filter
                const matchesJobTypes = appliedJobTypes.length === 0 || (job.job_type && appliedJobTypes.some(type => job.job_type!.includes(type)));

                const matchesRadius = (() => {
                    if (appliedRadius >= 200 || !userLocation || !job.latitude || !job.longitude) {
                        return true;
                    }
                    const distance = getDistanceFromLatLonInKm(userLocation.latitude, userLocation.longitude, job.latitude, job.longitude);
                    return distance <= appliedRadius;
                })();

                return matchesSearch && matchesLicenses && matchesCountry && matchesRegion && matchesRadius && matchesAccommodation && matchesJobTypes; // MODIFIED
            });

            fetchedJobs.sort((a, b) => {
                if (a.is_urgent && !b.is_urgent) return -1;
                if (!a.is_urgent && b.is_urgent) return 1;
                return 0;
            });

            setJobs(fetchedJobs);
        } catch (err: any) {
            console.error('Error fetching jobs:', err);
            Alert.alert('Error', 'An unexpected error occurred.');
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, [searchText, appliedLicenses, appliedCountry, appliedRegions, appliedRadius, userLocation, appliedOffersAccommodation, appliedJobTypes, t]);

    useFocusEffect(useCallback(() => { fetchAndFilterJobs(); }, [fetchAndFilterJobs]));

    const handleViewDetails = (job: Job) => {
        setSelectedJob(job);
        setDetailsModalVisible(true);
    };

    const handleStartChat = async (jobPosterId: string) => {
        if (!jobPosterId) {
            Alert.alert("Error", "This job posting is missing an owner.");
            return;
        }
        const { data, error } = await supabase.rpc('create_or_get_chat', { other_user_id: jobPosterId }).single();
        if (error) {
            console.error("Error starting chat:", error);
            Alert.alert("Error", `Could not start a chat. ${error.message}`);
            return;
        }
        const chatData = data as ChatCreationResult;
        if (chatData) {
            router.push({ pathname: "/(tabs)/chats/[id]", params: { id: chatData.chat_id } });
        }
    };

    const handleSelectCountry = (countryKey: string) => {
        setSelectedCountry(prev => (prev === countryKey ? null : countryKey));
        setSelectedRegions([]);
    };
    const toggleRegion = (regionKey: string) => setSelectedRegions(prev => prev.includes(regionKey) ? prev.filter(r => r !== regionKey) : [...prev, regionKey]);
    const toggleLicense = (license: string) => setSelectedLicenses(prev => prev.includes(license) ? prev.filter(l => l !== license) : [...prev, license]);
    // ADDED: Function to toggle job type filter
    const toggleJobType = (typeKey: string) => setSelectedJobTypes(prev => prev.includes(typeKey) ? prev.filter(t => t !== typeKey) : [...prev, typeKey]);

    // MODIFIED: Update applyFilters to include job types
    const applyFilters = async () => {
        let location: UserLocation | null = userLocation;
        if (radius < 200 && !location) {
            location = await getUserLocation();
            if (location) {
                setUserLocation(location);
            }
        }

        setAppliedLicenses(selectedLicenses);
        setAppliedCountry(selectedCountry);
        setAppliedRegions(selectedRegions);
        setAppliedRadius(location ? radius : 200);
        setAppliedOffersAccommodation(offersAccommodation);
        setAppliedJobTypes(selectedJobTypes); // ADDED
        setFilterModalVisible(false);
    };

    // MODIFIED: Update resetFilters to include job types
    const resetFilters = () => {
        setSelectedLicenses([]);
        setSelectedCountry(null);
        setSelectedRegions([]);
        setRadius(200);
        setOffersAccommodation(false);
        setSelectedJobTypes([]); // ADDED

        setAppliedLicenses([]);
        setAppliedCountry(null);
        setAppliedRegions([]);
        setAppliedRadius(200);
        setAppliedOffersAccommodation(false);
        setAppliedJobTypes([]); // ADDED
        setUserLocation(null);
        setFilterModalVisible(false);
    };

    const renderJobItem = ({ item }: { item: Job }) => {
        const countryDisplay = item.country ? t(`filters.countries.${item.country}`) : item.country;
        const regionDisplay = item.country && item.region ? t(`filters.regions.${item.country}.${item.region}`) : item.region;
        const translatedJobTypes = item.job_type ? item.job_type.map(key => t(`jobTypes.${key}`)).join(', ') : '';
        const salaryDisplay = item.salary_per_hour ? t('jobList.salaryPerHour', { salary: item.salary_per_hour }) : null;

        return (
            <TouchableOpacity onPress={() => handleViewDetails(item)}>
                <View style={styles.jobCard}>
                    <View style={styles.jobCardHeader}>
                        <Text style={styles.jobCardTitle}>{item.title}</Text>
                        {item.is_urgent && (
                            <View style={styles.urgentTagContainer}>
                                <Text style={styles.urgentTagText}>{t('SOS')}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.jobCardSubtitle}>{item.farm.full_name} • {item.location} ({regionDisplay}, {countryDisplay})</Text>
                    <Text style={styles.jobCardDescription} numberOfLines={2}>{item.description}</Text>
                    <View style={styles.jobCardDetailRow}>
                        {salaryDisplay && <View style={styles.jobCardIconText}><MaterialCommunityIcons name="currency-eur" size={16} color={themeColors.textSecondary} /><Text style={styles.jobCardDetailText}>{salaryDisplay}</Text></View>}
                        {item.offers_accommodation && (
                            <View style={styles.jobCardIconText}>
                                <MaterialCommunityIcons name="home-outline" size={16} color={themeColors.textSecondary} />
                                <Text style={styles.jobCardDetailText}>{t('jobList.accommodationOffered')}</Text>
                            </View>
                        )}
                        {translatedJobTypes && <View style={styles.jobCardIconText}><MaterialCommunityIcons name="briefcase-outline" size={16} color={themeColors.textSecondary} /><Text style={styles.jobCardDetailText}>{translatedJobTypes}</Text></View>}
                        {item.required_licenses.length > 0 && <View style={styles.jobCardIconText}><MaterialCommunityIcons name="card-account-details-outline" size={16} color={themeColors.textSecondary} /><Text style={styles.jobCardDetailText}>{item.required_licenses.join(', ')}</Text></View>}
                    </View>
                    <TouchableOpacity style={styles.applyButton} onPress={() => handleStartChat(item.farm.id)}>
                        <Text style={styles.applyButtonText}>{t('jobList.applyNow')}</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    }

    const headerHeight = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE], outputRange: [INITIAL_HEADER_TITLE_AREA_HEIGHT, COLLAPSED_HEADER_HEIGHT], extrapolate: 'clamp' });
    const headerTranslateY = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE], outputRange: [0, -SCROLL_DISTANCE], extrapolate: 'clamp' });
    const titleFontSize = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE], outputRange: [TITLE_MAX_FONT_SIZE, COLLAPSED_TITLE_FONT_SIZE], extrapolate: 'clamp' });
    const subtitleOpacity = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE * 0.7], outputRange: [1, 0], extrapolate: 'clamp' });
    const titleTextTranslateY = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE], outputRange: [0, COLLAPSED_HEADER_HEIGHT / 2 - COLLAPSED_TITLE_FONT_SIZE / 2 - (INITIAL_HEADER_TITLE_AREA_HEIGHT - INITIAL_TEXT_BLOCK_HEIGHT) / 2], extrapolate: 'clamp' });
    const searchBarTranslateY = scrollY.interpolate({ inputRange: [0, SCROLL_DISTANCE], outputRange: [0, -SCROLL_DISTANCE], extrapolate: 'clamp' });

    const ProfileInfoRow = ({ icon, label, value }: { icon: any, label: string, value?: string | null | number }) => {
        if (!value) return null;
        return ( <View style={styles.profileInfoRow}><MaterialCommunityIcons name={icon} size={20} color={themeColors.textSecondary} style={styles.profileInfoIcon} /><View><Text style={styles.profileInfoLabel}>{label}</Text><Text style={styles.profileInfoValue}>{value}</Text></View></View>);
    };

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.fixedTopSpacer, { height: insets.top, backgroundColor: themeColors.background }]} />
            <Animated.View style={[styles.animatedHeaderContainer, { top: insets.top, height: headerHeight, transform: [{ translateY: headerTranslateY }], paddingTop: (INITIAL_HEADER_TITLE_AREA_HEIGHT - INITIAL_TEXT_BLOCK_HEIGHT) / 2, paddingBottom: (INITIAL_HEADER_TITLE_AREA_HEIGHT - INITIAL_TEXT_BLOCK_HEIGHT) / 2 }]}>
                <Animated.View style={[styles.headerTextContainer, { transform: [{ translateY: titleTextTranslateY }] }]}>
                    <Animated.Text style={[styles.screenTitle, { fontSize: titleFontSize }]}>{t('jobList.title')}</Animated.Text>
                    <Animated.Text style={[styles.pageSubtitle, { opacity: subtitleOpacity, fontSize: SUBTITLE_MAX_FONT_SIZE }]}>
                        <Trans i18nKey="jobList.subtitle">Your <Text style={styles.headerAccentText}>Adventure</Text> Starts Here!</Trans>
                    </Animated.Text>
                </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.stickySearchBarContainer, { top: Animated.add(insets.top, headerHeight), transform: [{ translateY: searchBarTranslateY }] }]}>
                <View style={styles.searchBar}><MaterialCommunityIcons name="magnify" size={24} color={themeColors.textSecondary} style={styles.searchIcon} /><TextInput style={styles.searchInput} placeholder={t('jobList.searchPlaceholder')} placeholderTextColor={themeColors.textHint} value={searchText} onChangeText={setSearchText} /></View>
                <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}><MaterialCommunityIcons name="filter-variant" size={24} color={themeColors.primary} /></TouchableOpacity>
            </Animated.View>

            <Animated.FlatList data={jobs} renderItem={renderJobItem} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingTop: insets.top + TOTAL_HEADER_AND_SEARCH_BAR_HEIGHT_AT_TOP, paddingHorizontal: 20, paddingBottom: insets.bottom }} showsVerticalScrollIndicator={false} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })} scrollEventThrottle={16} ListFooterComponent={<View style={{ height: 20 }} />} />

            {loading && <View style={[styles.overlayLoadingContainer, { paddingTop: insets.top + TOTAL_HEADER_AND_SEARCH_BAR_HEIGHT_AT_TOP }]}><ActivityIndicator size="large" color={themeColors.primary} /><Text style={styles.loadingText}>{t('jobList.loading')}</Text></View>}
            {!loading && jobs.length === 0 && <View style={[styles.overlayEmptyContainer, { paddingTop: insets.top + TOTAL_HEADER_AND_SEARCH_BAR_HEIGHT_AT_TOP }]}><MaterialCommunityIcons name="information-outline" size={50} color={themeColors.textSecondary} /><Text style={styles.emptyText}>{t('jobList.noJobs')}</Text></View>}

            <Modal animationType="slide" transparent={true} visible={isFilterModalVisible} onRequestClose={() => setFilterModalVisible(false)}>
                <View style={styles.centeredView}>
                    <View style={styles.filterModalView}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            <Text style={styles.modalTitle}>{t('jobList.filterTitle')}</Text>

                            <View style={styles.filterSection}>
                                <View style={styles.radiusLabelContainer}>
                                    <Text style={styles.filterLabel}>{t('jobList.radius')}</Text>
                                    <Text style={styles.radiusValueText}>
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

                            {/* ADDED: Job Type Filter Section */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterLabel}>{t('jobList.jobType')}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.licensesContainer}>
                                        {jobTypeKeys.map((key) => {
                                            const isSelected = selectedJobTypes.includes(key);
                                            return (
                                                <TouchableOpacity
                                                    key={`job-type-${key}`}
                                                    onPress={() => toggleJobType(key)}
                                                    style={[styles.licenseCheckbox, isSelected && styles.licenseCheckboxSelected]}
                                                >
                                                    <MaterialCommunityIcons name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={isSelected ? themeColors.primary : themeColors.textSecondary} />
                                                    <Text style={styles.licenseText}>{jobTypesOptions[key]}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            </View>

                            <View style={styles.filterSection}>
                                <Text style={styles.filterLabel}>{t('jobList.country')}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.countrySelectorContainer}>{countryKeys.map((key, index) => (<TouchableOpacity key={`country-${key}-${index}`} onPress={() => handleSelectCountry(key)} style={[styles.countryButton, selectedCountry === key && styles.countryButtonSelected]}><Text style={[styles.countryButtonText, selectedCountry === key && styles.countryButtonTextSelected]}>{translatedCountries[key]}</Text></TouchableOpacity>))}</View>
                                </ScrollView>
                            </View>
                            {selectedCountry && ( <View style={styles.filterSection}><Text style={styles.filterLabel}>{t('jobList.region')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.licensesContainer}>{Object.entries(t(`filters.regions.${selectedCountry}`, { returnObjects: true }) as Record<string, string>).map(([key, value], index) => { const isSelected = selectedRegions.includes(key); return (<TouchableOpacity key={`region-${key}-${index}`} onPress={() => toggleRegion(key)} style={[styles.licenseCheckbox, isSelected && styles.licenseCheckboxSelected]}><MaterialCommunityIcons name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={isSelected ? themeColors.primary : themeColors.textSecondary} /><Text style={styles.licenseText}>{value}</Text></TouchableOpacity>);})}</View></ScrollView></View>)}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterLabel}>{t('jobList.licenses')}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.licensesContainer}>{DRIVING_LICENSES.map((license, index) => { return (<TouchableOpacity key={`license-${license}-${index}`} onPress={() => toggleLicense(license)} style={[styles.licenseCheckbox, selectedLicenses.includes(license) && styles.licenseCheckboxSelected]}><MaterialCommunityIcons name={selectedLicenses.includes(license) ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={selectedLicenses.includes(license) ? themeColors.primary : themeColors.textSecondary} /><Text style={styles.licenseText}>{license}</Text></TouchableOpacity>);})}</View></ScrollView>
                            </View>

                            <View style={styles.filterSection}>
                                <View style={styles.filterSwitchRow}>
                                    <Text style={styles.filterLabel}>{t('jobList.filterByAccommodation')}</Text>
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
                                <TouchableOpacity style={[styles.modalButton, styles.resetButton]} onPress={resetFilters}><Text style={styles.modalButtonText}>{t('jobList.reset')}</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.modalButton} onPress={applyFilters}><Text style={styles.modalButtonText}>{t('jobList.applyFilters')}</Text></TouchableOpacity>
                            </View>
                        </ScrollView>
                        <TouchableOpacity style={styles.closeModalButton} onPress={() => setFilterModalVisible(false)}><MaterialCommunityIcons name="close-circle-outline" size={30} color={themeColors.textSecondary} /></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                animationType="slide"
                transparent={true}
                visible={isDetailsModalVisible}
                onRequestClose={() => setDetailsModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={styles.detailsModalView}>
                        {selectedJob && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.profileName}>{selectedJob.title}</Text>
                                <Text style={styles.modalLocation}>{selectedJob.farm.full_name} • {selectedJob.location}</Text>
                                <View style={styles.divider} />
                                <Text style={styles.profileSectionTitle}>{selectedJob.title}</Text>
                                <Text style={styles.profileDescription}>{selectedJob.description}</Text>
                                <View style={styles.divider} />
                                <Text style={styles.profileSectionTitle}>{t('jobList.profile.about')}</Text>
                                {selectedJob.farm.farm_description && (
                                    <Text style={styles.profileDescription}>{selectedJob.farm.farm_description}</Text>
                                )}
                                <ProfileInfoRow icon="map-marker-outline" label={t('jobList.profile.address')} value={selectedJob.farm.address_street ? `${selectedJob.farm.address_street}, ${selectedJob.farm.address_postal_code} ${selectedJob.farm.address_city}` : null} />
                                {selectedJob.farm.contact_email && <ProfileInfoRow icon="email-outline" label={t('jobList.profile.email')} value={selectedJob.farm.contact_email} />}
                                {selectedJob.farm.website && <TouchableOpacity onPress={() => Linking.openURL(selectedJob.farm.website!)}><View style={styles.profileInfoRow}><MaterialCommunityIcons name="web" size={20} color={themeColors.textSecondary} style={styles.profileInfoIcon} /><View><Text style={styles.profileInfoLabel}>{t('jobList.profile.website')}</Text><Text style={[styles.profileInfoValue, styles.profileWebsite]}>{selectedJob.farm.website}</Text></View></View></TouchableOpacity>}
                                <ProfileInfoRow icon="pine-tree" label={t('jobList.profile.farmSize')} value={selectedJob.farm.farm_size_hectares ? `${selectedJob.farm.farm_size_hectares} ha` : null} />
                                <ProfileInfoRow icon="account-group-outline" label={t('jobList.profile.employees')} value={selectedJob.farm.number_of_employees} />
                            </ScrollView>
                        )}
                        <TouchableOpacity style={styles.closeModalButton} onPress={() => setDetailsModalVisible(false)}>
                            <MaterialCommunityIcons name="close-circle-outline" size={30} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    fixedTopSpacer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 12 },
    animatedHeaderContainer: { position: 'absolute', left: 0, right: 0, backgroundColor: themeColors.background, overflow: 'hidden', zIndex: 11, paddingHorizontal: 20, justifyContent: 'center' },
    headerTextContainer: {},
    screenTitle: { fontFamily: baseFontFamily, fontWeight: 'bold', color: themeColors.text },
    pageSubtitle: { fontFamily: baseFontFamily, fontWeight: '600', color: themeColors.textSecondary, marginTop: 2 },
    headerAccentText: { color: themeColors.primary },
    stickySearchBarContainer: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', height: SEARCH_BAR_TOTAL_HEIGHT, paddingHorizontal: SEARCH_BAR_HORIZONTAL_PADDING, paddingVertical: SEARCH_BAR_VERTICAL_PADDING, backgroundColor: themeColors.background, zIndex: 10, shadowColor: 'rgba(0,0,0,0.1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 3, elevation: 4 },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.surfaceHighlight, borderRadius: 12, paddingHorizontal: 12, marginRight: 10, height: SEARCH_BAR_HEIGHT, borderWidth: 0 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text },
    filterButton: { backgroundColor: themeColors.surfaceHighlight, borderRadius: 12, width: 48, height: SEARCH_BAR_HEIGHT, justifyContent: 'center', alignItems: 'center' },
    jobCard: { backgroundColor: themeColors.surface, borderRadius: 18, padding: 20, marginBottom: 15, shadowColor: 'rgba(0,0,0,0.1)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 5, overflow: 'hidden' },
    jobCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    jobCardTitle: { fontFamily: baseFontFamily, fontSize: 22, fontWeight: 'bold', color: themeColors.text, flex: 1 },
    jobCardSubtitle: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, marginBottom: 4 },
    jobCardDescription: { fontFamily: baseFontFamily, fontSize: 15, color: themeColors.text, lineHeight: 22, marginBottom: 12 },
    jobCardDetailRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 5, marginBottom: 15 },
    jobCardIconText: { flexDirection: 'row', alignItems: 'center', marginRight: 15, marginBottom: 5 },
    jobCardDetailText: { fontFamily: baseFontFamily, fontSize: 14, color: themeColors.textSecondary, marginLeft: 5 },
    applyButton: { backgroundColor: themeColors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: themeColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    applyButtonText: { fontFamily: baseFontFamily, color: themeColors.background, fontSize: 17, fontWeight: '600' },
    urgentTagContainer: { backgroundColor: themeColors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    urgentTagText: { fontFamily: baseFontFamily, fontSize: 14, fontWeight: 'bold', color: '#fff' },
    overlayLoadingContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background, zIndex: 9 },
    loadingText: { fontFamily: baseFontFamily, color: themeColors.textSecondary, marginTop: 10, fontSize: 16 },
    overlayEmptyContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background, padding: 20, zIndex: 9 },
    emptyText: { fontFamily: baseFontFamily, color: themeColors.textSecondary, fontSize: 18, textAlign: 'center', marginTop: 10 },
    centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
    filterModalView: { width: '90%', maxHeight: '85%', backgroundColor: themeColors.surface, borderRadius: 20, padding: 25, shadowColor: 'rgba(0,0,0,0.2)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 6 },
    modalTitle: { fontFamily: baseFontFamily, fontSize: 22, fontWeight: 'bold', color: themeColors.text, marginBottom: 25, textAlign: 'center' },
    filterSection: { width: '100%', marginBottom: 20 },
    filterLabel: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text, marginBottom: 12, fontWeight: '500' },
    countrySelectorContainer: { flexDirection: 'row' },
    countryButton: { marginRight: 10, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, backgroundColor: themeColors.surfaceHighlight, borderWidth: 1, borderColor: themeColors.surfaceHighlight },
    countryButtonSelected: { backgroundColor: themeColors.primary + '20', borderColor: themeColors.primary },
    countryButtonText: { color: themeColors.text, fontWeight: '600' },
    countryButtonTextSelected: { color: themeColors.primary },
    licensesContainer: { flexDirection: 'row', flexWrap: 'wrap' }, // MODIFIED: Added flexWrap
    licenseCheckbox: { flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.surfaceHighlight, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8, marginRight: 8 },
    licenseCheckboxSelected: { backgroundColor: themeColors.primary + '20' },
    licenseText: { fontFamily: baseFontFamily, marginLeft: 8, fontSize: 15, color: themeColors.text },
    modalButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
    modalButton: { backgroundColor: themeColors.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, flex: 1, alignItems: 'center', justifyContent: 'center' },
    resetButton: { backgroundColor: themeColors.surfaceHighlight, marginRight: 10 },
    modalButtonText: { fontFamily: baseFontFamily, color: themeColors.background, fontSize: 17, fontWeight: '600' },
    closeModalButton: { position: 'absolute', top: 15, right: 15, zIndex: 1 },
    detailsModalView: { width: '90%', maxHeight: '85%', backgroundColor: themeColors.surface, borderRadius: 20, padding: 25, shadowColor: 'rgba(0,0,0,0.2)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 6 },
    modalLocation: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, textAlign: 'center', marginBottom: 16, },
    divider: { height: 1, backgroundColor: themeColors.border, marginVertical: 16 },
    profileName: { fontFamily: baseFontFamily, fontSize: 24, fontWeight: 'bold', color: themeColors.text, textAlign: 'center' },
    profileSectionTitle: { fontFamily: baseFontFamily, fontSize: 14, fontWeight: 'bold', color: themeColors.textSecondary, marginTop: 10, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    profileDescription: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text, lineHeight: 24 },
    profileInfoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
    profileInfoIcon: { marginRight: 15, marginTop: 2, color: themeColors.textSecondary },
    profileInfoLabel: { fontFamily: baseFontFamily, fontSize: 12, color: themeColors.textSecondary, marginBottom: 2 },
    profileInfoValue: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text, flexShrink: 1 },
    profileWebsite: { color: themeColors.primary, textDecorationLine: 'underline' },
    radiusLabelContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    radiusValueText: {
        fontFamily: baseFontFamily,
        fontSize: 16,
        fontWeight: '500',
        color: themeColors.primary,
    },
    filterSwitchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});