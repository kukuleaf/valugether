import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { palette } from '../components/ui';
import { useAds } from './context';

const requestOptions = { requestNonPersonalizedAdsOnly: true };

export function InlineBanner({ placement }: { placement: 'home' | 'results' }) {
  const { sdk, config, ready, revision } = useAds();
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => listener.remove();
  }, []);
  useEffect(() => setFailed(false), [revision]);
  if (!sdk || !config?.enabled || !ready || !focused || !foreground || failed) return null;
  const unitId =
    __DEV__ || config.mode === 'test'
      ? sdk.TestIds.ADAPTIVE_BANNER
      : placement === 'home'
        ? config.homeUnitId
        : config.resultsUnitId;
  const BannerAd = sdk.BannerAd;
  return (
    <View testID={`ad-${placement}`} style={styles.slot}>
      <Text style={styles.label}>광고</Text>
      <View
        style={styles.creative}
        onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}
      >
        {width > 0 && (
          <BannerAd
            key={`${revision}-${width}`}
            unitId={unitId}
            size={sdk.BannerAdSize.INLINE_ADAPTIVE_BANNER}
            width={width}
            maxHeight={100}
            requestOptions={requestOptions}
            onAdFailedToLoad={(error) => {
              setFailed(true);
              if (__DEV__) console.warn('Banner unavailable:', error.code);
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { width: '100%', marginVertical: 24, gap: 8 },
  label: { color: palette.muted, fontSize: 10, textAlign: 'center' },
  creative: {
    width: '100%',
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF2F3',
  },
});
