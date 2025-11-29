/**
 * Hook para gestionar la base de datos local (localStorage).
 * Centraliza la lógica de persistencia y normalización de datos.
 * Incluye soporte para sincronización entre dispositivos.
 */
import { useState, useEffect } from 'react';

export const DB_KEY = 'casilisto_db_v1';
export const SYNC_KEY = 'casilisto_sync_v1';

// Generar UUID único para el dispositivo
function generateDeviceId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Detectar nombre del dispositivo desde User Agent
function detectDeviceName() {
  const ua = navigator.userAgent;
  let browser = 'Navegador';
  let os = 'Desconocido';
  
  // Detectar navegador
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
  
  // Detectar SO
  if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';
  
  return `${browser} en ${os}`;
}

// Cargar/guardar datos de sincronización
export function loadSyncData() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error leyendo datos de sync', e);
  }
  
  // Valores por defecto
  return {
    deviceId: generateDeviceId(),
    deviceName: detectDeviceName(),
    userCode: null,
    lastSyncAt: 0,
    pendingChanges: false
  };
}

export function saveSyncData(syncData) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(syncData));
  } catch (e) {
    console.error('Error guardando datos de sync', e);
  }
}

// --- Utilidades de normalización ---

const decodeMojibake = (value) => {
  if (typeof value !== 'string') return value;
  const hasArtifacts = /Ã|Â|�/.test(value);
  if (!hasArtifacts) return value.trim();
  try {
    const bytes = Uint8Array.from([...value].map((c) => c.charCodeAt(0)));
    const decoded = new TextDecoder('utf-8').decode(bytes).trim();
    if (!/Ã|Â|�/.test(decoded)) return decoded;
  } catch {
    // ignore decode errors and fall back to original
  }
  return value.trim();
};

export const cleanText = (value) => decodeMojibake(value || '');

// Alias de categorías corruptas -> nombre canónico
// Usamos escapes Unicode para evitar literales corruptos en el código fuente
const CATEGORY_ALIASES = {
  // L + replacement char + cteos -> Lácteos
  ['L\uFFFDcteos y Huevos']: 'Lácteos y Huevos',
  // UTF-8 double-encoded variants
  'L\u00C3\u00A1cteos y Huevos': 'Lácteos y Huevos',
  'LÃ¡cteos y Huevos': 'Lácteos y Huevos',
  'Lacteos y Huevos': 'Lácteos y Huevos',
  // Panadería variants
  ['Panader\uFFFDa y Dulces']: 'Panadería y Dulces',
  'Panader\u00C3\u00ADa y Dulces': 'Panadería y Dulces',
  'PanaderÃ­a y Dulces': 'Panadería y Dulces',
  'Panaderia y Dulces': 'Panadería y Dulces',
};

export const normalizeCategoryName = (name) => {
  const cleaned = cleanText(name || '');
  return CATEGORY_ALIASES[cleaned] || cleaned;
};

export const normalizeCategoryMap = (cats) => {
  const fixed = {};
  Object.keys(cats || {}).forEach((key) => {
    const newName = normalizeCategoryName(key);
    fixed[newName] = cats[key];
  });
  return fixed;
};

export const normalizeItemList = (lst) =>
  (lst || []).map((item) => {
    const normalized = {
      ...item,
      category: normalizeCategoryName(item.category),
    };
    if (item.text !== undefined) normalized.text = cleanText(item.text);
    if (item.name !== undefined) normalized.name = cleanText(item.name);
    return normalized;
  });

// --- Defaults ---

export const DEFAULT_CATEGORIES = {
  'Frutas y Verduras': { color: 'bg-green-100 text-green-800', border: 'border-green-200', iconName: 'Carrot' },
  'Carnes y Pescados': { color: 'bg-red-100 text-red-800', border: 'border-red-200', iconName: 'Beef' },
  'Lácteos y Huevos': { color: 'bg-blue-100 text-blue-800', border: 'border-blue-200', iconName: 'Milk' },
  'Despensa': { color: 'bg-orange-100 text-orange-800', border: 'border-orange-200', iconName: 'Utensils' },
  'Panadería y Dulces': { color: 'bg-yellow-200 text-yellow-800', border: 'border-yellow-300', iconName: 'Croissant' },
  'Bebidas': { color: 'bg-purple-100 text-purple-800', border: 'border-purple-200', iconName: 'Coffee' },
  'Hogar y Limpieza': { color: 'bg-stone-200 text-stone-800', border: 'border-stone-300', iconName: 'Home' },
  'Aseo Personal': { color: 'bg-pink-100 text-pink-800', border: 'border-pink-200', iconName: 'User' },
  'Mascotas': { color: 'bg-amber-100 text-amber-800', border: 'border-amber-200', iconName: 'Cat' },
  'Otros': { color: 'bg-gray-100 text-gray-800', border: 'border-gray-200', iconName: 'ShoppingCart' },
};

