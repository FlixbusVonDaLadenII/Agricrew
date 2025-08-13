import React, { useState, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Platform,
    StatusBar
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, router } from 'expo-router';
import { getThemeColors } from '@/theme/colors';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const themeColors = getThemeColors('dark');

interface Job {
    id: string;
    title: string;
    description: string;
    location: string;
    country: string;
    region: string;
    salary_per_hour: number | null;
    required_licenses: string[];
    job_type: string[] | null;
    is_active: boolean;
    farm_id: string;
    created_at: string;
}

export default function MyJobsScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMyJobs = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            setLoading(false);
            Alert.alert(t('myJobs.notLoggedInTitle'), t('myJobs.notLoggedInMessage'));
            router.replace('/login');
            return;
        }

        setRefreshing(true);
        const { data, error } = await supabase
            .from('jobs')
            .select(`*`)
            .eq('farm_id', session.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching my jobs:', error);
            Alert.alert(t('myJobs.fetchErrorTitle'), t('myJobs.fetchErrorMessage'));
            setJobs([]);
        } else if (data) {
            setJobs(data as Job[]);
        }
        setLoading(false);
        setRefreshing(false);
    }, [t]);

    useFocusEffect(useCallback(() => {
        fetchMyJobs();
    }, [fetchMyJobs]));

    const handleDeleteJob = async (jobId: string) => {
        Alert.alert(
            t('myJobs.deleteConfirmTitle'),
            t('myJobs.deleteConfirmMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        // --- MODIFICATION START: Call refund function first ---
                        const { error: refundError } = await supabase.rpc('refund_job_quota', { job_id_input: jobId });
                        if (refundError) {
                            console.error("Error refunding quota:", refundError);
                            // Decide if you want to stop the deletion or just log the error
                        }

                        // Now delete the job
                        const { error: deleteError } = await supabase.from('jobs').delete().eq('id', jobId);
                        // --- MODIFICATION END ---

                        if (deleteError) {
                            Alert.alert(t('myJobs.deleteErrorTitle'), deleteError.message || t('myJobs.deleteErrorMessage'));
                        } else {
                            Alert.alert(t('myJobs.deleteSuccessTitle'), t('myJobs.deleteSuccessMessage'));
                            fetchMyJobs(); // Refresh the list
                        }
                    },
                },
            ]
        );
    };

    const renderJobItem = ({ item }: { item: Job }) => (
        <View style={styles.jobCard}>
            <View style={styles.jobCardHeader}>
                <Text style={styles.jobCardTitle}>{item.title}</Text>
                <TouchableOpacity
                    onPress={() => handleDeleteJob(item.id)}
                    style={styles.iconButton}
                >
                    <MaterialCommunityIcons name="delete-outline" size={20} color={themeColors.danger} />
                </TouchableOpacity>
            </View>
            <Text style={styles.jobCardLocation}>{item.location} ({item.region}, {item.country})</Text>
            <Text style={styles.jobCardDescription} numberOfLines={2}>{item.description}</Text>
            <View style={styles.jobCardDetailRow}>
                {item.salary_per_hour !== null && <View style={styles.jobCardIconText}><MaterialCommunityIcons name="currency-eur" size={16} color={themeColors.textSecondary} /><Text style={styles.jobCardDetailText}>{item.salary_per_hour}€/hr</Text></View>}
                {item.job_type && item.job_type.length > 0 && <View style={styles.jobCardIconText}><MaterialCommunityIcons name="briefcase-outline" size={16} color={themeColors.textSecondary} /><Text style={styles.jobCardDetailText}>{item.job_type.join(', ')}</Text></View>}
                {item.is_active ? (
                    <View style={styles.activeStatus}><MaterialCommunityIcons name="check-circle" size={16} color="green" /><Text style={styles.activeStatusText}>{t('myJobs.statusActive')}</Text></View>
                ) : (
                    <View style={styles.inactiveStatus}><MaterialCommunityIcons name="close-circle" size={16} color="red" /><Text style={styles.inactiveStatusText}>{t('myJobs.statusInactive')}</Text></View>
                )}
            </View>
            <Text style={styles.createdAtText}>
                {t('myJobs.postedOn')} {new Date(item.created_at).toLocaleDateString()} {t('myJobs.at')} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
        </View>
    );

    if (loading && jobs.length === 0) {
        return <View style={styles.centeredContainer}><ActivityIndicator size="large" color={themeColors.primary} /></View>;
    }

    return (
        <SafeAreaView style={styles.safeAreaContainer} edges={['top', 'left', 'right']}>
            <StatusBar
                barStyle="dark-content"
                translucent
                backgroundColor="transparent"
            />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.text} />
                </TouchableOpacity>
                <Text style={styles.pageTitle}>{t('myJobs.pageTitle')}</Text>
                <View style={styles.placeholderForButton} />
            </View>
            <FlatList
                data={jobs}
                renderItem={renderJobItem}
                keyExtractor={(item) => item.id}
                style={styles.listContainer}
                contentContainerStyle={[
                    styles.listContentContainer,
                    { paddingBottom: styles.listContentContainer.paddingBottom + insets.bottom }
                ]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={fetchMyJobs} tintColor={themeColors.primary} />
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="clipboard-text-off-outline" size={60} color={themeColors.textSecondary} />
                            <Text style={styles.emptyText}>{t('myJobs.noJobsYet')}</Text>
                            <Text style={styles.emptySubText}>{t('myJobs.addJobPrompt')}</Text>
                            <TouchableOpacity style={styles.addJobButton} onPress={() => router.push('/add-job')}>
                                <MaterialCommunityIcons name="plus-box-outline" size={24} color={themeColors.background} />
                                <Text style={styles.addJobButtonText}>{t('myJobs.addJobButton')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
}

// ... (Your existing styles remain the same)
const styles = StyleSheet.create({
    safeAreaContainer: {
        flex: 1,
        backgroundColor: themeColors.surface,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: Platform.OS === 'ios' ? 50 : 60,
        paddingHorizontal: 16,
        backgroundColor: themeColors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: themeColors.border,
    },
    backButton: {
        padding: 8,
    },
    placeholderForButton: {
        width: 40,
    },
    pageTitle: {
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        fontSize: 17,
        fontWeight: 'bold',
        color: themeColors.text,
        textAlign: 'center',
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: themeColors.background,
    },
    listContainer: {
        flex: 1,
        backgroundColor: themeColors.background,
    },
    listContentContainer: {
        paddingTop: 10,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    jobCard: {
        backgroundColor: themeColors.surface,
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        shadowColor: 'rgba(0,0,0,0.1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
        elevation: 3,
    },
    jobCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    jobCardTitle: {
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        fontSize: 18,
        fontWeight: 'bold',
        color: themeColors.text,
        flex: 1,
        marginRight: 10,
    },
    iconButton: {
        padding: 5,
        marginLeft: 5,
    },
    jobCardLocation: {
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        fontSize: 14,
        color: themeColors.textSecondary,
        marginBottom: 5,
    },
    jobCardDescription: {
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        fontSize: 14,
        color: themeColors.text,
        lineHeight: 20,
        marginBottom: 10,
    },
    jobCardDetailRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 5,
        alignItems: 'center',
    },
    jobCardIconText: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
        marginBottom: 5,
    },
    jobCardDetailText: {
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        fontSize: 13,
        color: themeColors.textSecondary,
        marginLeft: 5,
    },
    activeStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderRadius: 5,
        paddingVertical: 3,
        paddingHorizontal: 8,
        marginLeft: 'auto',
    },
    activeStatusText: {
        color: 'green',
        fontSize: 12,
        marginLeft: 5,
        fontWeight: 'bold',
    },
    inactiveStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        borderRadius: 5,
        paddingVertical: 3,
        paddingHorizontal: 8,
        marginLeft: 'auto',
    },
    inactiveStatusText: {
        color: 'red',
        fontSize: 12,
        marginLeft: 5,
        fontWeight: 'bold',
    },
    createdAtText: {
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        fontSize: 11,
        color: themeColors.textSecondary,
        textAlign: 'right',
        marginTop: 5,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        minHeight: 200,
    },
    emptyText: {
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        color: themeColors.text,
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 16,
    },
    emptySubText: {
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        color: themeColors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
    },
    addJobButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themeColors.primary,
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 10,
        marginTop: 10,
    },
    addJobButtonText: {
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        color: themeColors.background,
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
});