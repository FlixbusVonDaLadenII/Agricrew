import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    TextInput,
    Text,
    FlatList,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    Modal,
    ScrollView,
    Image,
    useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getThemeColors, Theme } from '@/theme/colors';
import { useTranslation } from 'react-i18next';
import { useUnreadChats } from '@/contexts/UnreadChatContext';

const baseFontFamily = Platform.OS === 'ios' ? 'System' : 'Roboto';
const PAGE_SIZE = 30;

// === Types ===
interface Profile {
    id: string;
    role: 'Arbeitnehmer' | 'Betrieb';
    full_name?: string;
    username?: string;
    avatar_url?: string;
    farm_description?: string;
    website?: string;
    contact_email?: string;
    address_street?: string;
    address_city?: string;
    address_postal_code?: string;
    address_country?: string;
    farm_specialization?: string[];
    farm_size_hectares?: number;
    number_of_employees?: string;
    accommodation_offered?: boolean;
    machinery_brands?: string[];
    experience?: string[] | null;
    age?: number | null;
    availability?: string | null;
    driving_licenses?: string[] | null;
}
interface Message {
    id: string;
    chat_id: string;
    content: string;
    created_at: string;
    sender_id: string;
}
interface Participant {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
}

// Small helper for rows in the profile modal
const ProfileInfoRow = ({
                            icon,
                            label,
                            value,
                            colors,
                        }: {
    icon: any;
    label: string;
    value?: string | number | null;
    colors: ReturnType<typeof getThemeColors>;
}) => {
    if (!value) return null;
    return (
        <View style={stylesRow.row}>
            <MaterialCommunityIcons name={icon} size={20} color={colors.textSecondary} style={stylesRow.icon} />
            <View>
                <Text style={[stylesRow.label, { color: colors.textSecondary }]}>{label}</Text>
                <Text style={[stylesRow.value, { color: colors.text }]}>{value}</Text>
            </View>
        </View>
    );
};

