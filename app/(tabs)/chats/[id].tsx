import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useNavigation, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { getThemeColors } from '@/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useUnreadChats } from '@/contexts/UnreadChatContext';

const themeColors = getThemeColors('dark');
const baseFontFamily = Platform.OS === 'ios' ? 'System' : 'Roboto';

// --- Interfaces ---
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
    experience?: string[];
    age?: number | null;
    availability?: string | null;
    driving_licenses?: string[] | null; // Keep this in the interface
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

// --- Helper Component ---
const ProfileInfoRow = ({ icon, label, value }: { icon: any, label: string, value?: string | number | null }) => {
    if (!value) return null;
    return (
        <View style={styles.profileInfoRow}>
            <MaterialCommunityIcons name={icon} size={20} color={themeColors.textSecondary} style={styles.profileInfoIcon} />
            <View>
                <Text style={styles.profileInfoLabel}>{label}</Text>
                <Text style={styles.profileInfoValue}>{value}</Text>
            </View>
        </View>
    );
};

export default function ChatScreen() {
    const { t } = useTranslation();
    const { id: chatId } = useLocalSearchParams<{ id: string }>();
    const navigation = useNavigation();
    const flatListRef = useRef<FlatList>(null);
    const { markChatAsRead } = useUnreadChats();

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [otherUser, setOtherUser] = useState<Participant | null>(null);
    const [isProfileModalVisible, setProfileModalVisible] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (chatId) {
                markChatAsRead(chatId);
            }
        }, [chatId, markChatAsRead])
    );

    const handleViewProfile = useCallback(async () => {
        if (!otherUser) return;
        setIsProfileLoading(true);
        setProfileModalVisible(true);
        const { data, error } = await supabase.from('profiles').select('*').eq('id', otherUser.user_id).single();
        if (error) {
            Alert.alert("Error", t('chat.loadingProfileError'));
            setProfileModalVisible(false);
        } else {
            setSelectedProfile(data as Profile);
        }
        setIsProfileLoading(false);
    }, [otherUser, t]);

    useEffect(() => {
        navigation.setOptions({
            headerBackTitleVisible: false,
            headerBackTitle: '',
            headerTitle: () => (
                <TouchableOpacity onPress={handleViewProfile} disabled={!otherUser} style={styles.headerTouchable}>
                    {otherUser?.avatar_url ? (
                        <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar} />
                    ) : (
                        <View style={styles.headerAvatarPlaceholder}>
                            <MaterialCommunityIcons name="account" size={20} color={themeColors.textSecondary} />
                        </View>
                    )}
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitleText}>{otherUser?.full_name || 'Chat'}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={22} color={themeColors.text} style={styles.headerTitleIcon} />
                    </View>
                </TouchableOpacity>
            )
        });
    }, [navigation, otherUser, handleViewProfile]);

    useEffect(() => {
        const fetchData = async () => {
            if (!chatId) return;
            setLoading(true);
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (!currentSession) throw new Error("No active session");
                setSession(currentSession);
                const { data, error: participantsError } = await supabase.rpc('get_chat_participants', { chat_id_input: chatId });
                if (participantsError) throw participantsError;
                const participants = data as Participant[];
                if (participants) {
                    const otherParticipant = participants.find(p => p.user_id !== currentSession.user.id);
                    if (otherParticipant) setOtherUser(otherParticipant);
                }
                const { data: messagesData, error: messagesError } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
                if (messagesError) throw messagesError;
                if (messagesData) setMessages(messagesData);
            } catch (error) {
                console.error("Error fetching chat data:", error);
                Alert.alert("Error", t('chat.loadingChatError'));
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [chatId, t]);

    useEffect(() => {
        if (!chatId || !session?.user?.id) return;
        const messageChannel = supabase.channel(`chat_${chatId}`).on<Message>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
            if (payload.new.sender_id !== session.user.id) {
                setMessages(currentMessages => [...currentMessages, payload.new]);
            }
        }).subscribe();
        return () => { supabase.removeChannel(messageChannel); };
    }, [chatId, session]);

    useEffect(() => {
        if (!otherUser?.user_id) return;
        const profileChannel = supabase
            .channel(`profile_update_${otherUser.user_id}`)
            .on<Profile>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${otherUser.user_id}` },
                (payload) => {
                    const newName = payload.new.username || payload.new.full_name || 'Unknown User';
                    const newAvatar = payload.new.avatar_url || null;
                    setOtherUser(currentUser => ({ ...currentUser!, full_name: newName, avatar_url: newAvatar }));
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(profileChannel);
        };
    }, [otherUser]);

    const handleSend = async () => {
        const messageContent = newMessage.trim();
        if (!messageContent || !session?.user || !chatId) return;
        const optimisticMessage: Message = { id: `temp-${Date.now()}`, chat_id: chatId, content: messageContent, created_at: new Date().toISOString(), sender_id: session.user.id };
        setMessages(currentMessages => [...currentMessages, optimisticMessage]);
        setNewMessage('');
        const { error } = await supabase.from('messages').insert({ chat_id: chatId, sender_id: session.user.id, content: messageContent });
        if (error) {
            console.error('Error sending message:', error);
            setMessages(currentMessages => currentMessages.filter(msg => msg.id !== optimisticMessage.id));
            setNewMessage(messageContent);
            Alert.alert("Error", t('chat.sendMessageError'));
        }
    };

    const renderMessageBubble = ({ item }: { item: Message }) => {
        const isCurrentUser = item.sender_id === session?.user?.id;
        return (
            <View style={[styles.messageRow, isCurrentUser ? styles.myMessageRow : styles.theirMessageRow]}>
                <View>
                    <View style={[styles.messageBubble, isCurrentUser ? styles.myMessageBubble : styles.theirMessageBubble]}>
                        <Text style={isCurrentUser ? styles.myMessageText : styles.theirMessageText}>{item.content}</Text>
                    </View>
                    <Text style={[styles.messageTimestamp, isCurrentUser ? { textAlign: 'right' } : { textAlign: 'left' }]}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return <View style={styles.centeredContainer}><ActivityIndicator size="large" color={themeColors.primary} /></View>;
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardAvoidingContainer}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessageBubble}
                    keyExtractor={(item) => item.id}
                    style={styles.messageList}
                    contentContainerStyle={{ paddingTop: 10, paddingBottom: 5 }}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                />
                <View style={styles.inputContainer}>
                    <TextInput style={styles.textInput} value={newMessage} onChangeText={setNewMessage} placeholder={t('chat.inputPlaceholder')} placeholderTextColor={themeColors.textHint} multiline />
                    <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={!newMessage.trim()}>
                        <MaterialCommunityIcons name="send" size={24} color={themeColors.background} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <Modal animationType="slide" transparent={true} visible={isProfileModalVisible} onRequestClose={() => setProfileModalVisible(false)}>
                <View style={styles.modalCenteredView}>
                    <View style={styles.modalView}>
                        {isProfileLoading ? <ActivityIndicator size="large" color={themeColors.primary} /> : selectedProfile ? (
                            <>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    <View style={styles.modalAvatarContainer}>
                                        {selectedProfile.avatar_url ? (
                                            <Image source={{ uri: selectedProfile.avatar_url }} style={styles.modalAvatar} />
                                        ) : (
                                            <View style={styles.modalAvatarPlaceholder}>
                                                <MaterialCommunityIcons name="account" size={40} color={themeColors.textSecondary} />
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.profileName}>
                                        {selectedProfile.role === 'Betrieb'
                                            ? selectedProfile.full_name
                                            : selectedProfile.username || selectedProfile.full_name}
                                    </Text>

                                    {/* MODIFIED: This entire block is updated */}
                                    {selectedProfile.role === 'Betrieb' ? (
                                        <>
                                            {selectedProfile.farm_description && (<><Text style={styles.profileSectionTitle}>{t('jobList.profile.about')}</Text><Text style={styles.profileDescription}>{selectedProfile.farm_description}</Text></>)}
                                            <Text style={styles.profileSectionTitle}>{t('jobList.profile.details')}</Text>
                                            <ProfileInfoRow icon="pine-tree" label={t('jobList.profile.farmSize')} value={selectedProfile.farm_size_hectares ? `${selectedProfile.farm_size_hectares} ha` : null} />
                                            <ProfileInfoRow icon="account-group-outline" label={t('jobList.profile.employees')} value={selectedProfile.number_of_employees} />
                                            <ProfileInfoRow icon="sprout-outline" label={t('jobList.profile.specializations')} value={selectedProfile.farm_specialization?.join(', ')} />
                                            <ProfileInfoRow icon="tractor" label={t('jobList.profile.machinery')} value={selectedProfile.machinery_brands?.join(', ')} />
                                            <ProfileInfoRow icon="home-city-outline" label={t('jobList.profile.accommodation')} value={selectedProfile.accommodation_offered ? t('jobList.profile.yes') : t('jobList.profile.no')} />
                                        </>
                                    ) : (
                                        <>
                                            <Text style={styles.profileSectionTitle}>{t('profile.personalDetails')}</Text>
                                            <ProfileInfoRow icon="cake-variant-outline" label={t('profile.age')} value={selectedProfile.age} />
                                            <ProfileInfoRow icon="calendar-clock-outline" label={t('profile.availability')} value={selectedProfile.availability} />

                                            {/* Correctly display driving licenses */}
                                            <Text style={styles.profileSectionTitle}>{t('profile.drivingLicenses')}</Text>
                                            {selectedProfile.driving_licenses && selectedProfile.driving_licenses.length > 0 ? (
                                                <View style={styles.chipsContainer}>
                                                    {selectedProfile.driving_licenses.map(license => (
                                                        <View key={license} style={styles.chip}>
                                                            <Text style={styles.chipText}>{license}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : <Text style={styles.profileInfoValue}>{t('chat.noLicenses')}</Text>}

                                            {/* Correctly display experiences */}
                                            <Text style={styles.profileSectionTitle}>{t('profile.myExperience')}</Text>
                                            {selectedProfile.experience && selectedProfile.experience.length > 0 ? (
                                                <View style={styles.chipsContainer}>
                                                    {selectedProfile.experience.map(item => (
                                                        <View key={item} style={styles.chip}>
                                                            <Text style={styles.chipText}>{t(`experiences.${item}`)}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : <Text style={styles.profileInfoValue}>{t('chat.noExperience')}</Text>}
                                        </>
                                    )}
                                </ScrollView>
                                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setProfileModalVisible(false)}>
                                    <Text style={styles.modalCloseButtonText}>{t('jobList.profile.done')}</Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.background,
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: themeColors.background,
    },
    keyboardAvoidingContainer: {
        flex: 1,
    },
    messageList: {
        flex: 1,
        paddingHorizontal: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 20 : 10, // More padding for iOS notch area
        borderTopWidth: 1,
        borderTopColor: themeColors.border,
        backgroundColor: themeColors.background,
    },
    textInput: {
        flex: 1,
        backgroundColor: themeColors.surfaceHighlight,
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 15,
        color: themeColors.text,
        fontSize: 16,
        marginRight: 10,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: themeColors.primary,
        borderRadius: 25,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageRow: {
        flexDirection: 'row',
        marginVertical: 2,
    },
    myMessageRow: {
        justifyContent: 'flex-end',
        marginLeft: '20%',
    },
    theirMessageRow: {
        justifyContent: 'flex-start',
        marginRight: '20%',
    },
    messageBubble: {
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 15,
        maxWidth: '100%',
    },
    myMessageBubble: {
        backgroundColor: themeColors.primary,
        borderBottomRightRadius: 5,
    },
    theirMessageBubble: {
        backgroundColor: themeColors.surfaceHighlight,
        borderBottomLeftRadius: 5,
    },
    myMessageText: {
        color: themeColors.background,
        fontSize: 16,
    },
    theirMessageText: {
        color: themeColors.text,
        fontSize: 16,
    },
    messageTimestamp: {
        fontSize: 10,
        color: themeColors.textSecondary,
        marginTop: 4,
        marginHorizontal: 8,
    },
    headerTouchable: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleText: {
        color: themeColors.text,
        fontSize: 17,
        fontWeight: '600',
    },
    headerTitleIcon: {
        marginLeft: 4,
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        backgroundColor: themeColors.surfaceHighlight,
    },
    headerAvatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        backgroundColor: themeColors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCenteredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalView: {
        width: '90%',
        maxHeight: '70%',
        backgroundColor: themeColors.surface,
        borderRadius: 20,
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalAvatarContainer: {
        alignItems: 'center',
        marginBottom: 15,
    },
    modalAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: themeColors.surfaceHighlight,
    },
    modalAvatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: themeColors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileName: { fontFamily: baseFontFamily, fontSize: 24, fontWeight: 'bold', color: themeColors.text, textAlign: 'center', marginBottom: 20 },
    profileSectionTitle: { fontFamily: baseFontFamily, fontSize: 14, fontWeight: 'bold', color: themeColors.textSecondary, marginTop: 15, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    profileDescription: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text, lineHeight: 24 },
    profileInfoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
    profileInfoIcon: { marginRight: 15, marginTop: 2 },
    profileInfoLabel: { fontFamily: baseFontFamily, fontSize: 12, color: themeColors.textSecondary, marginBottom: 2 },
    profileInfoValue: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text, flexShrink: 1 },
    modalCloseButton: {
        backgroundColor: themeColors.primary,
        borderRadius: 10,
        padding: 12,
        elevation: 2,
        marginTop: 20,
    },
    modalCloseButtonText: {
        color: themeColors.background,
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 16,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    chip: {
        backgroundColor: themeColors.surfaceHighlight,
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        marginRight: 10,
        marginBottom: 10,
    },
    chipText: {
        color: themeColors.text,
        fontSize: 14,
    },
});