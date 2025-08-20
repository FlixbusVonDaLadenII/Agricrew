import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
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
    Platform,
    useColorScheme,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter, useNavigation } from 'expo-router';
import { getThemeColors } from '@/theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useUnreadChats } from '@/contexts/UnreadChatContext';

interface Chat {
    chat_id: string;
    other_user_name: string;
    last_message: string;
    last_message_time: string;
    other_user_avatar_url: string | null;
}

interface MessagePayload {
    new: {
        id: string;
        chat_id: string;
        content: string;
        created_at: string;
        sender_id: string;
    };
}

const baseFont = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
});

export default function ChatListScreen() {
    const { t } = useTranslation();
    const scheme = useColorScheme();
    const themeColors = useMemo(
        () => getThemeColors(scheme === 'dark' ? 'dark' : 'light'),
        [scheme]
    );

    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { unreadChats } = useUnreadChats();
    const navigation = useNavigation();

    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
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
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase.rpc('delete_chat', { chat_id_to_delete: chatIdToDelete });
                        if (error) {
                            Alert.alert(t('common.error'), t('chatList.deleteError'));
                            console.error('Delete error:', error);
                        } else {
                            setChats(current => current.filter(c => c.chat_id !== chatIdToDelete));
                        }
                    },
                },
            ]
        );
    };

    useFocusEffect(useCallback(() => { fetchChats(); }, [fetchChats]));

    useEffect(() => {
        const handleNewMessage = (payload: MessagePayload) => {
            const newMessage = payload.new;
            setChats(currentChats => {
                const chatIndex = currentChats.findIndex(c => c.chat_id === newMessage.chat_id);
                if (chatIndex > -1) {
                    const existing = { ...currentChats[chatIndex] };
                    existing.last_message = newMessage.content;
                    existing.last_message_time = newMessage.created_at;

                    return [existing, ...currentChats.slice(0, chatIndex), ...currentChats.slice(chatIndex + 1)];
                } else {
                    fetchChats();
                    return currentChats;
                }
            });
        };

        const messageChannel = supabase
            .channel('public:messages:chat_list')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handleNewMessage)
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

    const isUnread = (id: string) => unreadChats.has(id);
    const unreadCount = chats.reduce((acc, c) => acc + (isUnread(c.chat_id) ? 1 : 0), 0);

    const filteredChats = chats.filter(chat =>
        (chat.other_user_name || '').toLowerCase().includes(searchText.toLowerCase())
    );

    const renderChatItem = ({ item }: { item: Chat }) => {
        const unread = isUnread(item.chat_id);

        return (
            <View style={[styles.rowWrapper, { backgroundColor: themeColors.background }]}>
                {isEditMode && (
                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteChat(item.chat_id)}>
                        <MaterialCommunityIcons name="minus-circle" size={22} color={themeColors.danger} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                        styles.chatCard,
                        {
                            backgroundColor: unread ? themeColors.cardHighlight : themeColors.surface,
                            borderColor: themeColors.border,
                            shadowColor: Platform.OS === 'ios' ? '#000' : themeColors.surface,
                        },
                    ]}
                    disabled={isEditMode}
                    onPress={() =>
                        router.push({ pathname: '/(tabs)/chats/[id]', params: { id: item.chat_id } })
                    }
                >
                    {item.other_user_avatar_url ? (
                        <Image source={{ uri: item.other_user_avatar_url }} style={styles.avatarImage} />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.primary }]}>
                            <Text style={[styles.avatarText, { color: themeColors.background }]}>
                                {item.other_user_name ? item.other_user_name.charAt(0).toUpperCase() : '?'}
                            </Text>
                        </View>
                    )}

                    <View style={styles.chatContent}>
                        <View style={styles.nameRow}>
                            <Text
                                style={[
                                    styles.userName,
                                    { color: themeColors.text },
                                    unread && styles.userNameUnread,
                                ]}
                                numberOfLines={1}
                            >
                                {item.other_user_name || t('chatList.unknownUser')}
                            </Text>
                            {item.last_message_time ? (
                                <Text style={[styles.timestamp, { color: themeColors.textSecondary }]}>
                                    {new Date(item.last_message_time).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </Text>
                            ) : null}
                        </View>

                        <Text
                            style={[
                                styles.lastMessage,
                                { color: themeColors.textSecondary },
                                unread && styles.lastMessageUnread,
                            ]}
                            numberOfLines={2}
                        >
                            {item.last_message || t('chatList.noMessages')}
                        </Text>

                        <View style={styles.metaRow}>
                            {unread && <View style={[styles.unreadDot, { backgroundColor: themeColors.primary }]} />}
                            {/* room for future tags/badges without layout shift */}
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
            {/* Header */}
            <View style={[styles.headerContainer, { borderBottomColor: themeColors.border }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: themeColors.text }]}>
                        {t('chatList.title')}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.editButton, { backgroundColor: themeColors.surfaceHighlight, borderColor: themeColors.border }]}
                    onPress={() => setIsEditMode(!isEditMode)}
                    activeOpacity={0.85}
                >
                    <MaterialCommunityIcons
                        name={isEditMode ? 'check' : 'pencil-outline'}
                        size={18}
                        color={themeColors.text}
                        style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.editButtonText, { color: themeColors.text }]}>
                        {isEditMode ? t('chatList.done') : t('chatList.edit')}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <View
                    style={[
                        styles.searchBar,
                        {
                            backgroundColor: themeColors.surfaceHighlight,
                            borderColor: themeColors.border,
                            shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: themeColors.text }]}
                        placeholder={t('chatList.searchPlaceholder')}
                        placeholderTextColor={themeColors.textHint}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>
            </View>

            {/* Empty / loading */}
            {loading && chats.length === 0 && (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={themeColors.primary} />
                </View>
            )}

            {!loading && filteredChats.length === 0 && (
                <View style={styles.centered}>
                    <MaterialCommunityIcons name="message-text-outline" size={56} color={themeColors.textSecondary} />
                    <Text style={[styles.emptyText, { color: themeColors.text }]}>{searchText ? t('chatList.noResults') : t('chatList.emptyTitle')}</Text>
                    {!searchText && (
                        <Text style={[styles.emptySubText, { color: themeColors.textSecondary }]}>
                            {t('chatList.emptySubtitle')}
                        </Text>
                    )}
                </View>
            )}

            {/* List */}
            <FlatList
                data={filteredChats}
                renderItem={renderChatItem}
                keyExtractor={(item) => item.chat_id}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={fetchChats} tintColor={themeColors.primary} />
                }
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: 16,
                    width: '100%',
                    maxWidth: 960,           // nicer on laptops
                    alignSelf: 'center',
                }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: {
        fontFamily: baseFont,
        fontSize: 28,
        fontWeight: '700' as const,
        letterSpacing: 0.2,
    },
    headerSubtitle: {
        fontFamily: baseFont,
        fontSize: 13,
        marginTop: 2,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 34,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    editButtonText: {
        fontFamily: baseFont,
        fontSize: 14,
        fontWeight: '600' as const,
    },

    // Search
    searchContainer: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 6,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: StyleSheet.hairlineWidth,
        ...Platform.select({
            ios: { shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
            android: { elevation: 1 },
            default: {},
        }),
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontFamily: baseFont,
        fontSize: 16,
    },

    // Rows (card style)
    rowWrapper: {
        paddingHorizontal: 16,
    },
    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        ...Platform.select({
            ios: { shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 1 },
            default: {},
        }),
    },

    avatarImage: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
    avatarPlaceholder: {
        width: 48, height: 48, borderRadius: 24, marginRight: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { fontFamily: baseFont, fontSize: 18, fontWeight: '700' as const },

    chatContent: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

    userName: { fontFamily: baseFont, fontSize: 16, fontWeight: '700' as const },
    userNameUnread: { fontWeight: '800' as const },

    lastMessage: { fontFamily: baseFont, fontSize: 14, marginTop: 2 },
    lastMessageUnread: { fontWeight: '600' as const },

    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    unreadDot: { width: 10, height: 10, borderRadius: 5 },

    // Misc
    deleteButton: { marginRight: 10 },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },

    emptyText: { fontFamily: baseFont, fontSize: 18, fontWeight: '700' as const, textAlign: 'center', marginTop: 16 },
    emptySubText: { fontFamily: baseFont, fontSize: 14, textAlign: 'center', marginTop: 8 },

    timestamp: { fontFamily: baseFont, fontSize: 12, marginLeft: 8 },
});