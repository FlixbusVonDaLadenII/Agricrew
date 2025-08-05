import { supabase } from './supabase';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export const savePushToken = async (userId: string) => {
    console.log('--- [Push Notifications] Starting savePushToken process... ---');

    // 1. Check if a user ID was provided
    if (!userId) {
        console.error('[Push Notifications] Error: No user ID provided. Cannot save token.');
        return;
    }
    console.log(`[Push Notifications] User ID received: ${userId}`);

    // 2. Check if it's a physical device
    if (!Device.isDevice) {
        console.warn('[Push Notifications] Warning: Not running on a physical device. Push notifications are disabled.');
        return;
    }
    console.log('[Push Notifications] Physical device detected.');

    // 3. Get notification permissions
    console.log('[Push Notifications] Checking notification permissions...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        console.log('[Push Notifications] Permission not granted yet. Requesting permission...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    // 4. Handle permission denial
    if (finalStatus !== 'granted') {
        console.error(`[Push Notifications] Error: Permission not granted. Final status: ${finalStatus}`);
        return;
    }
    console.log('[Push Notifications] Permission granted.');

    try {
        // 5. Get the push token
        console.log('[Push Notifications] Fetching Expo push token...');
        const token = (await Notifications.getExpoPushTokenAsync({
            // You might need to add your projectId here if it's not in app.json
            // projectId: 'your-expo-project-id',
        })).data;
        console.log(`[Push Notifications] Token fetched successfully: ${token}`);

        // 6. Save the token to the database
        if (token) {
            console.log(`[Push Notifications] Attempting to save token to database for user ${userId}...`);
            const { error } = await supabase
                .from('profiles')
                .update({ push_token: token })
                .eq('id', userId);

            if (error) {
                console.error('[Push Notifications] FATAL: Error saving push token to database:', error);
            } else {
                console.log('✅ [Push Notifications] SUCCESS: Token saved to database.');
            }
        }
    } catch (e) {
        console.error('[Push Notifications] FATAL: An unexpected error occurred during the process.', e);
    }
};