export const DEFAULT_MASTER_LIST = [
  { name: 'Pan', category: 'Panadería y Dulces' },
  { name: 'Pan de cebolla', category: 'Panadería y Dulces' },
  { name: 'Pan Perfecto', category: 'Panadería y Dulces' },
  { name: 'Pan Bimbo', category: 'Panadería y Dulces' },
  { name: 'Pan tostado', category: 'Panadería y Dulces' },
  { name: 'Pan de ajo', category: 'Panadería y Dulces' },
  { name: 'Colaciones', category: 'Panadería y Dulces' },
  { name: 'Doritos', category: 'Panadería y Dulces' },
  { name: 'Chocolate', category: 'Panadería y Dulces' },
  { name: 'Galletas', category: 'Panadería y Dulces' },
  { name: 'Comida seca gatos', category: 'Mascotas' },
  { name: 'Comida húmeda gatos', category: 'Mascotas' },
  { name: 'Arena gatos', category: 'Mascotas' },
  { name: 'Queso laminado', category: 'Lácteos y Huevos' },
  { name: 'Queso', category: 'Lácteos y Huevos' },
  { name: 'Queso La Vaquita', category: 'Lácteos y Huevos' },
  { name: 'Margarina', category: 'Lácteos y Huevos' },
  { name: 'Leche sin lactosa', category: 'Lácteos y Huevos' },
  { name: 'Leche semi', category: 'Lácteos y Huevos' },
  { name: 'Yogures', category: 'Lácteos y Huevos' },
  { name: 'Huevos', category: 'Lácteos y Huevos' },
  { name: 'Queso rallado', category: 'Lácteos y Huevos' },
  { name: 'Cebollas', category: 'Frutas y Verduras' },
  { name: 'Ajos', category: 'Frutas y Verduras' },
  { name: 'Manzanas', category: 'Frutas y Verduras' },
  { name: 'Plátanos', category: 'Frutas y Verduras' },
  { name: 'Mandarinas', category: 'Frutas y Verduras' },
  { name: 'Tomates', category: 'Frutas y Verduras' },
  { name: 'Zapallo', category: 'Frutas y Verduras' },
  { name: 'Palta', category: 'Frutas y Verduras' },
  { name: 'Mangos', category: 'Frutas y Verduras' },
  { name: 'Limones', category: 'Frutas y Verduras' },
  { name: 'Zanahorias', category: 'Frutas y Verduras' },
  { name: 'Lechuga', category: 'Frutas y Verduras' },
  { name: 'Pimiento rojo', category: 'Frutas y Verduras' },
  { name: 'Pimiento verde', category: 'Frutas y Verduras' },
  { name: 'Setas', category: 'Frutas y Verduras' },
  { name: 'Champiñones frescos', category: 'Frutas y Verduras' },
  { name: 'Patatas', category: 'Frutas y Verduras' },
  { name: 'Jugos', category: 'Bebidas' },
  { name: 'Coca Cola', category: 'Bebidas' },
  { name: 'Naranja', category: 'Bebidas' },
  { name: 'Cerveza', category: 'Bebidas' },
  { name: 'Vino', category: 'Bebidas' },
  { name: 'Café', category: 'Bebidas' },
  { name: 'Colacao', category: 'Bebidas' },
  { name: 'Jamón Colonial', category: 'Carnes y Pescados' },
  { name: 'Jamón de pavo', category: 'Carnes y Pescados' },
  { name: 'Tocino', category: 'Carnes y Pescados' },
  { name: 'Chorizo bocata', category: 'Carnes y Pescados' },
  { name: 'Chorizo cocinar', category: 'Carnes y Pescados' },
  { name: 'Jamón serrano', category: 'Carnes y Pescados' },
  { name: 'Taco de jamón', category: 'Carnes y Pescados' },
  { name: 'Pollo', category: 'Carnes y Pescados' },
  { name: 'Trutos de pollo', category: 'Carnes y Pescados' },
  { name: 'Pechugas de pollo', category: 'Carnes y Pescados' },
  { name: 'Asiento', category: 'Carnes y Pescados' },
  { name: 'Costilla de cerdo', category: 'Carnes y Pescados' },
  { name: 'Chuletas de cerdo', category: 'Carnes y Pescados' },
  { name: 'Lomo de cerdo', category: 'Carnes y Pescados' },
  { name: 'Carne', category: 'Carnes y Pescados' },
  { name: 'Huesos carnudo', category: 'Carnes y Pescados' },
  { name: 'Carne molida', category: 'Carnes y Pescados' },
  { name: 'Pescado', category: 'Carnes y Pescados' },
  { name: 'Merluza', category: 'Carnes y Pescados' },
  { name: 'Salmón', category: 'Carnes y Pescados' },
  { name: 'Camarones', category: 'Carnes y Pescados' },
  { name: 'Pulpo', category: 'Carnes y Pescados' },
  { name: 'Calamares', category: 'Carnes y Pescados' },
  { name: 'Rabas', category: 'Carnes y Pescados' },
  { name: 'Jibia', category: 'Carnes y Pescados' },
  { name: 'Mejillones', category: 'Carnes y Pescados' },
  { name: 'Aceite girasol', category: 'Despensa' },
  { name: 'Aceite de oliva', category: 'Despensa' },
  { name: 'Vinagre', category: 'Despensa' },
  { name: 'Vinagre blanco Carbonel', category: 'Despensa' },
  { name: 'Vinagre de jerez Carbonel', category: 'Despensa' },
  { name: 'Vinagre de arroz', category: 'Despensa' },
  { name: 'Salsa de soja', category: 'Despensa' },
  { name: 'Mayonesa', category: 'Despensa' },
  { name: 'Mayonesa con ajo', category: 'Despensa' },
  { name: 'Sal', category: 'Despensa' },
  { name: 'Pote de sal', category: 'Despensa' },
  { name: 'Arroz', category: 'Despensa' },
  { name: 'Macarrones', category: 'Despensa' },
  { name: 'Espagueti', category: 'Despensa' },
  { name: 'Fideos', category: 'Despensa' },
  { name: 'Sopas', category: 'Despensa' },
  { name: 'Caldo de pollo', category: 'Despensa' },
  { name: 'Caldo de carne', category: 'Despensa' },
  { name: 'Lentejas', category: 'Despensa' },
  { name: 'Alubias', category: 'Despensa' },
  { name: 'Garbanzos', category: 'Despensa' },
  { name: 'Mejillones escabeche', category: 'Despensa' },
  { name: 'Sardinas', category: 'Despensa' },
  { name: 'Atún', category: 'Despensa' },
  { name: 'Aceitunas', category: 'Despensa' },
  { name: 'Paté', category: 'Despensa' },
  { name: 'Guisantes', category: 'Despensa' },
  { name: 'Pimiento morrón', category: 'Despensa' },
  { name: 'Champiñones', category: 'Despensa' },
  { name: 'Tuco', category: 'Despensa' },
  { name: 'Salsa de tomate', category: 'Despensa' },
  { name: 'Ketchup', category: 'Despensa' },
  { name: 'Pollo crispi', category: 'Despensa' },
  { name: 'Sopas de pollo', category: 'Despensa' },
  { name: 'Harina de maíz', category: 'Despensa' },
  { name: 'Harina de trigo', category: 'Despensa' },
  { name: 'Pasta lasaña', category: 'Despensa' },
  { name: 'Carbón', category: 'Hogar y Limpieza' },
  { name: 'Cloro normal', category: 'Hogar y Limpieza' },
  { name: 'Cloro color', category: 'Hogar y Limpieza' },
  { name: 'Detergente', category: 'Hogar y Limpieza' },
  { name: 'Ambientador automático', category: 'Hogar y Limpieza' },
  { name: 'Ambientador', category: 'Hogar y Limpieza' },
  { name: 'Limpiasuelo', category: 'Hogar y Limpieza' },
  { name: 'Lavavajillas', category: 'Hogar y Limpieza' },
  { name: 'Bolsas basura grandes', category: 'Hogar y Limpieza' },
  { name: 'Bolsas basura pequeñas', category: 'Hogar y Limpieza' },
  { name: 'Servilletas', category: 'Hogar y Limpieza' },
  { name: 'Papel de cocina', category: 'Hogar y Limpieza' },
  { name: 'Jabón líquido Dove', category: 'Aseo Personal' },
  { name: 'Jabón pastilla Dove', category: 'Aseo Personal' },
  { name: 'Pasta de dientes', category: 'Aseo Personal' },
  { name: 'Desodorante', category: 'Aseo Personal' },
  { name: 'Champú', category: 'Aseo Personal' },
  { name: 'Hisopos', category: 'Aseo Personal' },
  { name: 'Maquinilla de afeitar', category: 'Aseo Personal' },
  { name: 'Papel higiénico', category: 'Aseo Personal' },
  { name: 'Pañuelos', category: 'Aseo Personal' },
];

