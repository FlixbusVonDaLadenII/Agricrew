// app/(tabs)/profile.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { getThemeColors, Theme } from '@/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker'; // Make sure to install: npx expo install expo-image-picker
import { decode } from 'base64-arraybuffer'; // Make sure to install: npm install base64-arraybuffer or yarn add base64-arraybuffer
import { router } from 'expo-router';

// Theme setup (ensure themeColors is available globally or passed down)
const currentTheme: Theme = 'dark'; // Or read from a global context if you have theme switching
const themeColors = getThemeColors(currentTheme);

const baseFontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
});

// Define Profile interface to match your profiles table structure
// IMPORTANT: Adjust these fields to exactly match your `public.profiles` table
interface Profile {
    id: string;
    email?: string; // Often useful, though not directly from profiles table
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    role: 'Arbeitnehmer' | 'Betrieb' | 'Rechnungsschreiber' | null;
    website?: string | null; // Example: Add this column to your profiles table if you want it
    // Add other profile fields here as they exist in your DB
    updated_at?: string; // From the new updated_at column
}

export default function ProfileScreen() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);

    // Profile data states for input fields
    const [profile, setProfile] = useState<Profile | null>(null); // Holds the fetched profile object
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [website, setWebsite] = useState(''); // State for the new 'website' field

    // 1. Request permission for media library access (for image picker)
    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
                }
            }
        })();
    }, []);

    // 2. Function to fetch user profile data
    const fetchProfile = useCallback(async (userId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, username, avatar_url, role, website') // Select all fields you want to display/edit
                .eq('id', userId)
                .single(); // Use single() because there should only be one profile per user ID

            if (error && error.details?.includes('0 rows')) {
                // This can happen if profile not yet created by trigger for some reason (race condition on first login after signup)
                console.warn("Profile not found immediately after login, could be trigger delay or missing data for this user.");
                setProfile(null); // Explicitly set to null if not found
                // In a real app, you might re-fetch after a short delay or guide user to complete profile first
            } else if (error) {
                console.error('Error fetching profile:', error);
                Alert.alert('Error', 'Failed to load profile: ' + error.message);
            } else if (data) {
                setProfile(data as Profile); // Store the full profile object
                // Populate local state for input fields
                setFullName(data.full_name || '');
                setUsername(data.username || '');
                setAvatarUrl(data.avatar_url);
                setWebsite(data.website || '');
            }
        } finally {
            setLoading(false);
        }
    }, []); // Empty dependency array for useCallback, as it only depends on Supabase client

    // 3. Effect to manage session and fetch profile on auth state changes
    useEffect(() => {
        // Initial session check when component mounts
        const checkSession = async () => {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            setSession(currentSession);
            if (currentSession?.user) {
                fetchProfile(currentSession.user.id);
            } else {
                setLoading(false); // No user, stop loading immediately
            }
        };
        checkSession();

        // Listen for auth state changes (e.g., login, logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, currentSession) => {
                setSession(currentSession);
                if (currentSession?.user) {
                    fetchProfile(currentSession.user.id); // Re-fetch profile if user logs in/changes
                } else {
                    setProfile(null); // Clear profile if no user
                    setFullName('');
                    setUsername('');
                    setAvatarUrl(null);
                    setWebsite('');
                    setLoading(false); // No user, stop loading
                }
            }
        );

        return () => subscription?.unsubscribe(); // Clean up subscription on unmount
    }, [fetchProfile]); // Dependency on fetchProfile ensures it's up-to-date

    // 4. Function to handle updating general profile information
    const handleUpdateProfile = async () => {
        if (!session?.user || !profile) {
            Alert.alert('Error', 'No user session or profile data to update.');
            return;
        }

        setSavingProfile(true);
        const updates = {
            id: session.user.id, // User ID is critical for RLS
            full_name: fullName,
            username: username,
            website: website,
            updated_at: new Date().toISOString(), // Update timestamp
        };

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', session.user.id); // Ensure we only update the current user's profile

        setSavingProfile(false);

        if (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Update Failed', error.message);
        } else {
            Alert.alert('Success', 'Profile updated successfully!');
            // Re-fetch profile to ensure UI is in sync with the latest DB state
            fetchProfile(session.user.id);
        }
    };

    // 5. Function to handle profile picture selection and upload
    const handleImagePickAndUpload = async () => {
        if (!session?.user) {
            Alert.alert('Error', 'You must be logged in to upload an avatar.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, // CHANGED THIS LINE
            allowsEditing: true, // Allows user to crop
            aspect: [1, 1], // Square aspect ratio
            quality: 0.7, // Reduce quality for faster upload and smaller size
            base64: true, // Request base64 to upload as arraybuffer to Supabase Storage
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setUploadingAvatar(true);
            const photo = result.assets[0];
            const fileExt = photo.uri.split('.').pop(); // Get file extension (e.g., 'png', 'jpeg')
            const fileName = `${session.user.id}_${Date.now()}.${fileExt}`; // Unique file name
            // Store in user-specific subfolder in the 'avatars' bucket
            // This path MUST align with your Storage RLS policies (e.g., `user_id/image.png`)
            const filePath = `${session.user.id}/${fileName}`;

            try {
                // Upload the image to Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, decode(photo.base64!), { // Decode base64 to ArrayBuffer
                        contentType: photo.mimeType || 'image/jpeg',
                        upsert: true, // Overwrite if a file with the same name already exists
                    });

                if (uploadError) {
                    throw uploadError;
                }

                // Get the public URL of the uploaded image
                const { data: publicUrlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                if (publicUrlData.publicUrl) {
                    // Update the profile table with the new avatar_url
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({ avatar_url: publicUrlData.publicUrl, updated_at: new Date().toISOString() })
                        .eq('id', session.user.id);

                    if (updateError) {
                        throw updateError;
                    }

                    setAvatarUrl(publicUrlData.publicUrl); // Update local state for UI
                    Alert.alert('Success', 'Profile picture updated!');
                } else {
                    throw new Error('Failed to get public URL for the uploaded image.');
                }

            } catch (error: any) {
                console.error('Error uploading/updating avatar:', error.message);
                Alert.alert('Upload Failed', error.message);
            } finally {
                setUploadingAvatar(false);
            }
        }
    };

    // 6. Function to handle user logout
    const handleLogout = async () => {
        setLoading(true); // Indicate loading while logging out
        const { error } = await supabase.auth.signOut();
        setLoading(false);

        if (error) {
            console.error('Error logging out:', error);
            Alert.alert('Logout Failed', error.message);
        } else {
            router.replace('/login'); // Navigate to login page after successful logout
        }
    };

    // --- UI Rendering ---

    // Show loading indicator if data is being fetched
    if (loading) {
        return (
            <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color={themeColors.primary} />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    // If there's no session or profile data, prompt user to log in
    if (!session?.user || !profile) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.pageTitle}>Profile</Text>
                </View>
                <View style={styles.permissionDeniedContainer}>
                    <MaterialCommunityIcons name="account-off-outline" size={80} color={themeColors.textSecondary} />
                    <Text style={styles.permissionDeniedText}>
                        You need to be logged in to view or manage your profile.
                    </Text>
                    <TouchableOpacity style={styles.loginPromptButton} onPress={() => router.replace('/login')}>
                        <Text style={styles.loginPromptButtonText}>Go to Login</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Main Profile Screen UI
    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.pageTitle}>My Profile</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Profile Picture Section */}
                        <View style={styles.avatarContainer}>
                            <TouchableOpacity onPress={handleImagePickAndUpload} disabled={uploadingAvatar}>
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <MaterialCommunityIcons name="camera-plus-outline" size={50} color={themeColors.textSecondary} />
                                        <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
                                    </View>
                                )}
                                {/* Overlay for upload indicator */}
                                {uploadingAvatar && (
                                    <View style={styles.avatarUploadOverlay}>
                                        <ActivityIndicator size="small" color={themeColors.primary} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Profile Info Form */}
                        <View style={styles.profileInfoContainer}>
                            <Text style={styles.inputLabel}>Role:</Text>
                            <Text style={styles.readOnlyText}>{profile.role || 'N/A'}</Text>

                            {profile.role === 'Arbeitnehmer' ? (
                                <>
                                    <Text style={styles.inputLabel}>Username:</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={username}
                                        onChangeText={setUsername}
                                        placeholder="Enter your username"
                                        placeholderTextColor={themeColors.textHint}
                                        autoCapitalize="none"
                                        editable={!savingProfile}
                                    />
                                </>
                            ) : (
                                <>
                                    <Text style={styles.inputLabel}>Full Name / Company Name:</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={fullName}
                                        onChangeText={setFullName}
                                        placeholder="Enter your full name or company name"
                                        placeholderTextColor={themeColors.textHint}
                                        editable={!savingProfile}
                                    />
                                </>
                            )}

                            {/* Example of an additional field you might add to your profiles table */}
                            <Text style={styles.inputLabel}>Website (Optional):</Text>
                            <TextInput
                                style={styles.input}
                                value={website}
                                onChangeText={setWebsite}
                                placeholder="e.g., www.mywebsite.com"
                                placeholderTextColor={themeColors.textHint}
                                autoCapitalize="none"
                                keyboardType="url"
                                editable={!savingProfile}
                            />

                            <TouchableOpacity
                                style={styles.saveButton}
                                onPress={handleUpdateProfile}
                                disabled={savingProfile || uploadingAvatar}
                            >
                                {savingProfile ? (
                                    <ActivityIndicator color={themeColors.background} />
                                ) : (
                                    <Text style={styles.saveButtonText}>Save Changes</Text>
                                )}
                            </TouchableOpacity>

                            {/* Logout Button */}
                            <TouchableOpacity
                                style={styles.logoutButton}
                                onPress={handleLogout}
                                disabled={loading} // Disable if overall loading
                            >
                                {loading ? (
                                    <ActivityIndicator color={themeColors.text} />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="logout" size={20} color={themeColors.text} style={styles.logoutIcon} />
                                        <Text style={styles.logoutButtonText}>Logout</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// --- Stylesheet ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 30 : 0, // Adjust for Android status bar
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
    loginPromptButton: {
        backgroundColor: themeColors.primary,
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 10,
        marginTop: 20,
    },
    loginPromptButtonText: {
        fontFamily: baseFontFamily,
        color: themeColors.background,
        fontSize: 16,
        fontWeight: 'bold',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
    },
    avatarContainer: {
        marginBottom: 30,
        position: 'relative',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: themeColors.surfaceHighlight,
        borderWidth: 3,
        borderColor: themeColors.primary,
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: themeColors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: themeColors.border,
        borderStyle: 'dashed',
    },
    avatarPlaceholderText: {
        fontFamily: baseFontFamily,
        fontSize: 12,
        color: themeColors.textSecondary,
        marginTop: 5,
    },
    avatarUploadOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileInfoContainer: {
        width: '100%',
        backgroundColor: themeColors.surface,
        borderRadius: 15,
        padding: 20,
        shadowColor: themeColors.border,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    inputLabel: {
        fontFamily: baseFontFamily,
        fontSize: 15,
        color: themeColors.textSecondary,
        marginBottom: 8,
        marginTop: 15,
        fontWeight: '500',
    },
    readOnlyText: {
        fontFamily: baseFontFamily,
        fontSize: 16,
        color: themeColors.text,
        backgroundColor: themeColors.surfaceHighlight,
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    input: {
        fontFamily: baseFontFamily,
        width: '100%',
        padding: 15,
        borderRadius: 10,
        backgroundColor: themeColors.surfaceHighlight,
        color: themeColors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    saveButton: {
        backgroundColor: themeColors.primary,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 15,
        shadowColor: themeColors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    saveButtonText: {
        fontFamily: baseFontFamily,
        color: themeColors.background,
        fontSize: 18,
        fontWeight: 'bold',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themeColors.textSecondary,
        paddingVertical: 15,
        borderRadius: 12,
        marginBottom: 20,
        shadowColor: themeColors.border,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 3,
    },
    logoutButtonText: {
        fontFamily: baseFontFamily,
        color: themeColors.background,
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    logoutIcon: {
        marginRight: 5,
    },
});