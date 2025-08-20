import { Platform } from 'react-native';
import * as Native from './native';
import * as Web from './web';

const impl = Platform.OS === 'web' ? Web : Native;

export const configure = impl.configure;
export const listOfferings = impl.listOfferings;
export const purchase = impl.purchase;
export const getEntitlements = impl.getEntitlements;
// FIX: restore falls back to getEntitlements on web (no restore there)
export const restore = (impl as any).restore ?? impl.getEntitlements;