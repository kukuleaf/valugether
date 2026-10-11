import { ReactNode } from 'react';
export { AdsPrivacyButton } from './context';

// AdMob is an Android integration; web and iOS do not import or initialize its native SDK.
export function AdsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
