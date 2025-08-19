import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
    const { sessionId, userId } = await req.json();
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
        return new Response(JSON.stringify({ error: 'Payment not completed' }), { status: 400 });
    }

    const priceId = (session.metadata?.priceId || '') as string;
    const now = new Date();
    const expiresAt = new Date(now);
    if (priceId.includes('yearly')) {
        expiresAt.setFullYear(now.getFullYear() + 1);
    } else {
        expiresAt.setMonth(now.getMonth() + 1);
    }

    await supabase.from('user_subscriptions').upsert({
        user_id: userId,
        role: priceId,
        is_active: true,
        subscribed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
    });
});
