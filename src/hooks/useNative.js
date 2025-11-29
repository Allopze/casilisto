/**
 * Hook para funciones nativas de Capacitor
 * Proporciona vibración háptica, splash screen, status bar, etc.
 */
import { useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useNative() {
  // Vibración háptica mejorada para nativo
  const vibrate = useCallback(async (style = 'medium') => {
    // Primero intentar con Capacitor Haptics si está disponible
    if (Capacitor.isPluginAvailable('Haptics')) {
      try {
        const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
        
        switch (style) {
          case 'light':
            await Haptics.impact({ style: ImpactStyle.Light });
            break;
          case 'medium':
            await Haptics.impact({ style: ImpactStyle.Medium });
            break;
          case 'heavy':
            await Haptics.impact({ style: ImpactStyle.Heavy });
            break;
          case 'success':
            await Haptics.notification({ type: NotificationType.Success });
            break;
          case 'warning':
            await Haptics.notification({ type: NotificationType.Warning });
            break;
          case 'error':
            await Haptics.notification({ type: NotificationType.Error });
            break;
          default:
            await Haptics.impact({ style: ImpactStyle.Medium });
        }
        return true;
      } catch (e) {
        console.warn('Haptics no disponible:', e);
      }
    }
    
    // Fallback a la API del navegador
    if (navigator.vibrate) {
      const patterns = {
        light: [10],
        medium: [30],
        heavy: [50],
        success: [30, 50, 30],
        warning: [50, 30, 50],
        error: [100, 50, 100]
      };
      navigator.vibrate(patterns[style] || [30]);
      return true;
    }
    
    return false;
  }, []);

  // Ocultar splash screen
  const hideSplash = useCallback(async () => {
    if (Capacitor.isPluginAvailable('SplashScreen')) {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      } catch (e) {
        console.warn('SplashScreen no disponible:', e);
      }
    }
  }, []);

  // Configurar status bar
  const setStatusBar = useCallback(async (options = {}) => {
    if (Capacitor.isPluginAvailable('StatusBar')) {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        
        if (options.style) {
          await StatusBar.setStyle({ 
            style: options.style === 'dark' ? Style.Dark : Style.Light 
          });
        }
        if (options.backgroundColor) {
          await StatusBar.setBackgroundColor({ color: options.backgroundColor });
        }
        if (options.overlay !== undefined) {
          await StatusBar.setOverlaysWebView({ overlay: options.overlay });
        }
      } catch (e) {
        console.warn('StatusBar no disponible:', e);
      }
    }
  }, []);

  // Mostrar status bar
  const showStatusBar = useCallback(async () => {
    if (Capacitor.isPluginAvailable('StatusBar')) {
      try {
        const { StatusBar } = await import('@capacitor/status-bar');
        await StatusBar.show();
      } catch (e) {
        console.warn('StatusBar no disponible:', e);
      }
    }
  }, []);

  return {
    vibrate,
    hideSplash,
    setStatusBar,
    showStatusBar,
    isNative: Capacitor.isNativePlatform(),
    isIOS: Capacitor.getPlatform() === 'ios',
    isAndroid: Capacitor.getPlatform() === 'android',
    platform: Capacitor.getPlatform()
  };
}

/**
 * Hook para inicializar la app nativa
 * Llama automáticamente a hideSplash y configura statusBar
 */
export function useNativeInit() {
  const { hideSplash, setStatusBar, isNative } = useNative();
  
  useEffect(() => {
    if (isNative) {
      // Pequeño delay para asegurar que la app esté lista
      const timer = setTimeout(async () => {
        await setStatusBar({ 
          style: 'dark', 
          backgroundColor: '#FDE047',
          overlay: false
        });
        await hideSplash();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isNative, hideSplash, setStatusBar]);
}

export default useNative;
