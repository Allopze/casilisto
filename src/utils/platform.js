/**
 * Utilidades para detectar la plataforma y configurar URLs
 */
import { Capacitor } from '@capacitor/core';

// Detectar plataforma
export const isNative = () => Capacitor.isNativePlatform();
export const isIOS = () => Capacitor.getPlatform() === 'ios';
export const isAndroid = () => Capacitor.getPlatform() === 'android';
export const isWeb = () => Capacitor.getPlatform() === 'web';

// Obtener información de la plataforma
export const getPlatformInfo = () => ({
  platform: Capacitor.getPlatform(),
  isNative: Capacitor.isNativePlatform(),
  isPluginAvailable: (name) => Capacitor.isPluginAvailable(name)
});

// URL del servidor de producción
const PRODUCTION_SERVER = 'https://casilisto.lat';
const FALLBACK_SERVER = 'https://server.casilisto.app';

/**
 * Obtiene la URL base de la API según la plataforma
 */
export const getApiBase = () => {
  // Variable de entorno tiene prioridad máxima
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // En apps nativas, siempre usar servidor de producción
  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_SERVER;
  }
  
  // En web, usar mismo origen (servidor unificado)
  const { hostname, protocol, port } = window.location;
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
};