export const DEFAULT_ITEMS = [
  { id: 1, text: 'Pan', completed: false, category: 'Panadería y Dulces', quantity: 1 },
  { id: 2, text: 'Pan de cebolla', completed: false, category: 'Panadería y Dulces', quantity: 1 },
  { id: 3, text: 'Pan Perfecto', completed: false, category: 'Panadería y Dulces', quantity: 1 },
  { id: 4, text: 'Pan Bimbo', completed: false, category: 'Panadería y Dulces', quantity: 1 },
  { id: 5, text: 'Pan tostado', completed: false, category: 'Panadería y Dulces', quantity: 1 },
  { id: 6, text: 'Pan de ajo', completed: false, category: 'Panadería y Dulces', quantity: 1 },
  { id: 7, text: 'Colaciones', completed: false, category: 'Panadería y Dulces', quantity: 1 },
  { id: 8, text: 'Doritos', completed: false, category: 'Panadería y Dulces', quantity: 1 },
  { id: 9, text: 'Chocolate', completed: false, category: 'Panadería y Dulces', quantity: 1 },
  { id: 10, text: 'Galletas', completed: false, category: 'Panadería y Dulces', quantity: 1 },
  { id: 11, text: 'Comida seca gatos', completed: false, category: 'Mascotas', quantity: 1 },
  { id: 12, text: 'Comida húmeda gatos', completed: false, category: 'Mascotas', quantity: 1 },
  { id: 13, text: 'Arena gatos', completed: false, category: 'Mascotas', quantity: 1 },
  { id: 14, text: 'Queso laminado', completed: false, category: 'Lácteos y Huevos', quantity: 1 },
  { id: 15, text: 'Queso', completed: false, category: 'Lácteos y Huevos', quantity: 1 },
  { id: 16, text: 'Queso La Vaquita', completed: false, category: 'Lácteos y Huevos', quantity: 1 },
  { id: 17, text: 'Margarina', completed: false, category: 'Lácteos y Huevos', quantity: 1 },
  { id: 18, text: 'Leche sin lactosa', completed: false, category: 'Lácteos y Huevos', quantity: 1 },
  { id: 19, text: 'Leche semi', completed: false, category: 'Lácteos y Huevos', quantity: 1 },
  { id: 20, text: 'Yogures', completed: false, category: 'Lácteos y Huevos', quantity: 1 },
  { id: 21, text: 'Huevos', completed: false, category: 'Lácteos y Huevos', quantity: 1 },
  { id: 22, text: 'Queso rallado', completed: false, category: 'Lácteos y Huevos', quantity: 1 },
  { id: 23, text: 'Cebollas', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 24, text: 'Ajos', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 25, text: 'Manzanas', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 26, text: 'Plátanos', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 27, text: 'Mandarinas', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 28, text: 'Tomates', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 29, text: 'Zapallo', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 30, text: 'Palta', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 31, text: 'Mangos', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 32, text: 'Limones', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 33, text: 'Zanahorias', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 34, text: 'Lechuga', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 35, text: 'Pimiento rojo', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 36, text: 'Pimiento verde', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 37, text: 'Setas', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 38, text: 'Champiñones frescos', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 39, text: 'Patatas', completed: false, category: 'Frutas y Verduras', quantity: 1 },
  { id: 40, text: 'Jugos', completed: false, category: 'Bebidas', quantity: 1 },
  { id: 41, text: 'Coca Cola', completed: false, category: 'Bebidas', quantity: 1 },
  { id: 42, text: 'Naranja', completed: false, category: 'Bebidas', quantity: 1 },
  { id: 43, text: 'Cerveza', completed: false, category: 'Bebidas', quantity: 1 },
  { id: 44, text: 'Vino', completed: false, category: 'Bebidas', quantity: 1 },
  { id: 45, text: 'Café', completed: false, category: 'Bebidas', quantity: 1 },
  { id: 46, text: 'Colacao', completed: false, category: 'Bebidas', quantity: 1 },
  { id: 47, text: 'Jamón Colonial', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 48, text: 'Jamón de pavo', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 49, text: 'Tocino', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 50, text: 'Chorizo bocata', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 51, text: 'Chorizo cocinar', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 52, text: 'Jamón serrano', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 53, text: 'Taco de jamón', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 54, text: 'Pollo', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 55, text: 'Trutos de pollo', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 56, text: 'Pechugas de pollo', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 57, text: 'Asiento', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 58, text: 'Costilla de cerdo', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 59, text: 'Chuletas de cerdo', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 60, text: 'Lomo de cerdo', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 61, text: 'Carne', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 62, text: 'Huesos carnudo', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 63, text: 'Carne molida', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 64, text: 'Pescado', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 65, text: 'Merluza', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 66, text: 'Salmón', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 67, text: 'Camarones', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 68, text: 'Pulpo', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 69, text: 'Calamares', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 70, text: 'Rabas', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 71, text: 'Jibia', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 72, text: 'Mejillones', completed: false, category: 'Carnes y Pescados', quantity: 1 },
  { id: 73, text: 'Aceite girasol', completed: false, category: 'Despensa', quantity: 1 },
  { id: 74, text: 'Aceite de oliva', completed: false, category: 'Despensa', quantity: 1 },
  { id: 75, text: 'Vinagre', completed: false, category: 'Despensa', quantity: 1 },
  { id: 76, text: 'Vinagre blanco Carbonel', completed: false, category: 'Despensa', quantity: 1 },
  { id: 77, text: 'Vinagre de jerez Carbonel', completed: false, category: 'Despensa', quantity: 1 },
  { id: 78, text: 'Vinagre de arroz', completed: false, category: 'Despensa', quantity: 1 },
  { id: 79, text: 'Salsa de soja', completed: false, category: 'Despensa', quantity: 1 },
  { id: 80, text: 'Mayonesa', completed: false, category: 'Despensa', quantity: 1 },
  { id: 81, text: 'Mayonesa con ajo', completed: false, category: 'Despensa', quantity: 1 },
  { id: 82, text: 'Sal', completed: false, category: 'Despensa', quantity: 1 },
  { id: 83, text: 'Pote de sal', completed: false, category: 'Despensa', quantity: 1 },
  { id: 84, text: 'Arroz', completed: false, category: 'Despensa', quantity: 1 },
  { id: 85, text: 'Macarrones', completed: false, category: 'Despensa', quantity: 1 },
  { id: 86, text: 'Espagueti', completed: false, category: 'Despensa', quantity: 1 },
  { id: 87, text: 'Fideos', completed: false, category: 'Despensa', quantity: 1 },
  { id: 88, text: 'Sopas', completed: false, category: 'Despensa', quantity: 1 },
  { id: 89, text: 'Caldo de pollo', completed: false, category: 'Despensa', quantity: 1 },
  { id: 90, text: 'Caldo de carne', completed: false, category: 'Despensa', quantity: 1 },
  { id: 91, text: 'Lentejas', completed: false, category: 'Despensa', quantity: 1 },
  { id: 92, text: 'Alubias', completed: false, category: 'Despensa', quantity: 1 },
  { id: 93, text: 'Garbanzos', completed: false, category: 'Despensa', quantity: 1 },
  { id: 94, text: 'Mejillones escabeche', completed: false, category: 'Despensa', quantity: 1 },
  { id: 95, text: 'Sardinas', completed: false, category: 'Despensa', quantity: 1 },
  { id: 96, text: 'Atún', completed: false, category: 'Despensa', quantity: 1 },
  { id: 97, text: 'Aceitunas', completed: false, category: 'Despensa', quantity: 1 },
  { id: 98, text: 'Paté', completed: false, category: 'Despensa', quantity: 1 },
  { id: 99, text: 'Guisantes', completed: false, category: 'Despensa', quantity: 1 },
  { id: 100, text: 'Pimiento morrón', completed: false, category: 'Despensa', quantity: 1 },
  { id: 101, text: 'Champiñones', completed: false, category: 'Despensa', quantity: 1 },
  { id: 102, text: 'Tuco', completed: false, category: 'Despensa', quantity: 1 },
  { id: 103, text: 'Salsa de tomate', completed: false, category: 'Despensa', quantity: 1 },
  { id: 104, text: 'Ketchup', completed: false, category: 'Despensa', quantity: 1 },
  { id: 105, text: 'Pollo crispi', completed: false, category: 'Despensa', quantity: 1 },
  { id: 106, text: 'Sopas de pollo', completed: false, category: 'Despensa', quantity: 1 },
  { id: 107, text: 'Harina de maíz', completed: false, category: 'Despensa', quantity: 1 },
  { id: 108, text: 'Harina de trigo', completed: false, category: 'Despensa', quantity: 1 },
  { id: 109, text: 'Pasta lasaña', completed: false, category: 'Despensa', quantity: 1 },
  { id: 110, text: 'Carbón', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 111, text: 'Cloro normal', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 112, text: 'Cloro color', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 113, text: 'Detergente', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 114, text: 'Ambientador automático', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 115, text: 'Ambientador', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 116, text: 'Limpiasuelo', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 117, text: 'Lavavajillas', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 118, text: 'Bolsas basura grandes', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 119, text: 'Bolsas basura pequeñas', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 120, text: 'Servilletas', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 121, text: 'Papel de cocina', completed: false, category: 'Hogar y Limpieza', quantity: 1 },
  { id: 122, text: 'Jabón líquido Dove', completed: false, category: 'Aseo Personal', quantity: 1 },
  { id: 123, text: 'Jabón pastilla Dove', completed: false, category: 'Aseo Personal', quantity: 1 },
  { id: 124, text: 'Pasta de dientes', completed: false, category: 'Aseo Personal', quantity: 1 },
  { id: 125, text: 'Desodorante', completed: false, category: 'Aseo Personal', quantity: 1 },
  { id: 126, text: 'Champú', completed: false, category: 'Aseo Personal', quantity: 1 },
  { id: 127, text: 'Hisopos', completed: false, category: 'Aseo Personal', quantity: 1 },
  { id: 128, text: 'Maquinilla de afeitar', completed: false, category: 'Aseo Personal', quantity: 1 },
  { id: 129, text: 'Papel higiénico', completed: false, category: 'Aseo Personal', quantity: 1 },
  { id: 130, text: 'Pañuelos', completed: false, category: 'Aseo Personal', quantity: 1 },
];

