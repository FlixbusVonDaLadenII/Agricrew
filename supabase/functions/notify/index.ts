import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Expo } from 'https://esm.sh/expo-server-sdk@4';

interface Payload {
  user_id?: string;
  broadcast?: boolean;
  title: string;
  body: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const fcmKey = Deno.env.get('FCM_SERVER_KEY');

serve(async (req) => {
  const payload: Payload = await req.json();
  const supabase = createClient(supabaseUrl, serviceKey);

  let query = supabase.from('profiles').select('id, push_token');
  if (payload.broadcast) {
    query = query.not('push_token', 'is', null);
  } else if (payload.user_id) {
    query = query.eq('id', payload.user_id);
  } else {
    return new Response('No recipients', { status: 400 });
  }

  const { data, error } = await query;
  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const expo = new Expo();
  const expoMessages: any[] = [];
  const webTokens: string[] = [];

  for (const row of data ?? []) {
    const tokens = row.push_token || {};
    if (tokens.expo) {
      expoMessages.push({ to: tokens.expo, title: payload.title, body: payload.body });
    }
    if (tokens.web) {
      webTokens.push(tokens.web);
    }
  }

  if (expoMessages.length) {
    await expo.sendPushNotificationsAsync(expoMessages);
  }

  if (webTokens.length && fcmKey) {
    for (const token of webTokens) {
      await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${fcmKey}`,
        },
        body: JSON.stringify({
          to: token,
          notification: { title: payload.title, body: payload.body },
        }),
      });
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
