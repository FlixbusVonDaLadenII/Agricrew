// env.d.ts
declare module NodeJS {
    interface ProcessEnv {
        EXPO_PUBLIC_SUPABASE_URL: string;
        EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
        EXPO_PUBLIC_LOCATIONIQ_API_KEY: string;

        EXPO_PUBLIC_RC_IOS_KEY: string;
        EXPO_PUBLIC_RC_WEB_KEY: string;
        EXPO_PUBLIC_RC_STRIPE_KEY: string;
    }
}