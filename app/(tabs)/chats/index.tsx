import React, { useState, useCallback, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { getThemeColors } from '@/theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const themeColors = getThemeColors('dark');

interface Chat {
    chat_id: string;
    other_user_name: string;
    last_message: string;
    last_message_time: string;
}

export default function ChatListScreen() {
    const { t } = useTranslation();
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const fetchChats = useCallback(async () => {
        const { data, error } = await supabase.rpc('get_user_chats');

        if (error) {
            console.error('Error fetching chats:', error);
            Alert.alert("Error", t('chatList.alertError'));
        } else if (data) {
            setChats(data);
        }
        setLoading(false);
    }, [t]);

    useFocusEffect(
        useCallback(() => {
            fetchChats();
        }, [fetchChats])
    );

    useEffect(() => {
        const messageChannel = supabase
            .channel('public:messages:chat_list')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
                () => {
                    fetchChats();
                }
            )
            .subscribe();

        const profileChannel = supabase
            .channel('public:profiles:chat_list')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
                () => {
                    fetchChats();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(messageChannel);
            supabase.removeChannel(profileChannel);
        };
    }, [fetchChats]);

    const renderChatItem = ({ item }: { item: Chat }) => (
        <TouchableOpacity
            style={styles.chatItem}
            onPress={() => router.push({
                pathname: "/(tabs)/chats/[id]",
                params: { id: item.chat_id }
            })}
        >
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.other_user_name ? item.other_user_name.charAt(0).toUpperCase() : '?'}</Text>
            </View>
            <View style={styles.chatContent}>
                <Text style={styles.userName} numberOfLines={1}>{item.other_user_name || 'Unknown User'}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>{item.last_message || 'No messages yet.'}</Text>
            </View>
            {item.last_message_time && (
                <Text style={styles.timestamp}>
                    {new Date(item.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            )}
        </TouchableOpacity>
    );

    if (loading && chats.length === 0) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={themeColors.primary} /></View>;
    }

    if (!loading && chats.length === 0) {
        return (
            <View style={[styles.centered, { paddingTop: insets.top }]}>
                <MaterialCommunityIcons name="message-text-outline" size={60} color={themeColors.textSecondary} />
                <Text style={styles.emptyText}>{t('chatList.emptyTitle')}</Text>
                <Text style={styles.emptySubText}>{t('chatList.emptySubtitle')}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <FlatList
                data={chats}
                renderItem={renderChatItem}
                keyExtractor={(item) => item.chat_id}
                contentContainerStyle={{ paddingTop: 10 }}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={fetchChats} tintColor={themeColors.primary} />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: themeColors.background,
        padding: 20,
    },
    emptyText: {
        color: themeColors.text,
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 16,
    },
    emptySubText: {
        color: themeColors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: themeColors.border,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: themeColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    avatarText: {
        color: themeColors.background,
        fontSize: 20,
        fontWeight: 'bold',
    },
    chatContent: {
        flex: 1,
    },
    userName: {
        color: themeColors.text,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    lastMessage: {
        color: themeColors.textSecondary,
        fontSize: 14,
    },
    timestamp: {
        color: themeColors.textSecondary,
        fontSize: 12,
        alignSelf: 'flex-start',
        marginLeft: 8,
    },
});