// --- Funciones de carga ---

export function loadDb() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Error leyendo base de datos local', e);
    return null;
  }
}

export function getInitialCategories() {
  const db = loadDb();
  if (db && db.categories) return normalizeCategoryMap(db.categories);
  try {
    const saved = localStorage.getItem('shoppingListCategories');
    return normalizeCategoryMap(saved ? JSON.parse(saved) : DEFAULT_CATEGORIES);
  } catch {
    return normalizeCategoryMap(DEFAULT_CATEGORIES);
  }
}

export function getInitialMasterList() {
  const db = loadDb();
  if (db && db.masterList) return normalizeItemList(db.masterList);
  try {
    const saved = localStorage.getItem('shoppingListMaster');
    return normalizeItemList(saved ? JSON.parse(saved) : DEFAULT_MASTER_LIST);
  } catch {
    return normalizeItemList(DEFAULT_MASTER_LIST);
  }
}

export function getInitialItems() {
  const db = loadDb();
  if (db && db.items) return normalizeItemList(db.items);
  try {
    const savedItems = localStorage.getItem('shoppingListV5');
    if (savedItems) return normalizeItemList(JSON.parse(savedItems));
  } catch {
    // ignore
  }
  return normalizeItemList(DEFAULT_ITEMS);
}

export function getInitialFavorites() {
  const db = loadDb();
  if (db && db.favorites) return normalizeItemList(db.favorites);
  return [];
}

