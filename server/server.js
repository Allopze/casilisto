/**
 * Servidor unificado para CasiListo
 * Sirve el frontend estático Y la API desde el mismo puerto
 */
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  createUser,
  userExists,
  registerDevice,
  getDevices,
  unlinkDevice,
  saveSyncData,
  getSyncData,
  getLastUpdated,
  cleanupInactiveDevices,
  mergeItems,
  mergeCategories,
  mergeFavorites
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// P2: Rate limiting simple en memoria
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMIT_MAX = 100; // 100 requests por minuto por IP

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return next();
  }
  
  const data = rateLimitMap.get(ip);
  
  // Reset window si ha pasado
  if (now - data.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return next();
  }
  
  // Incrementar contador
  data.count++;
  
  if (data.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ 
      success: false, 
      error: 'Demasiadas peticiones. Espera un minuto.' 
    });
  }
  
  next();
}

// Limpiar rate limit map cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 300000);

// P1: Limpiar dispositivos inactivos cada 24 horas
setInterval(() => {
  const cleaned = cleanupInactiveDevices();
  if (cleaned > 0) {
    console.log(`Limpieza: ${cleaned} dispositivos inactivos eliminados`);
  }
}, 24 * 60 * 60 * 1000);

// Limpiar una vez al iniciar también
cleanupInactiveDevices();

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(rateLimit); // P2: Aplicar rate limiting

