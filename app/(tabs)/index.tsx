import React, { useState, useCallback, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    ScrollView,
    Platform,
    Alert,
    Animated,
    Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, Theme } from '@/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation, Trans } from 'react-i18next';

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
    farm: FarmProfile;
}
interface ChatCreationResult { chat_id: string; is_new: boolean; }

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


export default function IndexScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const translatedCountries = t('filters.countries', { returnObjects: true }) as Record<string, string>;
    const countryKeys = Object.keys(translatedCountries);

    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);
    const [isProfileModalVisible, setProfileModalVisible] = useState(false);
    const [selectedFarm, setSelectedFarm] = useState<FarmProfile | null>(null);

    const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

    const [appliedLicenses, setAppliedLicenses] = useState<string[]>([]);
    const [appliedCountry, setAppliedCountry] = useState<string | null>(null);
    const [appliedRegions, setAppliedRegions] = useState<string[]>([]);

    const scrollY = useRef(new Animated.Value(0)).current;

    const fetchAndFilterJobs = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from('jobs').select(`*, profiles (*)`).eq('is_active', true);
            const { data, error } = await query;

            if (error) { throw error; }

            let fetchedJobs: Job[] = data.map((job: any) => ({
                id: job.id, title: job.title, description: job.description, location: job.location, country: job.country,
                region: job.region, salary_per_hour: job.salary_per_hour, required_licenses: job.required_licenses || [],
                job_type: job.job_type || [], is_active: job.is_active,
                farm: job.profiles ? { ...job.profiles } : { id: '', full_name: 'Unknown Farm' },
            }));

            fetchedJobs = fetchedJobs.filter(job => {
                const searchLower = searchText.toLowerCase();
                const matchesSearch = job.title.toLowerCase().includes(searchLower) ||
                    job.description.toLowerCase().includes(searchLower) ||
                    job.farm.full_name.toLowerCase().includes(searchLower) ||
                    job.location.toLowerCase().includes(searchLower);

                const matchesLicenses = appliedLicenses.length === 0 || appliedLicenses.every(license => job.required_licenses.includes(license));

                // Corrected filtering: Compare key vs key
                const matchesCountry = !appliedCountry || job.country === appliedCountry;
                const matchesRegion = appliedRegions.length === 0 || appliedRegions.includes(job.region);

                return matchesSearch && matchesLicenses && matchesCountry && matchesRegion;
            });
            setJobs(fetchedJobs);
        } catch (err: any) {
            console.error('Error fetching jobs:', err);
            Alert.alert('Error', 'An unexpected error occurred.');
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, [searchText, appliedLicenses, appliedCountry, appliedRegions, t]);

    useFocusEffect(useCallback(() => { fetchAndFilterJobs(); }, [fetchAndFilterJobs]));

    const handleViewFarmProfile = (farm: FarmProfile) => {
        setSelectedFarm(farm);
        setProfileModalVisible(true);
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
    const applyFilters = () => {
        setAppliedLicenses(selectedLicenses);
        setAppliedCountry(selectedCountry);
        setAppliedRegions(selectedRegions);
        setFilterModalVisible(false);
    };
    const resetFilters = () => {
        setSelectedLicenses([]);
        setSelectedCountry(null);
        setSelectedRegions([]);
        setAppliedLicenses([]);
        setAppliedCountry(null);
        setAppliedRegions([]);
        setFilterModalVisible(false);
    };

    const renderJobItem = ({ item }: { item: Job }) => {
        const countryDisplay = item.country ? t(`filters.countries.${item.country}`) : item.country;
        const regionDisplay = item.country && item.region ? t(`filters.regions.${item.country}.${item.region}`) : item.region;

        const translatedJobTypes = item.job_type
            ? item.job_type.map(key => t(`jobTypes.${key}`)).join(', ')
            : '';

        const salaryDisplay = item.salary_per_hour
            ? t('jobList.salaryPerHour', { salary: item.salary_per_hour })
            : null;

        return (
            <TouchableOpacity onPress={() => handleViewFarmProfile(item.farm)}>
                <View style={styles.jobCard}>
                    <Text style={styles.jobCardTitle}>{item.title}</Text>
                    <Text style={styles.jobCardSubtitle}>{item.farm.full_name} • {item.location} ({regionDisplay}, {countryDisplay})</Text>
                    <View style={styles.jobCardDetailRow}>
                        {salaryDisplay && <View style={styles.jobCardIconText}><MaterialCommunityIcons name="currency-eur" size={16} color={themeColors.textSecondary} /><Text style={styles.jobCardDetailText}>{salaryDisplay}</Text></View>}
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
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalTitle}>{t('jobList.filterTitle')}</Text>
                            <View style={styles.filterSection}>
                                <Text style={styles.filterLabel}>{t('jobList.country')}</Text>
                                <View style={styles.countrySelectorContainer}>{countryKeys.map(key => (<TouchableOpacity key={key} onPress={() => handleSelectCountry(key)} style={[styles.countryButton, selectedCountry === key && styles.countryButtonSelected]}><Text style={[styles.countryButtonText, selectedCountry === key && styles.countryButtonTextSelected]}>{translatedCountries[key]}</Text></TouchableOpacity>))}</View>
                            </View>
                            {selectedCountry && ( <View style={styles.filterSection}><Text style={styles.filterLabel}>{t('jobList.region')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.licensesContainer}>{Object.entries(t(`filters.regions.${selectedCountry}`, { returnObjects: true }) as Record<string, string>).map(([key, value]) => { const isSelected = selectedRegions.includes(key); return (<TouchableOpacity key={key} onPress={() => toggleRegion(key)} style={[styles.licenseCheckbox, isSelected && styles.licenseCheckboxSelected]}><MaterialCommunityIcons name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={isSelected ? themeColors.primary : themeColors.textSecondary} /><Text style={styles.licenseText}>{value}</Text></TouchableOpacity>);})}</View></ScrollView></View>)}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterLabel}>{t('jobList.licenses')}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.licensesContainer}>{DRIVING_LICENSES.map(license => { const isSelected = selectedLicenses.includes(license); return (<TouchableOpacity key={license} onPress={() => toggleLicense(license)} style={[styles.licenseCheckbox, isSelected && styles.licenseCheckboxSelected]}><MaterialCommunityIcons name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={isSelected ? themeColors.primary : themeColors.textSecondary} /><Text style={styles.licenseText}>{license}</Text></TouchableOpacity>);})}</View></ScrollView>
                            </View>
                        </ScrollView>
                        <View style={styles.modalButtonsContainer}>
                            <TouchableOpacity style={[styles.modalButton, styles.resetButton]} onPress={resetFilters}><Text style={styles.modalButtonText}>{t('jobList.reset')}</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.modalButton} onPress={applyFilters}><Text style={styles.modalButtonText}>{t('jobList.applyFilters')}</Text></TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.closeModalButton} onPress={() => setFilterModalVisible(false)}><MaterialCommunityIcons name="close-circle-outline" size={30} color={themeColors.textSecondary} /></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal animationType="slide" transparent={true} visible={isProfileModalVisible} onRequestClose={() => setProfileModalVisible(false)}>
                <View style={styles.centeredView}>
                    <View style={styles.profileModalView}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.profileName}>{selectedFarm?.full_name}</Text>
                            {selectedFarm?.farm_description && (<><Text style={styles.profileSectionTitle}>{t('jobList.profile.about')}</Text><Text style={styles.profileDescription}>{selectedFarm.farm_description}</Text></>)}
                            <Text style={styles.profileSectionTitle}>{t('jobList.profile.contact')}</Text>
                            {selectedFarm?.address_street && <ProfileInfoRow icon="map-marker-outline" label={t('jobList.profile.address')} value={`${selectedFarm.address_street}, ${selectedFarm.address_postal_code} ${selectedFarm.address_city}, ${selectedFarm.address_country}`} />}
                            {selectedFarm?.contact_email && <ProfileInfoRow icon="email-outline" label={t('jobList.profile.email')} value={selectedFarm.contact_email} />}
                            {selectedFarm?.website && <TouchableOpacity onPress={() => Linking.openURL(selectedFarm!.website!)}><View style={styles.profileInfoRow}><MaterialCommunityIcons name="web" size={20} color={themeColors.textSecondary} style={styles.profileInfoIcon} /><View><Text style={styles.profileInfoLabel}>{t('jobList.profile.website')}</Text><Text style={[styles.profileInfoValue, styles.profileWebsite]}>{selectedFarm.website}</Text></View></View></TouchableOpacity>}
                            <Text style={styles.profileSectionTitle}>{t('jobList.profile.details')}</Text>
                            <ProfileInfoRow icon="pine-tree" label={t('jobList.profile.farmSize')} value={selectedFarm?.farm_size_hectares ? `${selectedFarm.farm_size_hectares} ha` : null} />
                            <ProfileInfoRow icon="account-group-outline" label={t('jobList.profile.employees')} value={selectedFarm?.number_of_employees} />
                            <ProfileInfoRow icon="sprout-outline" label={t('jobList.profile.specializations')} value={selectedFarm?.farm_specialization?.join(', ')} />
                            <ProfileInfoRow icon="tractor" label={t('jobList.profile.machinery')} value={selectedFarm?.machinery_brands?.join(', ')} />
                            {selectedFarm?.accommodation_offered !== null && (<><Text style={styles.profileSectionTitle}>{t('jobList.profile.benefits')}</Text><ProfileInfoRow icon="home-city-outline" label={t('jobList.profile.accommodation')} value={selectedFarm?.accommodation_offered ? t('jobList.profile.yes') : t('jobList.profile.no')} /></>)}
                        </ScrollView>
                        <TouchableOpacity style={styles.profileModalButton} onPress={() => setProfileModalVisible(false)}>
                            <Text style={styles.modalButtonText}>{t('jobList.profile.done')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeModalButton} onPress={() => setProfileModalVisible(false)}><MaterialCommunityIcons name="close-circle-outline" size={30} color={themeColors.textSecondary} /></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    fixedTopSpacer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 12 },
    animatedHeaderContainer: { position: 'absolute', left: 0, right: 0, backgroundColor: themeColors.background, overflow: 'hidden', zIndex: 11, paddingHorizontal: 20 },
    headerTextContainer: { position: 'absolute', left: 20, right: 20, top: 0 },
    screenTitle: { fontFamily: baseFontFamily, fontWeight: 'bold', color: themeColors.text },
    pageSubtitle: { fontFamily: baseFontFamily, fontWeight: '600', color: themeColors.textSecondary, marginTop: 2 },
    headerAccentText: { color: themeColors.primary },
    stickySearchBarContainer: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', height: SEARCH_BAR_TOTAL_HEIGHT, paddingHorizontal: SEARCH_BAR_HORIZONTAL_PADDING, paddingVertical: SEARCH_BAR_VERTICAL_PADDING, backgroundColor: themeColors.background, zIndex: 10, shadowColor: 'rgba(0,0,0,0.1)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 3, elevation: 4 },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.surfaceHighlight, borderRadius: 12, paddingHorizontal: 12, marginRight: 10, height: SEARCH_BAR_HEIGHT, borderWidth: 0 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text },
    filterButton: { backgroundColor: themeColors.surfaceHighlight, borderRadius: 12, width: 48, height: SEARCH_BAR_HEIGHT, justifyContent: 'center', alignItems: 'center' },
    jobCard: { backgroundColor: themeColors.surface, borderRadius: 18, padding: 20, marginBottom: 15, shadowColor: 'rgba(0,0,0,0.1)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 5, overflow: 'hidden' },
    jobCardTitle: { fontFamily: baseFontFamily, fontSize: 22, fontWeight: 'bold', color: themeColors.text, marginBottom: 8 },
    jobCardSubtitle: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, marginBottom: 12 },
    jobCardDetailRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 5, marginBottom: 15 },
    jobCardIconText: { flexDirection: 'row', alignItems: 'center', marginRight: 15, marginBottom: 5 },
    jobCardDetailText: { fontFamily: baseFontFamily, fontSize: 14, color: themeColors.textSecondary, marginLeft: 5 },
    applyButton: { backgroundColor: themeColors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: themeColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    applyButtonText: { fontFamily: baseFontFamily, color: themeColors.background, fontSize: 17, fontWeight: '600' },
    overlayLoadingContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background, zIndex: 9 },
    loadingText: { fontFamily: baseFontFamily, color: themeColors.textSecondary, marginTop: 10, fontSize: 16 },
    overlayEmptyContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background, padding: 20, zIndex: 9 },
    emptyText: { fontFamily: baseFontFamily, color: themeColors.textSecondary, fontSize: 18, textAlign: 'center', marginTop: 10 },
    centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
    filterModalView: { width: '90%', maxHeight: '85%', backgroundColor: themeColors.surface, borderRadius: 20, padding: 25, shadowColor: 'rgba(0,0,0,0.2)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 6 },
    modalTitle: { fontFamily: baseFontFamily, fontSize: 22, fontWeight: 'bold', color: themeColors.text, marginBottom: 25, textAlign: 'center' },
    filterSection: { width: '100%', marginBottom: 20 },
    filterLabel: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text, marginBottom: 12, fontWeight: '500' },
    countrySelectorContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 10 },
    countryButton: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, backgroundColor: themeColors.surfaceHighlight, borderWidth: 1, borderColor: themeColors.surfaceHighlight },
    countryButtonSelected: { backgroundColor: themeColors.primary + '20', borderColor: themeColors.primary },
    countryButtonText: { color: themeColors.text, fontWeight: '600' },
    countryButtonTextSelected: { color: themeColors.primary },
    licensesContainer: { flexDirection: 'row', },
    licenseCheckbox: { flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.surfaceHighlight, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8, marginRight: 8 },
    licenseCheckboxSelected: { backgroundColor: themeColors.primary + '20' },
    licenseText: { fontFamily: baseFontFamily, marginLeft: 8, fontSize: 15, color: themeColors.text },
    modalButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
    modalButton: { backgroundColor: themeColors.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, flex: 1, alignItems: 'center', justifyContent: 'center' },
    resetButton: { backgroundColor: themeColors.surfaceHighlight, marginRight: 10 },
    modalButtonText: { fontFamily: baseFontFamily, color: themeColors.background, fontSize: 17, fontWeight: '600', },
    closeModalButton: { position: 'absolute', top: 15, right: 15, zIndex: 1 },
    profileModalView: { width: '90%', maxHeight: '85%', backgroundColor: themeColors.surface, borderRadius: 20, padding: 25, shadowColor: 'rgba(0,0,0,0.2)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 6 },
    profileName: { fontFamily: baseFontFamily, fontSize: 24, fontWeight: 'bold', color: themeColors.text, textAlign: 'center', marginBottom: 10 },
    profileSectionTitle: { fontFamily: baseFontFamily, fontSize: 14, fontWeight: 'bold', color: themeColors.textSecondary, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    profileDescription: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text, lineHeight: 24 },
    profileInfoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
    profileInfoIcon: { marginRight: 15, marginTop: 2, color: themeColors.textSecondary },
    profileInfoLabel: { fontFamily: baseFontFamily, fontSize: 12, color: themeColors.textSecondary, marginBottom: 2 },
    profileInfoValue: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text, flexShrink: 1 },
    profileWebsite: { color: themeColors.primary, textDecorationLine: 'underline' },
    profileModalButton: {
        backgroundColor: themeColors.primary,
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    profileModalButtonText: {
        fontFamily: baseFontFamily,
        color: themeColors.background,
        fontSize: 17,
        fontWeight: '600',
    },
});