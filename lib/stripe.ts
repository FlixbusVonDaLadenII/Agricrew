import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
    if (!stripePromise) {
        const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY as string;
        stripePromise = loadStripe(publishableKey);
    }
    return stripePromise;
};

export const redirectToCheckout = async (sessionId: string) => {
    const stripe = await getStripe();
    if (!stripe) {
        throw new Error('Stripe failed to initialize');
    }
    const { error } = await stripe.redirectToCheckout({ sessionId });
    if (error) {
        throw error;
    }
};