// Logging simple (P3: Solo en desarrollo)
const isDev = process.env.NODE_ENV !== 'production';
app.use((req, res, next) => {
  if (isDev) {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// ============================================
// API ENDPOINTS
// ============================================

// Crear nueva cuenta
app.post('/api/user/create', (req, res) => {
  try {
    const code = createUser();
    console.log(`Nueva cuenta creada: ${code}`);
    res.json({ success: true, code });
  } catch (err) {
    console.error('Error creando usuario:', err);
    res.status(500).json({ success: false, error: 'Error creando cuenta' });
  }
});

// Vincular dispositivo
app.post('/api/user/login', (req, res) => {
  try {
    const { code, deviceId, deviceName } = req.body;
    
    if (!code || !deviceId) {
      return res.status(400).json({ success: false, error: 'Código y deviceId requeridos' });
    }
    
    const normalizedCode = code.toUpperCase().trim();
    
    if (!userExists(normalizedCode)) {
      return res.status(404).json({ success: false, error: 'Código no encontrado' });
    }
    
    try {
      registerDevice(normalizedCode, deviceId, deviceName || 'Dispositivo desconocido');
    } catch (err) {
      if (err.message.includes('Límite de dispositivos')) {
        return res.status(400).json({ success: false, error: err.message });
      }
      throw err;
    }
    
    const data = getSyncData(normalizedCode);
    
    if (isDev) {
      console.log(`Dispositivo ${deviceId} vinculado a cuenta ${normalizedCode}`);
    }
    res.json({ success: true, code: normalizedCode, data });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ success: false, error: 'Error vinculando dispositivo' });
  }
});

// Push datos
// P1: Implementar merge inteligente en lugar de "gana el más reciente"
// P2: Usar timestamp del servidor como fuente de verdad
app.post('/api/sync/push', (req, res) => {
  try {
    const { code, deviceId, deviceName, data, localUpdatedAt } = req.body;
    
    if (!code || !deviceId || !data) {
      return res.status(400).json({ success: false, error: 'Datos incompletos' });
    }
    
    const normalizedCode = code.toUpperCase().trim();
    
    if (!userExists(normalizedCode)) {
      return res.status(404).json({ success: false, error: 'Código no encontrado' });
    }
    
    try {
      registerDevice(normalizedCode, deviceId, deviceName || 'Dispositivo');
    } catch (err) {
      if (err.message.includes('Límite de dispositivos')) {
        return res.status(400).json({ success: false, error: err.message });
      }
      throw err;
    }
    
    const serverData = getSyncData(normalizedCode);
    const serverUpdatedAt = getLastUpdated(normalizedCode);
    
    // P2: El servidor genera el timestamp (fuente de verdad)
    const serverTimestamp = Date.now();
    
    // P1: Merge inteligente si hay datos en ambos lados
    if (serverData && serverData.items && serverData.items.length > 0) {
      // Hay datos en el servidor - hacer merge
      const mergedData = {
        items: mergeItems(serverData.items || [], data.items || []),
        categories: mergeCategories(serverData.categories || {}, data.categories || {}),
        masterList: mergeItems(serverData.masterList || [], data.masterList || []),
        favorites: mergeFavorites(serverData.favorites || [], data.favorites || []),
        bacoMode: data.bacoMode !== undefined ? data.bacoMode : serverData.bacoMode
      };
      
      saveSyncData(normalizedCode, mergedData);
      
      if (isDev) {
        console.log(`Sync push (merge): ${normalizedCode} desde ${deviceId}`);
      }
      
      res.json({ 
        success: true, 
        serverUpdatedAt: serverTimestamp,
        merged: true,
        mergedData // Devolver datos mergeados para que el cliente se sincronice
      });
    } else {
      // No hay datos en servidor, aceptar datos del cliente
      saveSyncData(normalizedCode, data);
      
      if (isDev) {
        console.log(`Sync push: ${normalizedCode} desde ${deviceId}`);
      }
      
      res.json({ success: true, serverUpdatedAt: serverTimestamp });
    }
  } catch (err) {
    console.error('Error en push:', err);
    res.status(500).json({ success: false, error: 'Error sincronizando' });
  }
});

// Pull datos
app.get('/api/sync/pull', (req, res) => {
  try {
    const { code, deviceId, deviceName, since } = req.query;
    
    if (!code || !deviceId) {
      return res.status(400).json({ success: false, error: 'Código y deviceId requeridos' });
    }
    
    const normalizedCode = code.toUpperCase().trim();
    
    if (!userExists(normalizedCode)) {
      return res.status(404).json({ success: false, error: 'Código no encontrado' });
    }
    
    try {
      registerDevice(normalizedCode, deviceId, deviceName || 'Dispositivo');
    } catch (err) {
      if (err.message.includes('Límite de dispositivos')) {
        return res.status(400).json({ success: false, error: err.message });
      }
      throw err;
    }
    
    const serverUpdatedAt = getLastUpdated(normalizedCode);
    const sinceTimestamp = parseInt(since) || 0;
    
    if (serverUpdatedAt > sinceTimestamp) {
      const data = getSyncData(normalizedCode);
      res.json({ success: true, data, serverUpdatedAt, hasChanges: true });
    } else {
      res.json({ success: true, hasChanges: false, serverUpdatedAt });
    }
  } catch (err) {
    console.error('Error en pull:', err);
    res.status(500).json({ success: false, error: 'Error obteniendo datos' });
  }
});

// Listar dispositivos
app.get('/api/devices', (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ success: false, error: 'Código requerido' });
    }
    
    const normalizedCode = code.toUpperCase().trim();
    
    if (!userExists(normalizedCode)) {
      return res.status(404).json({ success: false, error: 'Código no encontrado' });
    }
    
    const devices = getDevices(normalizedCode);
    res.json({ success: true, devices });
  } catch (err) {
    console.error('Error listando dispositivos:', err);
    res.status(500).json({ success: false, error: 'Error obteniendo dispositivos' });
  }
});

// Desvincular dispositivo
app.delete('/api/devices/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ success: false, error: 'Código requerido' });
    }
    
    const normalizedCode = code.toUpperCase().trim();
    
    if (!userExists(normalizedCode)) {
      return res.status(404).json({ success: false, error: 'Código no encontrado' });
    }
    
    const unlinked = unlinkDevice(normalizedCode, deviceId);
    
    if (unlinked) {
      if (isDev) {
        console.log(`Dispositivo ${deviceId} desvinculado de ${normalizedCode}`);
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Dispositivo no encontrado' });
    }
  } catch (err) {
    console.error('Error desvinculando:', err);
    res.status(500).json({ success: false, error: 'Error desvinculando dispositivo' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ============================================
// FRONTEND ESTÁTICO
// ============================================

// Servir archivos estáticos
app.use(express.static(__dirname));

// SPA fallback - todas las rutas no-API van a index.html
app.get('*', (req, res) => {
  // Si es una ruta de API que no existe, devolver 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  // Para cualquier otra ruta, servir index.html (SPA)
  res.sendFile(join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     CasiListo Server                      ║
║     Puerto: ${PORT}                           ║
║     http://localhost:${PORT}                  ║
╚═══════════════════════════════════════════╝
  `);
});
