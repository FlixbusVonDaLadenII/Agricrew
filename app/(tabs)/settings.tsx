import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    Platform,
    Alert,
    Image,
    ScrollView,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
    Switch,
    Modal,
    StatusBar,
    LayoutAnimation,
    UIManager,
    FlatList,
    useColorScheme,
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
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
});

const DRIVING_LICENSES = ['B', 'BE', 'C', 'CE', 'C1', 'C1E', 'T', 'L', '95'];
const LOCATIONIQ_API_KEY = process.env.EXPO_PUBLIC_LOCATIONIQ_API_KEY;

interface LocationIQSuggestion {
    place_id: string;
    display_name: string;
    lat: string;
    lon: string;
}

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
    driving_licenses?: string[] | null;
    farm_location_address?: string | null;
    farm_latitude?: number | null;
    farm_longitude?: number | null;
    latitude?: number | null;
    longitude?: number | null;
}

const ORDERED_EXPERIENCE_KEYS = [
    'tillage', 'sowing', 'cropProtection', 'fertilizing', 'slurrySpreading', 'transport', 'combineHarvester', 'forageHarvester', 'beetHarvester', 'potatoHarvester',
    'SEPARATOR_1', 'animalHusbandry', 'SEPARATOR_2', 'harvester', 'forwarder', 'woodChipper', 'woodTransport', 'excavatorWork',
    'SEPARATOR_3', 'fruitVegetableHarvest', 'viticulture', 'SEPARATOR_4', 'fishery', 'SEPARATOR_5',
    'officeOrganization', 'accounting', 'payroll', 'disposition'
];

