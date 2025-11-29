import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.casilisto',
  appName: 'Casilisto',
  webDir: 'dist',
  
  // Configuración del servidor
  server: {
    // La app nativa se conectará al servidor de producción
    url: 'https://casilisto.lat',
    cleartext: false, // Solo HTTPS
    androidScheme: 'https',
    iosScheme: 'https'
  },
  
  // Configuración específica de iOS
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Casilisto',
    backgroundColor: '#FDE047'
  },
  
  // Configuración específica de Android
  android: {
    backgroundColor: '#FDE047',
    allowMixedContent: false
  },
  
  // Plugins
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FDE047',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FDE047'
    }
  }
};

export default config;
