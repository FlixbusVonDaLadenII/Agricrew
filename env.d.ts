// In env.d.ts
declare module NodeJS {
    interface ProcessEnv {
        EXPO_PUBLIC_SUPABASE_URL: string;
        EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
        EXPO_PUBLIC_LOCATIONIQ_API_KEY: string;
        EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
    }
}