export default function ProfileScreen() {
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const scheme = useColorScheme();
    const themeColors = useMemo(
        () => getThemeColors((scheme ?? 'light') as Theme),
        [scheme]
    );

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
    const [drivingLicenses, setDrivingLicenses] = useState<string[]>([]);
    const [farmLocationAddress, setFarmLocationAddress] = useState('');
    const [farmLocationCoords, setFarmLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [locationSuggestions, setLocationSuggestions] = useState<LocationIQSuggestion[]>([]);
    const [employeeLocation, setEmployeeLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);

    // UI States
    const [isReminderModalVisible, setReminderModalVisible] = useState(false);
    const [isExperienceExpanded, setIsExperienceExpanded] = useState(false);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (farmLocationAddress.trim().length > 2 && farmLocationCoords === null) {
                fetchLocationSuggestions(farmLocationAddress);
            } else {
                setLocationSuggestions([]);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [farmLocationAddress, i18n.language]);

    const fetchLocationSuggestions = async (query: string) => {
        if (!query || !LOCATIONIQ_API_KEY) return;
        try {
            const response = await fetch(
                `https://api.locationiq.com/v1/autocomplete.php?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(query)}&limit=5&format=json&accept-language=${i18n.language}`
            );
            const data = await response.json();
            if (data && !data.error) setLocationSuggestions(data);
            else setLocationSuggestions([]);
        } catch (error) {
            console.error('Failed to fetch location suggestions:', error);
        }
    };

    const onLocationSuggestionSelect = (suggestion: LocationIQSuggestion) => {
        setFarmLocationAddress(suggestion.display_name);
        setFarmLocationCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
        setLocationSuggestions([]);
        Keyboard.dismiss();
    };

    const fetchProfile = useCallback(
        async (userId: string) => {
            setLoading(true);
            try {
                const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
                if (error && (error as any).details?.includes('0 rows')) {
                    setProfile(null);
                } else if (error) {
                    throw error;
                } else if (data) {
                    setProfile(data as Profile);
                    setFullName(data.full_name || '');
                    setUsername(data.username || '');
                    setAvatarUrl(data.avatar_url);
                    setWebsite(data.website || '');
                    setFarmDescription(data.farm_description || '');
                    setContactEmail(data.contact_email || '');
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
                    setDrivingLicenses(data.driving_licenses || []);
                    setFarmLocationAddress(data.farm_location_address || '');
                    if (data.farm_latitude && data.farm_longitude) {
                        setFarmLocationCoords({ lat: data.farm_latitude, lng: data.farm_longitude });
                    } else {
                        setFarmLocationCoords(null);
                    }
                    if (data.latitude && data.longitude) {
                        setEmployeeLocation({ lat: data.latitude, lng: data.longitude });
                    } else {
                        setEmployeeLocation(null);
                    }
                }
            } catch (error: any) {
                Alert.alert(t('common.error'), 'Failed to load profile: ' + error.message);
            } finally {
                setLoading(false);
            }
        },
        [t]
    );

    useEffect(() => {
        const checkSession = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        };
        checkSession();
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
            }
        });
        return () => subscription?.unsubscribe();
    }, [fetchProfile]);

    useFocusEffect(
        useCallback(() => {
            const checkProfileCompletion = async () => {
                if (profile && profile.role === 'Betrieb') {
                    const snoozeUntil = await AsyncStorage.getItem('@snoozeProfileReminder');
                    if (snoozeUntil && new Date(snoozeUntil) > new Date()) return;
                    const isIncomplete = !profile.farm_description || !profile.farm_specialization?.length;
                    if (isIncomplete) setReminderModalVisible(true);
                }
            };
            if (!loading && profile) checkProfileCompletion();
        }, [profile, loading])
    );

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
                full_name: fullName,
                website,
                farm_description: farmDescription,
                contact_email: contactEmail,
                farm_specialization: farmSpecialization.split(',').map((s) => s.trim()).filter(Boolean),
                farm_size_hectares: farmSize ? parseFloat(farmSize) : null,
                number_of_employees: employeeCount,
                accommodation_offered: accommodationOffered,
                machinery_brands: machineryBrands.split(',').map((s) => s.trim()).filter(Boolean),
                instagram_url: instagramUrl,
                youtube_url: youtubeUrl,
                facebook_url: facebookUrl,
                tiktok_url: tiktokUrl,
                farm_location_address: farmLocationAddress,
                farm_latitude: farmLocationCoords?.lat ?? null,
                farm_longitude: farmLocationCoords?.lng ?? null,
            });
        } else {
            Object.assign(updates, {
                username: username,
                experience: experience,
                age: age ? parseInt(age, 10) : null,
                availability: availability,
                driving_licenses: drivingLicenses,
                latitude: employeeLocation?.lat ?? null,
                longitude: employeeLocation?.lng ?? null,
            });
        }

        const { error } = await supabase.from('profiles').update(updates as any).eq('id', session.user.id);
        setSavingProfile(false);
        if (error) Alert.alert(t('common.error'), error.message);
        else Alert.alert(t('profile.success'), t('profile.profileUpdated'));
    };

    const handleUpdateEmployeeLocation = async () => {
        setIsFetchingLocation(true);
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('profile.locationPermissionDenied'), t('profile.locationPermissionMessage'));
            setIsFetchingLocation(false);
            return;
        }
        try {
            let location = await Location.getCurrentPositionAsync({});
            setEmployeeLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
            Alert.alert(t('profile.locationUpdatedTitle'), t('profile.locationUpdatedMessage'));
        } catch (error) {
            Alert.alert(t('profile.locationErrorTitle'), t('profile.locationErrorMessage'));
        } finally {
            setIsFetchingLocation(false);
        }
    };

    const handleToggleExperience = (item: string) => {
        setExperience((prev) => (prev.includes(item) ? prev.filter((exp) => exp !== item) : [...prev, item]));
    };

    const handleToggleLicense = (license: string) => {
        setDrivingLicenses((prev) => (prev.includes(license) ? prev.filter((l) => l !== license) : [...prev, license]));
    };

    const toggleExperienceSection = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExperienceExpanded(!isExperienceExpanded);
    };

    const handleImagePickAndUpload = async () => {
        if (!session?.user) return;
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets?.[0]) {
            setUploadingAvatar(true);
            const photo = result.assets[0];
            const fileExt = photo.uri.split('.').pop();
            const fileName = `${session.user.id}_${Date.now()}.${fileExt}`;
            const filePath = `${session.user.id}/${fileName}`;
            try {
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, decode(photo.base64!), { contentType: photo.mimeType || 'image/jpeg', upsert: true });
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                if (urlData.publicUrl) {
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
                        .eq('id', session.user.id);
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

    const handleDeleteAccount = () => {
        Alert.alert(t('profile.deleteConfirmTitle'), t('profile.deleteConfirmMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                    setSavingProfile(true);
                    const { error } = await supabase.rpc('delete_user_account');
                    setSavingProfile(false);

                    if (error) {
                        console.error('Error deleting account:', error);
                        Alert.alert(t('profile.deleteErrorTitle'), t('profile.deleteErrorMessage'));
                    } else {
                        Alert.alert(t('profile.deleteSuccessTitle'), t('profile.deleteSuccessMessage'));
                        await supabase.auth.signOut();
                        router.replace('/login');
                    }
                },
            },
        ]);
    };

    const IconTextInput = ({
                               icon,
                               value,
                               onChangeText,
                               placeholder,
                           }: {
        icon: any;
        value: string;
        onChangeText: (text: string) => void;
        placeholder: string;
    }) => (
        <View style={[styles.inputWithIconContainer, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border }]}>
            <MaterialCommunityIcons name={icon} size={22} color={themeColors.textSecondary} style={styles.inputIcon} />
            <TextInput
                style={[styles.inputWithIcon, { color: themeColors.text }]}
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

    if (loading) {
        return (
            <View style={[styles.centeredContainer, { backgroundColor: themeColors.background }]}>
                <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
        );
    }

    if (!session?.user || !profile) {
        return (
            <SafeAreaView style={[styles.safeAreaContainer, { backgroundColor: themeColors.background }]}>
                <StatusBar
                    barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
                    translucent
                    backgroundColor="transparent"
                />
                <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
                    <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t('profile.profile')}</Text>
                </View>
                <View style={styles.permissionDeniedContainer}>
                    <MaterialCommunityIcons name="account-off-outline" size={80} color={themeColors.textSecondary} />
                    <Text style={[styles.permissionDeniedText, { color: themeColors.textSecondary }]}>{t('profile.permissionDenied')}</Text>
                    <TouchableOpacity
                        style={[styles.loginPromptButton, { backgroundColor: themeColors.primary }]}
                        onPress={() => router.replace('/login')}
                    >
                        <Text style={[styles.loginPromptButtonText, { color: themeColors.background }]}>{t('profile.goToLogin')}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.safeAreaContainer, { backgroundColor: themeColors.background }]}>
            <StatusBar
                barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
                translucent
                backgroundColor="transparent"
            />

            <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
                <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t('profile.myProfile')}</Text>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        contentContainerStyle={[
                            styles.scrollContent,
                            { paddingBottom: Math.max(insets.bottom + 24, 32), paddingTop: 20 },
                        ]}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.pageContainer}>
                            <View style={styles.avatarContainer}>
                                <TouchableOpacity onPress={handleImagePickAndUpload} disabled={uploadingAvatar} activeOpacity={0.9}>
                                    {avatarUrl ? (
                                        <Image source={{ uri: avatarUrl }} style={[styles.avatar, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.primary }]} />
                                    ) : (
                                        <View
                                            style={[
                                                styles.avatarPlaceholder,
                                                { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border },
                                            ]}
                                        >
                                            <MaterialCommunityIcons name="camera-plus-outline" size={50} color={themeColors.textSecondary} />
                                            <Text style={[styles.avatarPlaceholderText, { color: themeColors.textSecondary }]}>
                                                {t('common.addPhoto')}
                                            </Text>
                                        </View>
                                    )}
                                    {uploadingAvatar && (
                                        <View style={styles.avatarUploadOverlay}>
                                            <ActivityIndicator size="small" color={themeColors.primary} />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View
                                style={[
                                    styles.profileInfoContainer,
                                    {
                                        backgroundColor: themeColors.surface,
                                        shadowColor: Platform.OS === 'ios' ? '#000' : themeColors.shadow,
                                        borderColor: themeColors.border,
                                    },
                                ]}
                            >
                                <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                    {t('common.language')}
                                </Text>

                                <View style={[styles.langContainer, { backgroundColor: themeColors.surfaceHighlight }]}>
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={[styles.langButton, i18n.language === 'en' && { backgroundColor: themeColors.primary }]}
                                        onPress={() => i18n.changeLanguage('en')}
                                    >
                                        <Text
                                            style={[
                                                styles.langButtonText,
                                                { color: themeColors.textSecondary },
                                                i18n.language === 'en' && { color: themeColors.background },
                                            ]}
                                        >
                                            English
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        style={[styles.langButton, i18n.language === 'de' && { backgroundColor: themeColors.primary }]}
                                        onPress={() => i18n.changeLanguage('de')}
                                    >
                                        <Text
                                            style={[
                                                styles.langButtonText,
                                                { color: themeColors.textSecondary },
                                                i18n.language === 'de' && { color: themeColors.background },
                                            ]}
                                        >
                                            Deutsch
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.role')}</Text>
                                <Text
                                    style={[
                                        styles.readOnlyText,
                                        { color: themeColors.text, backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border },
                                    ]}
                                >
                                    {(profile.role && roleDisplayNames[profile.role]) || 'N/A'}
                                </Text>

                                {profile.role === 'Betrieb' ? (
                                    <>
                                        <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                            {t('profile.companyDetails')}
                                        </Text>

                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.companyName')}</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                            value={fullName}
                                            onChangeText={setFullName}
                                            placeholder={t('profile.companyName')}
                                            placeholderTextColor={themeColors.textHint}
                                            editable={!savingProfile}
                                        />

                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.aboutFarm')}</Text>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                styles.textArea,
                                                { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border },
                                            ]}
                                            value={farmDescription}
                                            onChangeText={setFarmDescription}
                                            placeholder={t('profile.aboutFarmPlaceholder')}
                                            placeholderTextColor={themeColors.textHint}
                                            multiline
                                            editable={!savingProfile}
                                        />

                                        <View style={styles.row}>
                                            <View style={styles.col}>
                                                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.farmSize')}</Text>
                                                <TextInput
                                                    style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                                    value={farmSize}
                                                    onChangeText={setFarmSize}
                                                    placeholder="e.g., 150"
                                                    placeholderTextColor={themeColors.textHint}
                                                    keyboardType="numeric"
                                                    editable={!savingProfile}
                                                />
                                            </View>
                                            <View style={styles.col}>
                                                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.employeeCount')}</Text>
                                                <TextInput
                                                    style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                                    value={employeeCount}
                                                    onChangeText={setEmployeeCount}
                                                    placeholder="e.g., 6-20"
                                                    placeholderTextColor={themeColors.textHint}
                                                    editable={!savingProfile}
                                                />
                                            </View>
                                        </View>

                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.specialization')}</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                            value={farmSpecialization}
                                            onChangeText={setFarmSpecialization}
                                            placeholder={t('profile.specializationPlaceholder')}
                                            placeholderTextColor={themeColors.textHint}
                                            editable={!savingProfile}
                                        />
                                        <Text style={[styles.helperText, { color: themeColors.textSecondary }]}>{t('common.separateWithCommas')}</Text>

                                        <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                            {t('profile.equipmentAndBenefits')}
                                        </Text>

                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.machinery')}</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                            value={machineryBrands}
                                            onChangeText={setMachineryBrands}
                                            placeholder={t('profile.machineryPlaceholder')}
                                            placeholderTextColor={themeColors.textHint}
                                            editable={!savingProfile}
                                        />
                                        <Text style={[styles.helperText, { color: themeColors.textSecondary }]}>{t('common.separateWithCommas')}</Text>

                                        <View style={[styles.switchContainer, { borderColor: themeColors.separator }]}>
                                            <Text style={[styles.inputLabel, { marginTop: 0, color: themeColors.textSecondary }]}>{t('profile.accommodation')}</Text>
                                            <Switch
                                                trackColor={{ false: themeColors.surfaceHighlight, true: themeColors.primary + '80' }}
                                                thumbColor={accommodationOffered ? themeColors.primary : themeColors.textSecondary}
                                                onValueChange={setAccommodationOffered}
                                                value={accommodationOffered}
                                                disabled={savingProfile}
                                            />
                                        </View>

                                        <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                            {t('profile.contactInfo')}
                                        </Text>

                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.publicEmail')}</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                            value={contactEmail}
                                            onChangeText={setContactEmail}
                                            placeholder="info@myfarm.com"
                                            placeholderTextColor={themeColors.textHint}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            editable={!savingProfile}
                                        />

                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.website')}</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                            value={website}
                                            onChangeText={setWebsite}
                                            placeholder="www.myfarm.com"
                                            placeholderTextColor={themeColors.textHint}
                                            autoCapitalize="none"
                                            keyboardType="url"
                                            editable={!savingProfile}
                                        />

                                        <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                            {t('profile.mainFarmLocation')}
                                        </Text>

                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.locationAddress')}</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                            placeholder={t('addJob.placeholderExactLocation')}
                                            placeholderTextColor={themeColors.textHint}
                                            value={farmLocationAddress}
                                            onChangeText={(text) => {
                                                setFarmLocationAddress(text);
                                                setFarmLocationCoords(null);
                                            }}
                                            editable={!savingProfile}
                                        />

                                        {locationSuggestions.length > 0 && (
                                            <FlatList
                                                data={locationSuggestions}
                                                keyExtractor={(item) => item.place_id}
                                                scrollEnabled={false}
                                                style={[
                                                    styles.suggestionsList,
                                                    { backgroundColor: themeColors.surface, borderColor: themeColors.border, zIndex: 5, elevation: 5 },
                                                ]}
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity onPress={() => onLocationSuggestionSelect(item)} style={styles.suggestionItem}>
                                                        <Text style={[styles.suggestionText, { color: themeColors.text }]}>{item.display_name}</Text>
                                                    </TouchableOpacity>
                                                )}
                                            />
                                        )}

                                        <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                            {t('profile.socialMedia')}
                                        </Text>
                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.instagram')}</Text>
                                        <IconTextInput icon="instagram" value={instagramUrl} onChangeText={setInstagramUrl} placeholder="e.g., instagram.com/myfarm" />
                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.youtube')}</Text>
                                        <IconTextInput icon="youtube" value={youtubeUrl} onChangeText={setYoutubeUrl} placeholder="e.g., youtube.com/myfarm" />
                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.facebook')}</Text>
                                        <IconTextInput icon="facebook" value={facebookUrl} onChangeText={setFacebookUrl} placeholder="e.g., facebook.com/myfarm" />
                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.tiktok')}</Text>
                                        <IconTextInput icon="tiktok" value={tiktokUrl} onChangeText={setTiktokUrl} placeholder="e.g., tiktok.com/@myfarm" />

                                        <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                            {t('profile.jobManagement')}
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.manageJobsButton, { backgroundColor: themeColors.surfaceHighlight }]}
                                            onPress={() => router.push('/my-jobs')}
                                            activeOpacity={0.9}
                                        >
                                            <MaterialCommunityIcons name="briefcase-edit-outline" size={22} color={themeColors.primary} />
                                            <Text style={[styles.manageJobsButtonText, { color: themeColors.primary }]}>{t('profile.myJobPostings')}</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Username:</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                            value={username}
                                            onChangeText={setUsername}
                                            placeholder="Enter your username"
                                            placeholderTextColor={themeColors.textHint}
                                            autoCapitalize="none"
                                            editable={!savingProfile}
                                        />

                                        <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                            {t('profile.myLocation')}
                                        </Text>
                                        <Text style={[styles.helperText, { color: themeColors.textSecondary }]}>{t('profile.locationHelper')}</Text>

                                        <TouchableOpacity
                                            style={[styles.manageJobsButton, { backgroundColor: themeColors.surfaceHighlight }]}
                                            onPress={handleUpdateEmployeeLocation}
                                            disabled={isFetchingLocation}
                                            activeOpacity={0.9}
                                        >
                                            {isFetchingLocation ? (
                                                <ActivityIndicator color={themeColors.primary} />
                                            ) : (
                                                <>
                                                    <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={themeColors.primary} />
                                                    <Text style={[styles.manageJobsButtonText, { color: themeColors.primary }]}>
                                                        {employeeLocation ? t('profile.updateLocation') : t('profile.setLocation')}
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                        {employeeLocation && (
                                            <Text style={[styles.locationSetText, { color: themeColors.success }]}>{t('profile.locationSet')}</Text>
                                        )}

                                        <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                            {t('profile.personalDetails')}
                                        </Text>
                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.age')}</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                            value={age}
                                            onChangeText={setAge}
                                            placeholder="Your age"
                                            placeholderTextColor={themeColors.textHint}
                                            keyboardType="number-pad"
                                            editable={!savingProfile}
                                        />
                                        <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{t('profile.availability')}</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: themeColors.surfaceHighlight, color: themeColors.text, borderColor: themeColors.border }]}
                                            value={availability}
                                            onChangeText={setAvailability}
                                            placeholder="e.g., Immediately, from August 2025"
                                            placeholderTextColor={themeColors.textHint}
                                            editable={!savingProfile}
                                        />

                                        <Text style={[styles.sectionTitle, { color: themeColors.text, borderBottomColor: themeColors.border }]}>
                                            {t('profile.drivingLicenses')}
                                        </Text>
                                        <View style={styles.chipsContainer}>
                                            {DRIVING_LICENSES.map((license) => {
                                                const isSelected = drivingLicenses.includes(license);
                                                return (
                                                    <TouchableOpacity
                                                        key={license}
                                                        style={[
                                                            styles.chip,
                                                            { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border },
                                                            isSelected && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
                                                        ]}
                                                        onPress={() => handleToggleLicense(license)}
                                                        disabled={savingProfile}
                                                        activeOpacity={0.85}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.chipText,
                                                                { color: themeColors.text },
                                                                isSelected && { color: themeColors.background, fontWeight: '700' },
                                                            ]}
                                                        >
                                                            {license}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>

                                        <TouchableOpacity style={styles.collapsibleHeader} onPress={toggleExperienceSection} activeOpacity={0.85}>
                                            <Text style={[styles.sectionTitleText, { color: themeColors.text }]}>{t('profile.myExperience')}</Text>
                                            <MaterialCommunityIcons
                                                name={isExperienceExpanded ? 'chevron-up' : 'chevron-down'}
                                                size={24}
                                                color={themeColors.text}
                                            />
                                        </TouchableOpacity>

                                        {isExperienceExpanded && (
                                            <View style={styles.experienceContainer}>
                                                {ORDERED_EXPERIENCE_KEYS.map((key) => {
                                                    if (key.startsWith('SEPARATOR')) {
                                                        return <View key={key} style={[styles.experienceSeparator, { backgroundColor: themeColors.border }]} />;
                                                    }
                                                    const isSelected = experience.includes(key);
                                                    return (
                                                        <TouchableOpacity
                                                            key={key}
                                                            style={[styles.experienceRow, { backgroundColor: themeColors.surfaceHighlight }]}
                                                            onPress={() => handleToggleExperience(key)}
                                                            disabled={savingProfile}
                                                            activeOpacity={0.85}
                                                        >
                                                            <MaterialCommunityIcons
                                                                name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                                                                size={22}
                                                                color={isSelected ? themeColors.primary : themeColors.textSecondary}
                                                            />
                                                            <Text style={[styles.experienceText, { color: themeColors.text }]}>{experienceOptions[key]}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </>
                                )}

                                <TouchableOpacity
                                    style={[
                                        styles.saveButton,
                                        { backgroundColor: themeColors.primary, shadowColor: themeColors.primaryDark },
                                    ]}
                                    onPress={handleUpdateProfile}
                                    disabled={savingProfile || uploadingAvatar}
                                    activeOpacity={0.9}
                                >
                                    {savingProfile ? (
                                        <ActivityIndicator color={themeColors.background} />
                                    ) : (
                                        <Text style={[styles.saveButtonText, { color: themeColors.background }]}>{t('profile.saveChanges')}</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.logoutButton, { backgroundColor: themeColors.surfaceHighlight }]}
                                    onPress={handleLogout}
                                    disabled={loading}
                                    activeOpacity={0.9}
                                >
                                    {loading ? (
                                        <ActivityIndicator color={themeColors.text} />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="logout" size={18} color={themeColors.text} style={styles.logoutIcon} />
                                            <Text style={[styles.logoutButtonText, { color: themeColors.text }]}>{t('profile.logout')}</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <View style={[styles.dangerZoneContainer, { borderTopColor: themeColors.border }]}>
                                    <TouchableOpacity
                                        style={[
                                            styles.deleteButton,
                                            { backgroundColor: themeColors.danger + '20', borderColor: themeColors.danger },
                                        ]}
                                        onPress={handleDeleteAccount}
                                        disabled={savingProfile}
                                        activeOpacity={0.9}
                                    >
                                        <MaterialCommunityIcons name="alert-octagon-outline" size={18} color={themeColors.danger} style={styles.deleteIcon} />
                                        <Text style={[styles.deleteButtonText, { color: themeColors.danger }]}>{t('profile.deleteAccount')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            <Modal
                transparent
                animationType="fade"
                visible={isReminderModalVisible}
                onRequestClose={() => setReminderModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.reminderModalView, { backgroundColor: themeColors.surface }]}>
                        <MaterialCommunityIcons name="clipboard-text-search-outline" size={50} color={themeColors.primary} />
                        <Text style={[styles.reminderTitle, { color: themeColors.text }]}>{t('profile.reminderTitle')}</Text>
                        <Text style={[styles.reminderText, { color: themeColors.textSecondary }]}>{t('profile.reminderText')}</Text>
                        <View style={styles.reminderButtonsContainer}>
                            <TouchableOpacity
                                style={[styles.reminderButton, styles.snoozeButton, { backgroundColor: themeColors.surfaceHighlight }]}
                                onPress={handleSnoozeReminder}
                                activeOpacity={0.9}
                            >
                                <Text style={[styles.snoozeButtonText, { color: themeColors.text }]}>{t('profile.remindMeLater')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.reminderButton, { backgroundColor: themeColors.primary }]}
                                onPress={() => setReminderModalVisible(false)}
                                activeOpacity={0.9}
                            >
                                <Text style={[styles.reminderButtonText, { color: themeColors.background }]}>{t('profile.illDoIt')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const SPACING = { xs: 6, sm: 10, md: 16, lg: 20, xl: 28 };

const styles = StyleSheet.create({
    safeAreaContainer: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: Platform.OS === 'ios' ? 50 : 60,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pageTitle: { fontFamily: baseFontFamily, fontSize: 17, fontWeight: '700' },

    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    permissionDeniedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    permissionDeniedText: { fontFamily: baseFontFamily, fontSize: 18, textAlign: 'center', marginTop: 20, lineHeight: 24 },
    loginPromptButton: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12, marginTop: 20 },
    loginPromptButtonText: { fontFamily: baseFontFamily, fontSize: 16, fontWeight: '700' },

    keyboardAvoidingView: { flex: 1 },
    scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 16 },
    pageContainer: {
        width: '100%',
        maxWidth: 960,
        alignSelf: 'center',
    },

    avatarContainer: { marginBottom: 18, alignItems: 'center', position: 'relative' },
    avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3 },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    avatarPlaceholderText: { fontFamily: baseFontFamily, fontSize: 12, marginTop: 6 },
    avatarUploadOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 60, justifyContent: 'center', alignItems: 'center',
    },

    profileInfoContainer: {
        width: '100%',
        borderRadius: 16,
        padding: SPACING.lg,
        borderWidth: StyleSheet.hairlineWidth,
        ...Platform.select({
            ios: { shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
            android: { elevation: 2 },
            default: {},
        }),
    },

    inputLabel: { fontFamily: baseFontFamily, fontSize: 14, marginBottom: 8, marginTop: 14, fontWeight: '600' },
    readOnlyText: { fontFamily: baseFontFamily, fontSize: 16, padding: 14, borderRadius: 10, borderWidth: 1 },

    input: {
        fontFamily: baseFontFamily,
        width: '100%',
        padding: 14,
        borderRadius: 10,
        fontSize: 16,
        borderWidth: 1,
        marginBottom: SPACING.md,
    },

    inputWithIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: SPACING.md,
    },
    inputIcon: { paddingLeft: 12 },
    inputWithIcon: { flex: 1, fontFamily: baseFontFamily, padding: 14, fontSize: 16, paddingLeft: 10 },

    saveButton: {
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: SPACING.lg,
        marginBottom: SPACING.sm,
        ...Platform.select({
            ios: { shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
            android: { elevation: 3 },
            default: {},
        }),
    },
    saveButtonText: { fontFamily: baseFontFamily, fontSize: 18, fontWeight: '800' },

    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: SPACING.md,
    },
    logoutButtonText: { fontFamily: baseFontFamily, fontSize: 16, fontWeight: '700' },
    logoutIcon: { marginRight: 8 },

    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginTop: SPACING.lg,
        marginBottom: 8,
        paddingBottom: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectionTitleText: { fontSize: 18, fontWeight: '800' },

    textArea: { minHeight: 100, textAlignVertical: 'top', lineHeight: 20 },

    helperText: { fontSize: 12, marginTop: 4, marginLeft: 2 },

    row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
    col: { flex: 1 },

    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.md,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },

    langContainer: { flexDirection: 'row', borderRadius: 10, padding: 4, gap: 6 },
    langButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    langButtonText: { fontFamily: baseFontFamily, fontWeight: '700' },

    manageJobsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginTop: 10,
        justifyContent: 'center',
        gap: 10,
    },
    manageJobsButtonText: { fontFamily: baseFontFamily, fontSize: 15, fontWeight: '700' },

    collapsibleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.lg,
        paddingBottom: 6,
        marginBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },

    chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginBottom: 5, gap: 10 },
    chip: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 999,
        borderWidth: 1,
    },
    chipText: { fontSize: 15, fontWeight: '600' },

    experienceContainer: { width: '100%', marginTop: 10 },
    experienceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 10,
        marginBottom: 8,
        gap: 10,
    },
    experienceText: { fontFamily: baseFontFamily, fontSize: 16 },

    experienceSeparator: { height: 1, marginVertical: 10 },

    centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    reminderModalView: {
        width: '90%',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
    },
    reminderTitle: { fontFamily: baseFontFamily, fontSize: 20, fontWeight: '800', marginTop: 12, marginBottom: 6, textAlign: 'center' },
    reminderText: { fontFamily: baseFontFamily, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 18 },
    reminderButtonsContainer: { flexDirection: 'row', width: '100%', gap: 10 },
    reminderButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    snoozeButton: { marginRight: 0 },
    reminderButtonText: { fontFamily: baseFontFamily, fontSize: 16, fontWeight: '700' },
    snoozeButtonText: { fontFamily: baseFontFamily, fontSize: 16, fontWeight: '700' },

    suggestionsList: {
        maxHeight: 220,
        borderRadius: 10,
        borderWidth: 1,
        marginTop: -6,
        marginBottom: 10,
    },
    suggestionItem: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
    suggestionText: { fontSize: 16 },

    locationSetText: { fontFamily: baseFontFamily, fontSize: 12, textAlign: 'center', marginTop: 8 },

    dangerZoneContainer: { marginTop: 26, borderTopWidth: 1, paddingTop: 16 },
    deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
    deleteButtonText: { fontFamily: baseFontFamily, fontSize: 15, fontWeight: '800' },
    deleteIcon: { marginRight: 8 },
});