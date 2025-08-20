import Purchases from 'react-native-purchases';

export async function configure(apiKey: string, appUserId?: string) {
    // FIXED: property name is appUserID (capital ID)
    await Purchases.configure({ apiKey, appUserID: appUserId });
}

export async function listOfferings() {
    const o = await Purchases.getOfferings();
    return o.current;
}

export async function purchase(packageId: string) {
    const o = await Purchases.getOfferings();
    const pkg = o.current?.availablePackages.find(p => p.identifier === packageId);
    if (!pkg) throw new Error(`Package ${packageId} not found`);
    return Purchases.purchasePackage(pkg);
}

export async function getEntitlements() {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements;
}

export const restore = async () => {
    await Purchases.restorePurchases();
    return getEntitlements();
};