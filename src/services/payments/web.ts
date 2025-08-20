// src/services/payments/web.ts
// Handles both export styles of @revenuecat/purchases-js (named or default).

type PurchasesLike = {
    configure: (apiKeyOrCfg: any, appUserID?: string) => void;
    getOfferings: () => Promise<{
        current?: {
            availablePackages: Array<{
                identifier: string;
                product?: { title?: string; priceString?: string };
            }>;
        };
    }>;
    purchase: (args: { package: any } | any) => Promise<any>;
    getCustomerInfo: () => Promise<{ entitlements: any }>;
};

function loadPurchases(): PurchasesLike {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: any = require('@revenuecat/purchases-js');

    // Try common export patterns
    const candidate = mod?.Purchases ?? mod?.default ?? mod;
    if (!candidate) {
        throw new Error(
            'RevenueCat Web SDK not found. Check @revenuecat/purchases-js is installed.'
        );
    }

    // Bind methods so TS and runtime are happy regardless of export style
    const api = {
        configure: candidate.configure?.bind(candidate),
        getOfferings: candidate.getOfferings?.bind(candidate),
        purchase: (candidate.purchase ?? candidate.purchasePackage)?.bind(candidate),
        getCustomerInfo: candidate.getCustomerInfo?.bind(candidate),
    };

    // Minimal validation
    if (typeof api.configure !== 'function') {
        throw new Error(
            'Purchases.configure() not found. Your SDK version exports a different shape.'
        );
    }
    return api as PurchasesLike;
}

let RC: PurchasesLike | null = null;
const Purchases = (): PurchasesLike => (RC ??= loadPurchases());

export function configure(apiKey: string, appUserId?: string) {
    // Some versions take (apiKey, appUserID), others take ({ apiKey, appUserID })
    try {
        Purchases().configure(apiKey, appUserId ?? '');
    } catch {
        Purchases().configure({ apiKey, appUserID: appUserId ?? '' });
    }
}

export async function listOfferings() {
    const offerings = await Purchases().getOfferings();
    return offerings.current;
}

export async function purchase(packageId: string) {
    const offerings = await Purchases().getOfferings();
    const current = offerings.current;
    const pkg = current?.availablePackages.find(
        (p: { identifier: string }) => p.identifier === packageId
    );
    if (!pkg) throw new Error(`Package ${packageId} not found`);
    // Works across SDK variants
    return Purchases().purchase({ package: pkg });
}

export async function getEntitlements() {
    const info = await Purchases().getCustomerInfo();
    return info.entitlements;
}
// No restore() on web; your facade should fall back to getEntitlements()