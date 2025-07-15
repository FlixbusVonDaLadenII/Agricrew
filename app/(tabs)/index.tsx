// app/(tabs)/index.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
    SafeAreaView,
    Platform,
    Alert,
} from 'react-native';
import { getThemeColors, Theme } from '@/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { supabase } from '@/lib/supabase';

// Import useFocusEffect from expo-router
import { useFocusEffect } from 'expo-router';

const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);

const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
});

const DRIVING_LICENSES = ['B', 'BE', 'C', 'CE', 'C1', 'C1E', 'T', 'L'];

interface Job {
    id: string;
    title: string;
    description: string;
    farm_name: string;
    location: string;
    distance_km: number;
    required_licenses: string[];
    salary_per_hour: number | null;
    job_type: string | null;
    is_active: boolean;
    farm_id: string;
}

export default function IndexScreen() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);

    // Filter states
    const [distanceFilter, setDistanceFilter] = useState(50);
    const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
    const [appliedDistanceFilter, setAppliedDistanceFilter] = useState(50);
    const [appliedLicenses, setAppliedLicenses] = useState<string[]>([]);

    // Function to fetch and filter jobs
    const fetchAndFilterJobs = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('jobs')
                .select(`
                    id,
                    title,
                    description,
                    location,
                    salary_per_hour,
                    required_licenses,
                    job_type,
                    is_active,
                    farm_id,
                    profiles(
                        full_name
                    )
                `)
                .eq('is_active', true);

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching jobs:', error);
                Alert.alert('Error', 'Failed to fetch jobs. Please try again.');
                setJobs([]);
            } else {
                let fetchedJobs: Job[] = data.map((job: any) => ({
                    id: job.id,
                    title: job.title,
                    description: job.description,
                    farm_name: job.profiles ? job.profiles.full_name : 'Unknown Farm',
                    location: job.location,
                    salary_per_hour: job.salary_per_hour,
                    required_licenses: job.required_licenses || [],
                    job_type: job.job_type,
                    is_active: job.is_active,
                    farm_id: job.farm_id,
                    distance_km: Math.floor(Math.random() * 50) + 1, // Placeholder
                }));

                fetchedJobs = fetchedJobs.filter(job => {
                    const matchesSearch = job.title.toLowerCase().includes(searchText.toLowerCase()) ||
                        job.description.toLowerCase().includes(searchText.toLowerCase()) ||
                        job.farm_name.toLowerCase().includes(searchText.toLowerCase()) ||
                        job.location.toLowerCase().includes(searchText.toLowerCase());

                    const matchesDistance = job.distance_km <= appliedDistanceFilter;

                    const matchesLicenses = appliedLicenses.length === 0 ||
                        appliedLicenses.every(license => job.required_licenses.includes(license));

                    return matchesSearch && matchesDistance && matchesLicenses;
                });

                setJobs(fetchedJobs);
            }
        } catch (error) {
            console.error('Unexpected error during job fetch:', error);
            Alert.alert('Error', 'An unexpected error occurred.');
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, [searchText, appliedDistanceFilter, appliedLicenses]);

    // Use useFocusEffect to refetch jobs when the screen comes into focus
    useFocusEffect(
        useCallback(() => {
            fetchAndFilterJobs();
            // Optional: return a cleanup function if you have listeners or timers
            return () => {
                // For example, if you had a WebSocket listener, you'd close it here
            };
        }, [fetchAndFilterJobs]) // Depend on fetchAndFilterJobs to ensure it's called with latest filters
    );

    const toggleLicense = (license: string) => {
        setSelectedLicenses(prev =>
            prev.includes(license)
                ? prev.filter(l => l !== license)
                : [...prev, license]
        );
    };

    const applyFilters = () => {
        setAppliedDistanceFilter(distanceFilter);
        setAppliedLicenses(selectedLicenses);
        setFilterModalVisible(false);
    };

    const resetFilters = () => {
        setDistanceFilter(50);
        setSelectedLicenses([]);
        setAppliedDistanceFilter(50);
        setAppliedLicenses([]);
        setFilterModalVisible(false);
    };

    const renderJobItem = ({ item }: { item: Job }) => (
        <View style={styles.jobCard}>
            <Text style={styles.jobTitle}>{item.title}</Text>
            <Text style={styles.jobFarm}>{item.farm_name} - {item.location}</Text>
            <Text style={styles.jobDescription}>{item.description}</Text>
            <View style={styles.jobDetailsRow}>
                <Text style={styles.jobDetail}>Distance: {item.distance_km} km</Text>
                {item.salary_per_hour !== null && (
                    <Text style={styles.jobDetail}>Salary: {item.salary_per_hour}€/hr</Text>
                )}
            </View>
            {item.required_licenses.length > 0 && (
                <Text style={styles.jobLicenses}>Licenses: {item.required_licenses.join(', ')}</Text>
            )}
            {item.job_type && (
                <Text style={styles.jobDetail}>Job Type: {item.job_type}</Text>
            )}
            <TouchableOpacity style={styles.applyButton}>
                <Text style={styles.applyButtonText}>Apply Now</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.pageTitle}>Available Jobs</Text>
            </View>

            <View style={styles.searchFilterContainer}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={24} color={themeColors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search jobs, farms, keywords..."
                        placeholderTextColor={themeColors.textHint}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>
                <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
                    <MaterialCommunityIcons name="filter-outline" size={24} color={themeColors.background} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={themeColors.primary} />
                    <Text style={styles.loadingText}>Loading Jobs...</Text>
                </View>
            ) : jobs.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="information-outline" size={50} color={themeColors.textSecondary} />
                    <Text style={styles.emptyText}>No jobs found matching your criteria.</Text>
                </View>
            ) : (
                <FlatList
                    data={jobs}
                    renderItem={renderJobItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.jobListContent}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={<View style={{ height: 20 }} />}
                />
            )}

            {/* Filter Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isFilterModalVisible}
                onRequestClose={() => setFilterModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={styles.filterModalView}>
                        <Text style={styles.modalTitle}>Filter Jobs</Text>

                        {/* Distance Slider */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Max Distance: {distanceFilter} km</Text>
                            <Slider
                                style={styles.slider}
                                minimumValue={0}
                                maximumValue={200}
                                step={5}
                                value={distanceFilter}
                                onValueChange={setDistanceFilter}
                                minimumTrackTintColor={themeColors.primary}
                                maximumTrackTintColor={themeColors.textSecondary + '50'}
                                thumbTintColor={themeColors.primary}
                            />
                        </View>

                        {/* Driving License Checkboxes */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Required Driving Licenses:</Text>
                            <ScrollView contentContainerStyle={styles.licensesContainer}>
                                {DRIVING_LICENSES.map(license => (
                                    <TouchableOpacity
                                        key={license}
                                        style={[
                                            styles.licenseCheckbox,
                                            selectedLicenses.includes(license) && styles.licenseCheckboxSelected,
                                        ]}
                                        onPress={() => toggleLicense(license)}
                                    >
                                        <MaterialCommunityIcons
                                            name={selectedLicenses.includes(license) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                            size={24}
                                            color={selectedLicenses.includes(license) ? themeColors.primary : themeColors.textSecondary}
                                        />
                                        <Text style={styles.licenseText}>{license}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.modalButtonsContainer}>
                            <TouchableOpacity style={[styles.modalButton, styles.resetButton]} onPress={resetFilters}>
                                <Text style={styles.modalButtonText}>Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalButton} onPress={applyFilters}>
                                <Text style={styles.modalButtonText}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.closeModalButton} onPress={() => setFilterModalVisible(false)}>
                            <MaterialCommunityIcons name="close-circle-outline" size={30} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 30 : 0,
        paddingBottom: 15,
        backgroundColor: themeColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: themeColors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pageTitle: {
        fontFamily: baseFontFamily,
        fontSize: 24,
        fontWeight: 'bold',
        color: themeColors.text,
    },
    searchFilterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: themeColors.background,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themeColors.surfaceHighlight,
        borderRadius: 10,
        paddingHorizontal: 15,
        marginRight: 10,
        height: 50,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontFamily: baseFontFamily,
        fontSize: 16,
        color: themeColors.text,
    },
    filterButton: {
        backgroundColor: themeColors.primary,
        borderRadius: 10,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: themeColors.primaryDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 3,
    },
    jobListContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    jobCard: {
        backgroundColor: themeColors.surface,
        borderRadius: 15,
        padding: 20,
        marginBottom: 15,
        shadowColor: themeColors.border,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        borderLeftWidth: 5,
        borderLeftColor: themeColors.primaryLight,
    },
    jobTitle: {
        fontFamily: baseFontFamily,
        fontSize: 20,
        fontWeight: 'bold',
        color: themeColors.text,
        marginBottom: 8,
    },
    jobFarm: {
        fontFamily: baseFontFamily,
        fontSize: 15,
        color: themeColors.textSecondary,
        marginBottom: 5,
    },
    jobDescription: {
        fontFamily: baseFontFamily,
        fontSize: 14,
        color: themeColors.text,
        marginBottom: 10,
    },
    jobDetailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    jobDetail: {
        fontFamily: baseFontFamily,
        fontSize: 14,
        color: themeColors.textSecondary,
    },
    jobLicenses: {
        fontFamily: baseFontFamily,
        fontSize: 13,
        color: themeColors.textSecondary,
        fontStyle: 'italic',
        marginTop: 5,
    },
    applyButton: {
        backgroundColor: themeColors.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginTop: 15,
        alignItems: 'center',
    },
    applyButtonText: {
        fontFamily: baseFontFamily,
        color: themeColors.background,
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontFamily: baseFontFamily,
        color: themeColors.textSecondary,
        marginTop: 10,
        fontSize: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontFamily: baseFontFamily,
        color: themeColors.textSecondary,
        fontSize: 18,
        textAlign: 'center',
        marginTop: 10,
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    filterModalView: {
        width: '90%',
        backgroundColor: themeColors.surface,
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontFamily: baseFontFamily,
        fontSize: 22,
        fontWeight: 'bold',
        color: themeColors.text,
        marginBottom: 25,
    },
    filterSection: {
        width: '100%',
        marginBottom: 20,
    },
    filterLabel: {
        fontFamily: baseFontFamily,
        fontSize: 16,
        color: themeColors.text,
        marginBottom: 10,
        fontWeight: '500',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    licensesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingVertical: 5,
    },
    licenseCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themeColors.surfaceHighlight,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 8,
        marginRight: 8,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    licenseCheckboxSelected: {
        borderColor: themeColors.primary,
        backgroundColor: themeColors.primaryLight + '20',
    },
    licenseText: {
        fontFamily: baseFontFamily,
        marginLeft: 8,
        fontSize: 15,
        color: themeColors.text,
    },
    modalButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 20,
    },
    modalButton: {
        backgroundColor: themeColors.primary,
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 10,
        minWidth: 120,
        alignItems: 'center',
        shadowColor: themeColors.primaryDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 3,
    },
    resetButton: {
        backgroundColor: themeColors.textSecondary,
        marginRight: 10,
    },
    modalButtonText: {
        fontFamily: baseFontFamily,
        color: themeColors.background,
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeModalButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 1,
    },
});