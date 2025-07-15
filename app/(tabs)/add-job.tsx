// app/(tabs)/add-job.tsx
import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    Platform,
    Switch, // For active toggle
} from 'react-native';
import { getThemeColors, Theme } from '@/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase'; // Your Supabase client
import { Session } from '@supabase/supabase-js'; // For session type

const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);

const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
});

// Common German driving licenses (can be extended)
const DRIVING_LICENSES = ['B', 'BE', 'C', 'CE', 'C1', 'C1E', 'T', 'L'];
const JOB_TYPES = ['Full-time', 'Part-time', 'Seasonal', 'Project-based', 'Internship']; // Common job types

export default function AddJobScreen() {
    const [session, setSession] = useState<Session | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [salaryPerHour, setSalaryPerHour] = useState(''); // Keep as string for TextInput
    const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
    const [jobType, setJobType] = useState<string | null>(null); // For dropdown/picker later
    const [isActive, setIsActive] = useState(true); // Default to active

    useEffect(() => {
        // Fetch session and user role
        const fetchUserAndRole = async () => {
            setLoadingUser(true);
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            setSession(currentSession);

            if (currentSession?.user) {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', currentSession.user.id)
                    .single();

                if (error) {
                    console.error('Error fetching user role:', error);
                    Alert.alert('Error', 'Failed to fetch user role.');
                } else if (profile) {
                    setUserRole(profile.role);
                }
            }
            setLoadingUser(false);
        };

        fetchUserAndRole();

        // Listen for auth state changes in case user logs in/out while on this page
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, currentSession) => {
                setSession(currentSession);
                if (currentSession?.user) {
                    // Re-fetch role if session changes (e.g. user logs in)
                    fetchUserAndRole();
                } else {
                    setUserRole(null);
                }
            }
        );

        return () => subscription?.unsubscribe();
    }, []);

    const toggleLicense = (license: string) => {
        setSelectedLicenses(prev =>
            prev.includes(license)
                ? prev.filter(l => l !== license)
                : [...prev, license]
        );
    };

    const handleAddJob = async () => {
        if (!session?.user) {
            Alert.alert('Authentication Error', 'You must be logged in to add a job.');
            return;
        }
        if (userRole !== 'Betrieb') {
            Alert.alert('Permission Denied', 'Only farms (Betrieb) can add job listings.');
            return;
        }
        if (!title || !description || !location) {
            Alert.alert('Missing Fields', 'Please fill in all required fields (Title, Description, Location).');
            return;
        }

        setSubmitting(true);
        const salary = salaryPerHour ? parseFloat(salaryPerHour) : null;
        if (salaryPerHour && isNaN(salary!)) {
            Alert.alert('Invalid Salary', 'Please enter a valid number for salary.');
            setSubmitting(false);
            return;
        }

        const { error } = await supabase
            .from('jobs')
            .insert({
                title,
                description,
                location,
                salary_per_hour: salary,
                required_licenses: selectedLicenses,
                job_type: jobType,
                is_active: isActive,
                farm_id: session.user.id, // Set farm_id to the current user's ID
            });

        setSubmitting(false);

        if (error) {
            console.error('Error adding job:', error);
            Alert.alert('Submission Failed', error.message || 'Could not add job. Please try again.');
        } else {
            Alert.alert('Success', 'Job added successfully!');
            // Clear form after successful submission
            setTitle('');
            setDescription('');
            setLocation('');
            setSalaryPerHour('');
            setSelectedLicenses([]);
            setJobType(null);
            setIsActive(true); // Reset to default active state
        }
    };

    // Render logic based on user's role and loading state
    if (loadingUser) {
        return (
            <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color={themeColors.primary} />
                <Text style={styles.loadingText}>Loading user data...</Text>
            </View>
        );
    }

    if (userRole !== 'Betrieb') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.pageTitle}>Add New Job</Text>
                </View>
                <View style={styles.permissionDeniedContainer}>
                    <MaterialCommunityIcons name="lock-alert-outline" size={80} color={themeColors.textSecondary} />
                    <Text style={styles.permissionDeniedText}>
                        You do not have permission to add job listings. This feature is for farms (Betrieb) only.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // Render the form for 'Betrieb' users
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.pageTitle}>Add New Job</Text>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Job Title <Text style={styles.requiredIndicator}>*</Text></Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g., Erntehelfer (m/w/d)"
                    placeholderTextColor={themeColors.textHint}
                    value={title}
                    onChangeText={setTitle}
                />

                <Text style={styles.label}>Description <Text style={styles.requiredIndicator}>*</Text></Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Detailed description of job tasks..."
                    placeholderTextColor={themeColors.textHint}
                    multiline
                    numberOfLines={4}
                    value={description}
                    onChangeText={setDescription}
                />

                <Text style={styles.label}>Location <Text style={styles.requiredIndicator}>*</Text></Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g., Hamburg, Landkreis Nord"
                    placeholderTextColor={themeColors.textHint}
                    value={location}
                    onChangeText={setLocation}
                />

                <Text style={styles.label}>Salary per Hour (€) (Optional)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g., 15.50"
                    placeholderTextColor={themeColors.textHint}
                    keyboardType="numeric"
                    value={salaryPerHour}
                    onChangeText={setSalaryPerHour}
                />

                {/* Driving Licenses */}
                <Text style={styles.label}>Required Driving Licenses (Optional)</Text>
                <View style={styles.licensesContainer}>
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
                </View>

                {/* Job Type Picker (simple for now, can be sophisticated later) */}
                <Text style={styles.label}>Job Type (Optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobTypeScroll}>
                    {JOB_TYPES.map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.jobTypeButton,
                                jobType === type && styles.jobTypeButtonSelected
                            ]}
                            onPress={() => setJobType(jobType === type ? null : type)} // Toggle selection
                        >
                            <Text style={[styles.jobTypeText, jobType === type && styles.jobTypeTextSelected]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>


                {/* Is Active Toggle */}
                <View style={styles.toggleRow}>
                    <Text style={styles.label}>Job Active?</Text>
                    <Switch
                        trackColor={{ false: themeColors.textSecondary, true: themeColors.primaryLight }}
                        thumbColor={isActive ? themeColors.primary : themeColors.surfaceHighlight}
                        ios_backgroundColor={themeColors.textSecondary}
                        onValueChange={setIsActive}
                        value={isActive}
                    />
                </View>


                <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleAddJob}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color={themeColors.background} />
                    ) : (
                        <Text style={styles.submitButtonText}>Add Job</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
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
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: themeColors.background,
    },
    loadingText: {
        fontFamily: baseFontFamily,
        color: themeColors.textSecondary,
        marginTop: 10,
        fontSize: 16,
    },
    permissionDeniedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        textAlign: 'center',
    },
    permissionDeniedText: {
        fontFamily: baseFontFamily,
        fontSize: 18,
        color: themeColors.textSecondary,
        textAlign: 'center',
        marginTop: 20,
        lineHeight: 24,
    },
    formContainer: {
        padding: 20,
        paddingBottom: 50, // Extra padding for scroll
    },
    label: {
        fontFamily: baseFontFamily,
        fontSize: 16,
        color: themeColors.text,
        marginBottom: 8,
        marginTop: 15,
        fontWeight: '500',
    },
    requiredIndicator: {
        color: themeColors.danger,
        fontWeight: 'bold',
        fontSize: 18,
    },
    input: {
        fontFamily: baseFontFamily,
        backgroundColor: themeColors.surfaceHighlight,
        color: themeColors.text,
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top', // For Android
        paddingTop: 12, // For iOS to align text at top
    },
    licensesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
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
    jobTypeScroll: {
        paddingVertical: 5,
    },
    jobTypeButton: {
        backgroundColor: themeColors.surfaceHighlight,
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        marginRight: 10,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    jobTypeButtonSelected: {
        borderColor: themeColors.primary,
        backgroundColor: themeColors.primaryLight + '20',
    },
    jobTypeText: {
        fontFamily: baseFontFamily,
        color: themeColors.text,
        fontSize: 14,
    },
    jobTypeTextSelected: {
        color: themeColors.primary,
        fontWeight: 'bold',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 20,
        marginBottom: 10,
        paddingVertical: 5,
    },
    submitButton: {
        backgroundColor: themeColors.primary,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 20, // Give some space at the bottom
        shadowColor: themeColors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    submitButtonText: {
        fontFamily: baseFontFamily,
        color: themeColors.background,
        fontSize: 18,
        fontWeight: 'bold',
    },
});