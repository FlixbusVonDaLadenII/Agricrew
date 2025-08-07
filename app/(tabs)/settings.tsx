import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView,
    Platform, Alert, Image, ScrollView, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Switch, Modal, StatusBar,
    LayoutAnimation, UIManager // ADDED for animation
} from 'react-native';
import { getThemeColors, Theme } from '@/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

// ADDED: Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);
const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

// ADDED: List of driving licenses
const DRIVING_LICENSES = ['B', 'BE', 'C', 'CE', 'C1', 'C1E', 'T', 'L'];

// MODIFIED: Added driving_licenses to the Profile interface
interface Profile {
    id: string; email?: string; full_name: string | null; username: string | null; avatar_url: string | null;
    role: 'Arbeitnehmer' | 'Betrieb' | 'Rechnungsschreiber' | null;
    website?: string | null; farm_description?: string | null; contact_email?: string | null;
    address_street?: string | null; address_city?: string | null; address_postal_code?: string | null; address_country?: string | null;
    farm_specialization?: string[] | null; farm_size_hectares?: number | null; number_of_employees?: string | null;
    accommodation_offered?: boolean | null; machinery_brands?: string[] | null; updated_at?: string;
    experience?: string[] | null; age?: number | null; availability?: string | null;
    instagram_url?: string | null;
    youtube_url?: string | null;
    facebook_url?: string | null;
    tiktok_url?: string | null;
    driving_licenses?: string[] | null; // ADDED
}

const ORDERED_EXPERIENCE_KEYS = [
    'tillage', 'sowing', 'cropProtection', 'fertilizing', 'slurrySpreading', 'transport', 'combineHarvester', 'forageHarvester', 'beetHarvester', 'potatoHarvester',
    'SEPARATOR_1',
    'animalHusbandry',
    'SEPARATOR_2',
    'harvester', 'forwarder', 'woodChipper', 'woodTransport', 'excavatorWork',
    'SEPARATOR_3',
    'fruitVegetableHarvest', 'viticulture',
    'SEPARATOR_4',
    'fishery',
    'SEPARATOR_5',
    'officeOrganization', 'accounting', 'payroll', 'disposition'
];

