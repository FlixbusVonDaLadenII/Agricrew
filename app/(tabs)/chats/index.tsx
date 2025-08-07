import React, { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Image,
    TextInput,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter, useNavigation } from 'expo-router';
import { getThemeColors } from '@/theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useUnreadChats } from '@/contexts/UnreadChatContext';

const themeColors = getThemeColors('dark');

interface Chat {
    chat_id: string;
    other_user_name: string;
    last_message: string;
    last_message_time: string;
    other_user_avatar_url: string | null;
}

export default function ChatListScreen() {
    const { t } = useTranslation();
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { unreadChats } = useUnreadChats();
    const navigation = useNavigation();

    const [searchText, setSearchText] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    const fetchChats = useCallback(async () => {
        const { data, error } = await supabase.rpc('get_user_chats');
        if (error) {
            console.error('Error fetching chats:', error);
            Alert.alert(t('common.error'), t('chatList.fetchError'));
        } else if (data) {
            setChats(data);
        }
        setLoading(false);
    }, [t]);

    const handleDeleteChat = async (chatIdToDelete: string) => {
        Alert.alert(
            t('chatList.deleteTitle'),
            t('chatList.deleteMessage'),
            [
                { text: t('common.cancel'), style: "cancel" },
                {
                    text: t('common.delete'),
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await supabase.rpc('delete_chat', { chat_id_to_delete: chatIdToDelete });
                        if (error) {
                            Alert.alert(t('common.error'), t('chatList.deleteError'));
                            console.error("Delete error:", error);
                        } else {
                            setChats(currentChats => currentChats.filter(c => c.chat_id !== chatIdToDelete));
                        }
                    },
                },
            ]
        );
    };

    useFocusEffect(
        useCallback(() => {
            fetchChats();
        }, [fetchChats])
    );

    useEffect(() => {
        const messageChannel = supabase
            .channel('public:messages:chat_list')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchChats)
            .subscribe();
        const profileChannel = supabase
            .channel('public:profiles:chat_list')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, fetchChats)
            .subscribe();
        return () => {
            supabase.removeChannel(messageChannel);
            supabase.removeChannel(profileChannel);
        };
    }, [fetchChats]);

    const renderChatItem = ({ item }: { item: Chat }) => {
        const isUnread = unreadChats.has(item.chat_id);

        return (
            <View style={styles.chatItemContainer}>
                {isEditMode && (
                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteChat(item.chat_id)}>
                        <MaterialCommunityIcons name="minus-circle" size={24} color={themeColors.danger} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={styles.chatItem}
                    disabled={isEditMode}
                    onPress={() => router.push({
                        pathname: "/(tabs)/chats/[id]",
                        params: { id: item.chat_id }
                    })}
                >
                    {item.other_user_avatar_url ? (
                        <Image source={{ uri: item.other_user_avatar_url }} style={styles.avatarImage} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{item.other_user_name ? item.other_user_name.charAt(0).toUpperCase() : '?'}</Text>
                        </View>
                    )}
                    <View style={styles.chatContent}>
                        <Text style={[styles.userName, isUnread && styles.unreadText]} numberOfLines={1}>{item.other_user_name || t('chatList.unknownUser')}</Text>
                        <Text style={[styles.lastMessage, isUnread && styles.unreadText]} numberOfLines={1}>{item.last_message || t('chatList.noMessages')}</Text>
                    </View>
                    <View style={styles.metaContainer}>
                        {item.last_message_time && (
                            <Text style={styles.timestamp}>
                                {new Date(item.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        )}
                        {isUnread && <View style={styles.unreadDot} />}
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    const filteredChats = chats.filter(chat =>
        chat.other_user_name.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>{t('chatList.title')}</Text>
                <TouchableOpacity style={styles.editButton} onPress={() => setIsEditMode(!isEditMode)}>
                    <Text style={styles.editButtonText}>{isEditMode ? t('chatList.done') : t('chatList.edit')}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('chatList.searchPlaceholder')}
                        placeholderTextColor={themeColors.textHint}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>
            </View>

            {loading && chats.length === 0 && <View style={styles.centered}><ActivityIndicator size="large" color={themeColors.primary} /></View>}

            {!loading && filteredChats.length === 0 && (
                <View style={styles.centered}>
                    <MaterialCommunityIcons name="message-text-outline" size={60} color={themeColors.textSecondary} />
                    <Text style={styles.emptyText}>{searchText ? t('chatList.noResults') : t('chatList.emptyTitle')}</Text>
                    {!searchText && <Text style={styles.emptySubText}>{t('chatList.emptySubtitle')}</Text>}
                </View>
            )}

            <FlatList
                data={filteredChats}
                renderItem={renderChatItem}
                keyExtractor={(item) => item.chat_id}
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
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: 'bold',
        color: themeColors.text,
    },
    editButton: {
        padding: 8,
    },
    editButtonText: {
        color: themeColors.primary,
        fontSize: 17,
        fontWeight: '600',
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themeColors.surfaceHighlight,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: themeColors.text,
        fontSize: 16,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    chatItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themeColors.background,
        paddingLeft: 16,
    },
    deleteButton: {
        marginRight: 10,
    },
    chatItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingRight: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: themeColors.border,
    },
    avatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        backgroundColor: themeColors.surfaceHighlight,
    },
    avatarPlaceholder: {
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
    metaContainer: {
        alignItems: 'flex-end',
    },
    timestamp: {
        color: themeColors.textSecondary,
        fontSize: 12,
        marginBottom: 8,
    },
    unreadDot: {
        backgroundColor: themeColors.primary,
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    unreadText: {
        color: themeColors.text,
        fontWeight: 'bold',
    },
});