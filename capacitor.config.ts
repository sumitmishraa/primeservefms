import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.primeserve.app',
  appName: 'PrimeServe',
  webDir: 'out',
  server: {
    url: 'https://app.primeservefs.com/mobile',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#f8fafc',
  },
};

export default config;