export default function ProfileScreen() {
    const { t, i18n } = useTranslation();
    const experienceOptions = t('experiences', { returnObjects: true }) as Record<string, string>;
    const roleDisplayNames = t('roles', { returnObjects: true }) as Record<string, string>;

    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);

    // Form States
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [website, setWebsite] = useState('');
    const [farmDescription, setFarmDescription] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [addressStreet, setAddressStreet] = useState('');
    const [addressCity, setAddressCity] = useState('');
    const [addressPostalCode, setAddressPostalCode] = useState('');
    const [addressCountry, setAddressCountry] = useState('');
    const [farmSpecialization, setFarmSpecialization] = useState('');
    const [farmSize, setFarmSize] = useState('');
    const [employeeCount, setEmployeeCount] = useState('');
    const [accommodationOffered, setAccommodationOffered] = useState(false);
    const [machineryBrands, setMachineryBrands] = useState('');
    const [experience, setExperience] = useState<string[]>([]);
    const [age, setAge] = useState('');
    const [availability, setAvailability] = useState('');
    const [instagramUrl, setInstagramUrl] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [facebookUrl, setFacebookUrl] = useState('');
    const [tiktokUrl, setTiktokUrl] = useState('');
    const [drivingLicenses, setDrivingLicenses] = useState<string[]>([]); // ADDED

    // UI States
    const [isReminderModalVisible, setReminderModalVisible] = useState(false);
    const [isExperienceExpanded, setIsExperienceExpanded] = useState(false); // ADDED

    const fetchProfile = useCallback(async (userId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (error && error.details?.includes('0 rows')) { setProfile(null); }
            else if (error) { throw error; }
            else if (data) {
                setProfile(data as Profile);
                // ... (all other set... calls remain the same)
                setFullName(data.full_name || '');
                setUsername(data.username || '');
                setAvatarUrl(data.avatar_url);
                setWebsite(data.website || '');
                setFarmDescription(data.farm_description || '');
                setContactEmail(data.contact_email || '');
                setAddressStreet(data.address_street || '');
                setAddressCity(data.address_city || '');
                setAddressPostalCode(data.address_postal_code || '');
                setAddressCountry(data.address_country || '');
                setFarmSpecialization(data.farm_specialization?.join(', ') || '');
                setFarmSize(data.farm_size_hectares?.toString() || '');
                setEmployeeCount(data.number_of_employees || '');
                setAccommodationOffered(data.accommodation_offered || false);
                setMachineryBrands(data.machinery_brands?.join(', ') || '');
                setExperience(data.experience || []);
                setAge(data.age?.toString() || '');
                setAvailability(data.availability || '');
                setInstagramUrl(data.instagram_url || '');
                setYoutubeUrl(data.youtube_url || '');
                setFacebookUrl(data.facebook_url || '');
                setTiktokUrl(data.tiktok_url || '');
                setDrivingLicenses(data.driving_licenses || []); // ADDED
            }
        } catch (error: any) {
            Alert.alert(t('common.error'), 'Failed to load profile: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            if (session?.user) { fetchProfile(session.user.id); }
            else { setLoading(false); }
        };
        checkSession();
        const { data: { subscription } = { subscription: null } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) { fetchProfile(session.user.id); }
            else { setProfile(null); }
        });
        return () => subscription?.unsubscribe();
    }, [fetchProfile]);

    useFocusEffect(useCallback(() => {
        const checkProfileCompletion = async () => {
            if (profile && profile.role === 'Betrieb') {
                const snoozeUntil = await AsyncStorage.getItem('@snoozeProfileReminder');
                if (snoozeUntil && new Date(snoozeUntil) > new Date()) return;
                const isIncomplete = !profile.farm_description || !profile.address_street || !profile.farm_specialization?.length;
                if (isIncomplete) setReminderModalVisible(true);
            }
        };
        if (!loading && profile) checkProfileCompletion();
    }, [profile, loading]));

    const handleSnoozeReminder = async () => {
        const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await AsyncStorage.setItem('@snoozeProfileReminder', oneWeekFromNow.toISOString());
        setReminderModalVisible(false);
    };

    const handleUpdateProfile = async () => {
        if (!session?.user || !profile) return;
        setSavingProfile(true);
        const updates: Partial<Profile> = {
            id: session.user.id,
            updated_at: new Date().toISOString(),
        };

        if (profile.role === 'Betrieb') {
            Object.assign(updates, {
                // ... (all other Betrieb properties remain)
                full_name: fullName, website, farm_description: farmDescription, contact_email: contactEmail,
                address_street: addressStreet, address_city: addressCity, address_postal_code: addressPostalCode, address_country: addressCountry,
                farm_specialization: farmSpecialization.split(',').map(s => s.trim()).filter(Boolean),
                farm_size_hectares: farmSize ? parseFloat(farmSize) : null,
                number_of_employees: employeeCount, accommodation_offered: accommodationOffered,
                machinery_brands: machineryBrands.split(',').map(s => s.trim()).filter(Boolean),
                instagram_url: instagramUrl,
                youtube_url: youtubeUrl,
                facebook_url: facebookUrl,
                tiktok_url: tiktokUrl,
            });
        } else { // Arbeitnehmer
            Object.assign(updates, {
                username: username,
                experience: experience,
                age: age ? parseInt(age, 10) : null,
                availability: availability,
                driving_licenses: drivingLicenses, // ADDED
            });
        }

        const { error } = await supabase.from('profiles').update(updates as any).eq('id', session.user.id);
        setSavingProfile(false);
        if (error) Alert.alert(t('common.error'), error.message);
        else Alert.alert(t('profile.success'), t('profile.profileUpdated'));
    };

    const handleToggleExperience = (item: string) => {
        setExperience(prev => prev.includes(item) ? prev.filter(exp => exp !== item) : [...prev, item]);
    };

    // ADDED: Function to toggle driving licenses
    const handleToggleLicense = (license: string) => {
        setDrivingLicenses(prev =>
            prev.includes(license)
                ? prev.filter(l => l !== license)
                : [...prev, license]
        );
    };

    // ADDED: Function to toggle collapsible section
    const toggleExperienceSection = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExperienceExpanded(!isExperienceExpanded);
    };

    const handleImagePickAndUpload = async () => {
        if (!session?.user) return;
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
        });

        if (!result.canceled && result.assets?.[0]) {
            setUploadingAvatar(true);
            const photo = result.assets[0];
            const fileExt = photo.uri.split('.').pop();
            const fileName = `${session.user.id}_${Date.now()}.${fileExt}`;
            const filePath = `${session.user.id}/${fileName}`;
            try {
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, decode(photo.base64!), { contentType: photo.mimeType || 'image/jpeg', upsert: true });
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                if (urlData.publicUrl) {
                    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq('id', session.user.id);
                    if (updateError) throw updateError;
                    setAvatarUrl(urlData.publicUrl);
                    Alert.alert(t('profile.success'), t('profile.pictureUpdated'));
                }
            } catch (error: any) {
                Alert.alert(t('profile.uploadFailed'), error.message);
            } finally {
                setUploadingAvatar(false);
            }
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        await supabase.auth.signOut();
        setLoading(false);
        router.replace('/login');
    };

    const IconTextInput = ({ icon, value, onChangeText, placeholder }: { icon: any, value: string, onChangeText: (text: string) => void, placeholder: string }) => (
        <View style={styles.inputWithIconContainer}>
            <MaterialCommunityIcons name={icon} size={22} color={themeColors.textSecondary} style={styles.inputIcon} />
            <TextInput
                style={styles.inputWithIcon}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={themeColors.textHint}
                autoCapitalize="none"
                keyboardType="url"
                editable={!savingProfile}
            />
        </View>
    );

    if (loading) return <View style={styles.centeredContainer}><ActivityIndicator size="large" color={themeColors.primary} /></View>;

    if (!session?.user || !profile) {
        return (
            <SafeAreaView style={styles.safeAreaContainer}>
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <View style={styles.header}><Text style={styles.pageTitle}>{t('profile.profile')}</Text></View>
                <View style={styles.permissionDeniedContainer}>
                    <MaterialCommunityIcons name="account-off-outline" size={80} color={themeColors.textSecondary} />
                    <Text style={styles.permissionDeniedText}>{t('profile.permissionDenied')}</Text>
                    <TouchableOpacity style={styles.loginPromptButton} onPress={() => router.replace('/login')}><Text style={styles.loginPromptButtonText}>{t('profile.goToLogin')}</Text></TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeAreaContainer}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={styles.header}><Text style={styles.pageTitle}>{t('profile.myProfile')}</Text></View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.avatarContainer}>
                            <TouchableOpacity onPress={handleImagePickAndUpload} disabled={uploadingAvatar}>
                                {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : (<View style={styles.avatarPlaceholder}><MaterialCommunityIcons name="camera-plus-outline" size={50} color={themeColors.textSecondary} /><Text style={styles.avatarPlaceholderText}>{t('common.addPhoto')}</Text></View>)}
                                {uploadingAvatar && <View style={styles.avatarUploadOverlay}><ActivityIndicator size="small" color={themeColors.primary} /></View>}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.profileInfoContainer}>
                            <Text style={styles.sectionTitle}>{t('common.language')}</Text>
                            <View style={styles.langContainer}>
                                <TouchableOpacity style={[styles.langButton, i18n.language === 'en' && styles.langButtonSelected]} onPress={() => i18n.changeLanguage('en')}><Text style={[styles.langButtonText, i18n.language === 'en' && styles.langButtonTextSelected]}>English</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.langButton, i18n.language === 'de' && styles.langButtonSelected]} onPress={() => i18n.changeLanguage('de')}><Text style={[styles.langButtonText, i18n.language === 'de' && styles.langButtonTextSelected]}>Deutsch</Text></TouchableOpacity>
                            </View>

                            <Text style={styles.inputLabel}>{t('profile.role')}</Text>
                            <Text style={styles.readOnlyText}>{ (profile.role && roleDisplayNames[profile.role]) || 'N/A' }</Text>

                            {profile.role === 'Betrieb' ? (
                                <>
                                    {/* ... Betrieb-specific fields remain the same ... */}
                                </>
                            ) : ( // Arbeitnehmer View
                                <>
                                    <Text style={styles.inputLabel}>Username:</Text><TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Enter your username" placeholderTextColor={themeColors.textHint} autoCapitalize="none" editable={!savingProfile} />
                                    <Text style={styles.sectionTitle}>{t('profile.personalDetails')}</Text>
                                    <Text style={styles.inputLabel}>{t('profile.age')}</Text><TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="Your age" placeholderTextColor={themeColors.textHint} keyboardType="number-pad" editable={!savingProfile} />
                                    <Text style={styles.inputLabel}>{t('profile.availability')}</Text><TextInput style={styles.input} value={availability} onChangeText={setAvailability} placeholder="e.g., Immediately, from August 2025" placeholderTextColor={themeColors.textHint} editable={!savingProfile} />

                                    {/* ADDED: Driving License Section */}
                                    <Text style={styles.sectionTitle}>{t('profile.drivingLicenses')}</Text>
                                    <View style={styles.chipsContainer}>
                                        {DRIVING_LICENSES.map((license) => {
                                            const isSelected = drivingLicenses.includes(license);
                                            return (
                                                <TouchableOpacity key={license} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => handleToggleLicense(license)} disabled={savingProfile}>
                                                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{license}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* MODIFIED: Experience section is now collapsible */}
                                    <TouchableOpacity style={styles.collapsibleHeader} onPress={toggleExperienceSection} activeOpacity={0.8}>
                                        <Text style={styles.sectionTitle}>{t('profile.myExperience')}</Text>
                                        <MaterialCommunityIcons name={isExperienceExpanded ? 'chevron-up' : 'chevron-down'} size={26} color={themeColors.text} />
                                    </TouchableOpacity>

                                    {isExperienceExpanded && (
                                        <View style={styles.experienceContainer}>
                                            {ORDERED_EXPERIENCE_KEYS.map((key) => {
                                                if (key.startsWith('SEPARATOR')) {
                                                    return <View key={key} style={styles.experienceSeparator} />;
                                                }
                                                const isSelected = experience.includes(key);
                                                return (
                                                    <TouchableOpacity
                                                        key={key}
                                                        style={styles.experienceRow}
                                                        onPress={() => handleToggleExperience(key)}
                                                        disabled={savingProfile}
                                                    >
                                                        <MaterialCommunityIcons
                                                            name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                                            size={24}
                                                            color={isSelected ? themeColors.primary : themeColors.textSecondary}
                                                        />
                                                        <Text style={styles.experienceText}>{experienceOptions[key]}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    )}
                                </>
                            )}

                            <TouchableOpacity style={styles.saveButton} onPress={handleUpdateProfile} disabled={savingProfile || uploadingAvatar}>{savingProfile ? <ActivityIndicator color={themeColors.background} /> : <Text style={styles.saveButtonText}>{t('profile.saveChanges')}</Text>}</TouchableOpacity>
                            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={loading}>{loading ? <ActivityIndicator color={themeColors.text} /> : <><MaterialCommunityIcons name="logout" size={20} color={themeColors.text} style={styles.logoutIcon} /><Text style={styles.logoutButtonText}>{t('profile.logout')}</Text></>}</TouchableOpacity>
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            {/* ... Modal remains the same ... */}
        </SafeAreaView>
    );
}

// MODIFIED: Styles for collapsible header, license chips
const styles = StyleSheet.create({
    safeAreaContainer: { flex: 1, backgroundColor: themeColors.surface },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: Platform.OS === 'ios' ? 50 : 60, paddingHorizontal: 16, backgroundColor: themeColors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
    pageTitle: { fontFamily: baseFontFamily, fontSize: 17, fontWeight: 'bold', color: themeColors.text },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background },
    permissionDeniedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    permissionDeniedText: { fontFamily: baseFontFamily, fontSize: 18, color: themeColors.textSecondary, textAlign: 'center', marginTop: 20, lineHeight: 24 },
    loginPromptButton: { backgroundColor: themeColors.primary, paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10, marginTop: 20 },
    loginPromptButtonText: { fontFamily: baseFontFamily, color: themeColors.background, fontSize: 16, fontWeight: 'bold' },
    keyboardAvoidingView: { flex: 1 },
    scrollContent: { flexGrow: 1, alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, backgroundColor: themeColors.background, paddingBottom: 20 },
    avatarContainer: { marginBottom: 30, position: 'relative' },
    avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: themeColors.surfaceHighlight, borderWidth: 3, borderColor: themeColors.primary },
    avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: themeColors.surfaceHighlight, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: themeColors.border, borderStyle: 'dashed' },
    avatarPlaceholderText: { fontFamily: baseFontFamily, fontSize: 12, color: themeColors.textSecondary, marginTop: 5 },
    avatarUploadOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
    profileInfoContainer: { width: '100%', backgroundColor: themeColors.surface, borderRadius: 15, padding: 20, shadowColor: themeColors.border, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    inputLabel: { fontFamily: baseFontFamily, fontSize: 15, color: themeColors.textSecondary, marginBottom: 8, marginTop: 15, fontWeight: '500' },
    readOnlyText: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text, backgroundColor: themeColors.surfaceHighlight, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: themeColors.border },
    input: { fontFamily: baseFontFamily, width: '100%', padding: 15, borderRadius: 10, backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, fontSize: 16, borderWidth: 1, borderColor: themeColors.border },
    inputWithIconContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.surfaceHighlight, borderRadius: 10, borderWidth: 1, borderColor: themeColors.border },
    inputIcon: { paddingLeft: 15 },
    inputWithIcon: { flex: 1, fontFamily: baseFontFamily, padding: 15, color: themeColors.text, fontSize: 16, paddingLeft: 10 },
    saveButton: { backgroundColor: themeColors.primary, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 30, marginBottom: 15, shadowColor: themeColors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
    saveButtonText: { fontFamily: baseFontFamily, color: themeColors.background, fontSize: 18, fontWeight: 'bold' },
    logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.surfaceHighlight, paddingVertical: 15, borderRadius: 12, marginBottom: 20 },
    logoutButtonText: { fontFamily: baseFontFamily, color: themeColors.text, fontSize: 18, fontWeight: 'bold' },
    logoutIcon: { color: themeColors.text, marginRight: 8 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: themeColors.text, paddingBottom: 5 },
    textArea: { height: 100, textAlignVertical: 'top', padding: 15 },
    helperText: { fontSize: 12, color: themeColors.textSecondary, marginTop: 4, marginLeft: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    col: { width: '48%' },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingVertical: 10, paddingHorizontal: 5 },
    langContainer: { flexDirection: 'row', marginBottom: 20, backgroundColor: themeColors.surfaceHighlight, borderRadius: 10, padding: 4 },
    langButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    langButtonSelected: { backgroundColor: themeColors.primary },
    langButtonText: { fontFamily: baseFontFamily, color: themeColors.textSecondary, fontWeight: '600' },
    langButtonTextSelected: { color: themeColors.background },
    manageJobsButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.surfaceHighlight, paddingVertical: 15, paddingHorizontal: 20, borderRadius: 12, marginTop: 20, justifyContent: 'center' },
    manageJobsButtonText: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.primary, fontWeight: 'bold', marginLeft: 10 },

    // --- Styles for Driving Licenses & Experiences ---
    collapsibleHeader: { // ADDED
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 25,
        borderBottomWidth: 1,
        borderBottomColor: themeColors.border,
        paddingBottom: 5,
        marginBottom: 10,
    },
    chipsContainer: { // MODIFIED for license chips
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 10,
        marginBottom: 15,
    },
    chip: {
        backgroundColor: themeColors.surfaceHighlight,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: themeColors.border,
        marginRight: 10,
        marginBottom: 10,
    },
    chipSelected: {
        backgroundColor: themeColors.primary,
        borderColor: themeColors.primary,
    },
    chipText: {
        color: themeColors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: themeColors.background,
        fontWeight: 'bold',
    },
    experienceContainer: {
        width: '100%',
        marginTop: 10,
        overflow: 'hidden', // ADDED for smooth animation
    },
    experienceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        backgroundColor: themeColors.surfaceHighlight,
        borderRadius: 10,
        marginBottom: 8,
    },
    experienceText: {
        fontFamily: baseFontFamily,
        color: themeColors.text,
        fontSize: 16,
        marginLeft: 12,
    },
    experienceSeparator: {
        height: 1,
        backgroundColor: themeColors.border,
        marginVertical: 10,
    },
    // Styles for the modal remain unchanged
    centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    reminderModalView: { width: '90%', backgroundColor: themeColors.surface, borderRadius: 20, padding: 25, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    reminderTitle: { fontFamily: baseFontFamily, fontSize: 22, fontWeight: 'bold', color: themeColors.text, marginTop: 15, marginBottom: 10, textAlign: 'center' },
    reminderText: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 25 },
    reminderButtonsContainer: { flexDirection: 'row', width: '100%' },
    reminderButton: { flex: 1, backgroundColor: themeColors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    snoozeButton: { backgroundColor: themeColors.surfaceHighlight, marginRight: 10 },
    reminderButtonText: { fontFamily: baseFontFamily, color: themeColors.background, fontSize: 16, fontWeight: '600' },
    snoozeButtonText: { color: themeColors.text, fontFamily: baseFontFamily, fontSize: 16, fontWeight: '600' },
});