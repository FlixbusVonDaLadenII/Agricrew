import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface UnreadChatContextType {
    unreadChats: Set<string>;
    markChatAsRead: (chatId: string) => void;
}

const UnreadChatContext = createContext<UnreadChatContextType | undefined>(undefined);

export const UnreadChatProvider = ({ children }: { children: ReactNode }) => {
    const [unreadChats, setUnreadChats] = useState<Set<string>>(new Set());
    const [session, setSession] = useState<Session | null>(null);

    // Get the initial session
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
        return () => subscription.unsubscribe();
    }, []);

    // Listen for new messages
    useEffect(() => {
        if (!session) return;

        const channel = supabase
            .channel('public:messages:unread_listener')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    if (payload.new.sender_id !== session.user.id) {
                        setUnreadChats(prev => new Set(prev).add(payload.new.chat_id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session]);

    // FIX: Wrap the function in useCallback to stabilize its reference
    const markChatAsRead = useCallback((chatId: string) => {
        setUnreadChats(prev => {
            // Check if the chat is actually unread before causing a state update
            if (!prev.has(chatId)) {
                return prev;
            }
            const newUnreadChats = new Set(prev);
            newUnreadChats.delete(chatId);
            return newUnreadChats;
        });
    }, []); // Empty dependency array means this function is created only once

    return (
        <UnreadChatContext.Provider value={{ unreadChats, markChatAsRead }}>
            {children}
        </UnreadChatContext.Provider>
    );
};

export const useUnreadChats = () => {
    const context = useContext(UnreadChatContext);
    if (context === undefined) {
        throw new Error('useUnreadChats must be used within a UnreadChatProvider');
    }
    return context;
};