import { supabase } from '@/lib/supabase';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// This handler determines how notifications are shown when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        // FIX: Add the two missing properties to resolve the TypeScript error.
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (!Device.isDevice) {
        // Push notifications don't work on simulators
        console.log('Push notifications are not supported on simulators.');
        return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        // User did not grant permission
        console.log('User did not grant notification permissions.');
        return null;
    }

    // Get the Expo Push Token
    try {
        const pushToken = await Notifications.getExpoPushTokenAsync({
            projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        });
        token = pushToken.data;
    } catch (e) {
        console.error("Failed to get push token", e);
        return null;
    }

    return token;
}


export async function savePushToken(userId: string) {
    const token = await registerForPushNotificationsAsync();

    if (token) {
        // Save the new token to the user's profile
        const { error } = await supabase
            .from('profiles')
            .update({ push_token: token })
            .eq('id', userId);

        if (error) {
            console.error('Failed to save push token:', error.message);
        } else {
            console.log('Push token saved successfully for user:', userId);
        }
    }
}