export default function ChatScreen() {
    const { t } = useTranslation();
    const { id: chatId } = useLocalSearchParams<{ id: string }>();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const scheme = useColorScheme();
    const colors = useMemo(() => getThemeColors((scheme || 'light') as Theme), [scheme]);

    const { markChatAsRead } = useUnreadChats();
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [otherUser, setOtherUser] = useState<Participant | null>(null);
    const [isProfileModalVisible, setProfileModalVisible] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(false);

    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);

    useFocusEffect(
        useCallback(() => {
            if (chatId) markChatAsRead(chatId);
        }, [chatId, markChatAsRead])
    );

    const handleViewProfile = useCallback(async () => {
        if (!otherUser) return;
        setIsProfileLoading(true);
        setProfileModalVisible(true);
        const { data, error } = await supabase.from('profiles').select('*').eq('id', otherUser.user_id).single();
        if (error) {
            Alert.alert(t('common.error'), t('chat.loadingProfileError'));
            setProfileModalVisible(false);
        } else {
            setSelectedProfile(data as Profile);
        }
        setIsProfileLoading(false);
    }, [otherUser, t]);

    // Themed header title (no extra header inside list)
    useEffect(() => {
        navigation.setOptions({
            headerStyle: { backgroundColor: colors.surface },
            headerShadowVisible: true,
            headerTitle: () => (
                <View style={titleStyles.wrapper}>
                    <TouchableOpacity onPress={handleViewProfile} disabled={!otherUser} style={titleStyles.touchable}>
                        {otherUser?.avatar_url ? (
                            <Image source={{ uri: otherUser.avatar_url }} style={titleStyles.avatar} />
                        ) : (
                            <View style={[titleStyles.avatar, { backgroundColor: colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center' }]}>
                                <MaterialCommunityIcons name="account" size={20} color={colors.textSecondary} />
                            </View>
                        )}
                        <View style={titleStyles.titleRow}>
                            <Text style={[titleStyles.titleText, { color: colors.text }]}>
                                {otherUser?.full_name || t('chat.titleFallback')}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.text} style={{ marginLeft: 4 }} />
                        </View>
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation, otherUser, handleViewProfile, t, colors]);

    // Initial load
    useEffect(() => {
        const fetchData = async () => {
            if (!chatId) return;
            setLoading(true);
            setHasMoreMessages(true);
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (!currentSession) throw new Error('No active session');
                setSession(currentSession);

                const { data: participantsData, error: participantsError } = await supabase.rpc('get_chat_participants', {
                    chat_id_input: chatId,
                });
                if (participantsError) throw participantsError;
                const participants = participantsData as Participant[];
                const other = participants?.find((p) => p.user_id !== currentSession.user.id);
                if (other) setOtherUser(other);

                const { data: messagesData, error: messagesError } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('chat_id', chatId)
                    .order('created_at', { ascending: false })
                    .range(0, PAGE_SIZE - 1);

                if (messagesError) throw messagesError;
                setMessages(messagesData || []);
                if (!messagesData || messagesData.length < PAGE_SIZE) setHasMoreMessages(false);
            } catch (e) {
                console.error('Error fetching chat data:', e);
                Alert.alert(t('common.error'), t('chat.loadingChatError'));
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [chatId, t]);

    // Realtime messages
    useEffect(() => {
        if (!chatId || !session?.user?.id) return;

        const channel = supabase
            .channel(`chat_${chatId}`)
            .on<Message>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
                (payload) => setMessages((cur) => [payload.new, ...cur])
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [chatId, session]);

    // Live header updates when profile changes
    useEffect(() => {
        if (!otherUser?.user_id) return;

        const profileChannel = supabase
            .channel(`profile_update_${otherUser.user_id}`)
            .on<Profile>(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${otherUser.user_id}` },
                (payload) => {
                    const name = payload.new.username || payload.new.full_name || t('chatList.unknownUser');
                    const avatar = payload.new.avatar_url || null;
                    setOtherUser((cur) => (cur ? { ...cur, full_name: name, avatar_url: avatar } : cur));
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(profileChannel);
        };
    }, [otherUser?.user_id]);

    const loadMoreMessages = async () => {
        if (loadingMore || !hasMoreMessages || !chatId) return;
        setLoadingMore(true);
        const start = messages.length;
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: false })
            .range(start, start + PAGE_SIZE - 1);
        if (!error && data) {
            if (data.length < PAGE_SIZE) setHasMoreMessages(false);
            setMessages((prev) => [...prev, ...data]);
        }
        setLoadingMore(false);
    };

    const handleSend = async () => {
        const content = newMessage.trim();
        if (!content || !session?.user || !chatId) return;
        setNewMessage('');
        const { error } = await supabase.from('messages').insert({
            chat_id: chatId,
            sender_id: session.user.id,
            content,
        });
        if (error) {
            console.error('Error sending message:', error);
            setNewMessage(content);
            Alert.alert(t('common.error'), t('chat.sendMessageError'));
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const mine = item.sender_id === session?.user?.id;
        return (
            <View style={[bubble.row, mine ? bubble.rowMine : bubble.rowTheirs]}>
                <View>
                    <View
                        style={[
                            bubble.bubble,
                            mine
                                ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
                                : { backgroundColor: colors.surfaceHighlight, borderBottomLeftRadius: 6 },
                            stylesShadow.shadow(colors),
                        ]}
                    >
                        <Text style={[bubble.text, { color: mine ? colors.background : colors.text }]}>{item.content}</Text>
                    </View>
                    <Text style={[bubble.time, { color: colors.textSecondary, textAlign: mine ? 'right' : 'left' }]}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[screen.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        // IMPORTANT: do NOT include 'bottom' in edges, so there is no extra safe-area padding under the composer
        <SafeAreaView style={[screen.container, { backgroundColor: colors.background }]} edges={['left', 'right', 'top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={screen.flex}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    style={screen.list}
                    // No paddingBottom here -> messages go right up to the composer
                    contentContainerStyle={{ paddingTop: 6 }}
                    onEndReached={loadMoreMessages}
                    onEndReachedThreshold={0.8}
                    inverted
                    ListFooterComponent={
                        loadingMore ? <ActivityIndicator style={{ marginVertical: 10 }} size="small" color={colors.primary} /> : null
                    }
                />

                {/* Composer */}
                <View
                    style={[
                        composer.container,
                        {
                            backgroundColor: colors.surface,
                            borderTopColor: colors.border,
                            // minimal bottom inset to sit just above the tab bar / home indicator
                            paddingBottom: Math.max(insets.bottom - 2, 0),
                        },
                        stylesShadow.top(colors),
                    ]}
                >
                    <View style={[composer.inputWrapper, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                        <TextInput
                            style={[composer.input, { color: colors.text }]}
                            value={newMessage}
                            onChangeText={setNewMessage}
                            placeholder={t('chat.inputPlaceholder')}
                            placeholderTextColor={colors.textHint}
                            multiline
                        />
                        <TouchableOpacity
                            style={[
                                composer.send,
                                { backgroundColor: newMessage.trim() ? colors.primary : colors.surfaceHighlight },
                            ]}
                            onPress={handleSend}
                            disabled={!newMessage.trim()}
                            activeOpacity={0.85}
                        >
                            <MaterialCommunityIcons
                                name="send"
                                size={22}
                                color={newMessage.trim() ? colors.background : colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Profile Modal */}
            <Modal animationType="slide" transparent visible={isProfileModalVisible} onRequestClose={() => setProfileModalVisible(false)}>
                <View style={modal.backdrop}>
                    <View style={[modal.card, { backgroundColor: colors.surface }]}>
                        {isProfileLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} />
                        ) : selectedProfile ? (
                            <>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    <View style={modal.avatarWrap}>
                                        {selectedProfile.avatar_url ? (
                                            <Image source={{ uri: selectedProfile.avatar_url }} style={modal.avatar} />
                                        ) : (
                                            <View style={[modal.avatar, { backgroundColor: colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center' }]}>
                                                <MaterialCommunityIcons name="account" size={40} color={colors.textSecondary} />
                                            </View>
                                        )}
                                    </View>

                                    <Text style={[modal.name, { color: colors.text }]}>
                                        {selectedProfile.role === 'Betrieb'
                                            ? selectedProfile.full_name
                                            : selectedProfile.username || selectedProfile.full_name}
                                    </Text>

                                    {selectedProfile.role === 'Betrieb' ? (
                                        <>
                                            {selectedProfile.farm_description ? (
                                                <>
                                                    <Text style={[modal.sectionTitle, { color: colors.textSecondary }]}>{t('jobList.profile.about')}</Text>
                                                    <Text style={[modal.paragraph, { color: colors.text }]}>{selectedProfile.farm_description}</Text>
                                                </>
                                            ) : null}

                                            <Text style={[modal.sectionTitle, { color: colors.textSecondary }]}>{t('jobList.profile.details')}</Text>
                                            <ProfileInfoRow icon="pine-tree" label={t('jobList.profile.farmSize')} value={selectedProfile.farm_size_hectares ? `${selectedProfile.farm_size_hectares} ha` : null} colors={colors} />
                                            <ProfileInfoRow icon="account-group-outline" label={t('jobList.profile.employees')} value={selectedProfile.number_of_employees} colors={colors} />
                                            <ProfileInfoRow icon="sprout-outline" label={t('jobList.profile.specializations')} value={selectedProfile.farm_specialization?.join(', ')} colors={colors} />
                                            <ProfileInfoRow icon="tractor" label={t('jobList.profile.machinery')} value={selectedProfile.machinery_brands?.join(', ')} colors={colors} />
                                            <ProfileInfoRow icon="home-city-outline" label={t('jobList.profile.accommodation')} value={selectedProfile.accommodation_offered ? t('jobList.profile.yes') : t('jobList.profile.no')} colors={colors} />
                                        </>
                                    ) : (
                                        <>
                                            <Text style={[modal.sectionTitle, { color: colors.textSecondary }]}>{t('profile.personalDetails')}</Text>
                                            <ProfileInfoRow icon="cake-variant-outline" label={t('profile.age')} value={selectedProfile.age} colors={colors} />
                                            <ProfileInfoRow icon="calendar-clock-outline" label={t('profile.availability')} value={selectedProfile.availability} colors={colors} />

                                            <Text style={[modal.sectionTitle, { color: colors.textSecondary }]}>{t('profile.drivingLicenses')}</Text>
                                            {(selectedProfile.driving_licenses || []).length > 0 ? (
                                                <View style={chips.wrap}>
                                                    {selectedProfile.driving_licenses!.map((lic) => (
                                                        <View key={lic} style={[chips.item, { backgroundColor: colors.surfaceHighlight }]}>
                                                            <Text style={[chips.text, { color: colors.text }]}>{lic}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : (
                                                <Text style={[modal.paragraph, { color: colors.textSecondary }]}>{t('chat.noLicenses')}</Text>
                                            )}

                                            <Text style={[modal.sectionTitle, { color: colors.textSecondary }]}>{t('profile.myExperience')}</Text>
                                            {(selectedProfile.experience || []).length > 0 ? (
                                                <View style={chips.wrap}>
                                                    {selectedProfile.experience!.map((key) => (
                                                        <View key={key} style={[chips.item, { backgroundColor: colors.surfaceHighlight }]}>
                                                            <Text style={[chips.text, { color: colors.text }]}>{t(`experiences.${key}`)}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : (
                                                <Text style={[modal.paragraph, { color: colors.textSecondary }]}>{t('chat.noExperience')}</Text>
                                            )}
                                        </>
                                    )}
                                </ScrollView>

                                <TouchableOpacity style={[modal.closeBtn, { backgroundColor: colors.primary }]} onPress={() => setProfileModalVisible(false)}>
                                    <Text style={[modal.closeText, { color: colors.background }]}>{t('jobList.profile.done')}</Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

/* ====== styles ====== */
const screen = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    list: { flex: 1, paddingHorizontal: 10 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

const bubble = StyleSheet.create({
    row: { flexDirection: 'row', marginVertical: 3 },
    rowMine: { justifyContent: 'flex-end', marginLeft: '18%' },
    rowTheirs: { justifyContent: 'flex-start', marginRight: '18%' },
    bubble: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, maxWidth: '100%' },
    text: { fontSize: 16, fontFamily: baseFontFamily },
    time: { fontSize: 10, marginTop: 4, marginHorizontal: 8 },
});

const composer = StyleSheet.create({
    container: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 12,
        paddingTop: 10,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontFamily: baseFontFamily,
        paddingRight: 8,
        maxHeight: 120,
    },
    send: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
});

const titleStyles = StyleSheet.create({
    wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    touchable: { flexDirection: 'row', alignItems: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center' },
    titleText: { fontSize: 16, fontWeight: '600', fontFamily: baseFontFamily },
    avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
});

const stylesRow = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    icon: { marginRight: 12, marginTop: 2 },
    label: { fontSize: 12, marginBottom: 2, fontFamily: baseFontFamily },
    value: { fontSize: 16, flexShrink: 1, fontFamily: baseFontFamily },
});

const chips = StyleSheet.create({
    wrap: { flexDirection: 'row', flexWrap: 'wrap' },
    item: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, marginRight: 10, marginBottom: 10 },
    text: { fontSize: 14, fontFamily: baseFontFamily },
});

const modal = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    card: {
        width: '90%',
        maxHeight: '72%',
        borderRadius: 20,
        padding: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
    },
    avatarWrap: { alignItems: 'center', marginBottom: 12 },
    avatar: { width: 84, height: 84, borderRadius: 42 },
    name: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 16, fontFamily: baseFontFamily },
    sectionTitle: { fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: baseFontFamily },
    paragraph: { fontSize: 16, lineHeight: 24, fontFamily: baseFontFamily },
    closeBtn: { borderRadius: 12, paddingVertical: 12, marginTop: 16 },
    closeText: { textAlign: 'center', fontWeight: '700', fontSize: 16, fontFamily: baseFontFamily },
});

// subtle elevation helpers
const stylesShadow = {
    shadow: (c: ReturnType<typeof getThemeColors>) =>
        Platform.select({
            ios: { shadowColor: c.border, shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
            android: { elevation: 2 },
        }) as any,
    top: (c: ReturnType<typeof getThemeColors>) =>
        Platform.select({
            ios: { shadowColor: c.border, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: -2 } },
            android: { elevation: 8 },
        }) as any,
};