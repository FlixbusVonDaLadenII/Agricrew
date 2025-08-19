import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

serve(async (req) => {
    const { priceId, userId, successUrl } = await req.json();
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' });

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: successUrl,
        metadata: { userId, priceId },
    });

    return new Response(JSON.stringify({ url: session.url }), {
        headers: { 'Content-Type': 'application/json' },
    });
});