// --- Hook principal ---

export function useLocalDb() {
  const [categories, setCategories] = useState(getInitialCategories);
  const [masterList, setMasterList] = useState(getInitialMasterList);
  const [items, setItems] = useState(getInitialItems);
  const [favorites, setFavorites] = useState(getInitialFavorites);
  const [syncInfo, setSyncInfo] = useState(loadSyncData);
  const [dataVersion, setDataVersion] = useState(0); // Incrementa con cada cambio
  
  // Modo Baco - persistido en localStorage y sincronizado
  const [bacoMode, setBacoMode] = useState(() => {
    try {
      // Primero intentar cargar desde la DB principal (sincronizada)
      const db = loadDb();
      if (db && typeof db.bacoMode === 'boolean') {
        return db.bacoMode;
      }
      // Fallback a la clave antigua
      return localStorage.getItem('casilisto_baco_mode') === 'true';
    } catch {
      return false;
    }
  });

  // Persistir Modo Baco
  useEffect(() => {
    try {
      localStorage.setItem('casilisto_baco_mode', bacoMode.toString());
    } catch (e) {
      console.error('Error guardando modo baco', e);
    }
  }, [bacoMode]);

  // Persistir cambios en localStorage
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const payload = { 
        items, 
        categories, 
        masterList, 
        favorites,
        bacoMode,
        lastModified: Date.now()
      };
      localStorage.setItem(DB_KEY, JSON.stringify(payload));
      
      // Marcar que hay cambios pendientes si está vinculado
      if (syncInfo.userCode) {
        const newSyncInfo = { ...syncInfo, pendingChanges: true };
        setSyncInfo(newSyncInfo);
        saveSyncData(newSyncInfo);
      }
    } catch (e) {
      console.error('Error guardando base de datos local', e);
    }
  }, [items, categories, masterList, favorites, bacoMode]);

  // Función para actualizar datos de sync
  const updateSyncInfo = (updates) => {
    const newSyncInfo = { ...syncInfo, ...updates };
    setSyncInfo(newSyncInfo);
    saveSyncData(newSyncInfo);
  };

  // Función para obtener datos actuales para sync
  const getDataForSync = () => ({
    items,
    categories,
    masterList,
    favorites,
    bacoMode
  });

  // Función para aplicar datos del servidor
  // IMPORTANTE: Nunca sobrescribir con datos vacíos
  const applyServerData = (serverData) => {
    // Solo aplicar items si hay al menos uno
    if (serverData.items && Array.isArray(serverData.items) && serverData.items.length > 0) {
      setItems(normalizeItemList(serverData.items));
    }
    // Solo aplicar categories si hay al menos una
    if (serverData.categories && typeof serverData.categories === 'object' && Object.keys(serverData.categories).length > 0) {
      setCategories(normalizeCategoryMap(serverData.categories));
    }
    // Solo aplicar masterList si hay al menos uno
    if (serverData.masterList && Array.isArray(serverData.masterList) && serverData.masterList.length > 0) {
      setMasterList(normalizeItemList(serverData.masterList));
    }
    // Favoritos pueden estar vacíos, eso es válido
    if (serverData.favorites && Array.isArray(serverData.favorites)) {
      setFavorites(normalizeItemList(serverData.favorites));
    }
    // Sincronizar modo Baco
    if (typeof serverData.bacoMode === 'boolean') {
      setBacoMode(serverData.bacoMode);
    }
    setDataVersion(v => v + 1);
  };

  // Obtener lastModified de localStorage
  const getLastModified = () => {
    const db = loadDb();
    return db?.lastModified || 0;
  };

  return {
    categories,
    setCategories,
    masterList,
    setMasterList,
    items,
    setItems,
    favorites,
    setFavorites,
    normalizeCategoryName,
    // Modo Baco
    bacoMode,
    setBacoMode,
    // Nuevas propiedades para sync
    syncInfo,
    updateSyncInfo,
    getDataForSync,
    applyServerData,
    getLastModified,
    dataVersion,
  };
}

export default useLocalDb;
