import { supabase } from './supabase';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// --- Required: Set Notification Handler Globally ---
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true, // Required for iOS 15+
        shouldShowList: true,   // Required for iOS 15+
    }),
});

// --- Helper Function 1: Handle Permissions ---
const getNotificationPermission = async (): Promise<boolean> => {
    console.log('[Push Service] Checking notification permissions...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
        console.log('[Push Service] Permission already granted.');
        return true;
    }

    console.log('[Push Service] Permission not granted yet. Requesting...');
    const { status: finalStatus } = await Notifications.requestPermissionsAsync();

    if (finalStatus !== 'granted') {
        console.error(`[Push Service] Permission denied. Final status: ${finalStatus}`);
        return false;
    }

    console.log('[Push Service] Permission has been granted.');
    return true;
};

// --- Helper Function 2: Fetch the Token ---
const fetchExpoPushToken = async (): Promise<string | null> => {
    if (!Device.isDevice) {
        console.warn('[Push Service] Cannot get token on a simulator or emulator.');
        return null;
    }

    // Get project ID — handles both Expo Go and production builds
    const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.manifest2?.extra?.eas?.projectId;

    if (!projectId) {
        console.error('[Push Service] FATAL: projectId not found in config. Cannot fetch token.');
        return null;
    }

    try {
        console.log(`[Push Service] Using projectId: ${projectId}`);
        console.log('[Push Service] Fetching Expo push token...');
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log(`[Push Service] Token fetched: ${token}`);
        return token;
    } catch (e) {
        console.error('[Push Service] FATAL: Error fetching the token.', e);
        return null;
    }
};

// --- Main Function (Exported) ---
export const savePushToken = async (userId: string) => {
    console.log('--- [Push Service] Starting token registration process... ---');

    // 1. Check for User ID
    if (!userId) {
        console.error('[Push Service] Error: No user ID provided.');
        return;
    }
    console.log(`[Push Service] Registering token for user: ${userId}`);

    // 2. Get Permission
    const hasPermission = await getNotificationPermission();
    if (!hasPermission) {
        return;
    }

    // 3. Get Token
    const token = await fetchExpoPushToken();
    if (!token) {
        return;
    }

    // 4. Save Token to Supabase
    console.log(`[Push Service] Attempting to save token to database for user ${userId}...`);
    const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);

    if (error) {
        console.error('[Push Service] FATAL: Error saving push token to database:', error);
    } else {
        console.log('✅ [Push Service] SUCCESS: Token saved to database.');
    }
};
