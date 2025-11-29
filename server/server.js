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
  getLastUpdated
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '5mb' }));

// Logging simple
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
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
    
    registerDevice(normalizedCode, deviceId, deviceName || 'Dispositivo desconocido');
    const data = getSyncData(normalizedCode);
    
    console.log(`Dispositivo ${deviceId} vinculado a cuenta ${normalizedCode}`);
    res.json({ success: true, code: normalizedCode, data });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ success: false, error: 'Error vinculando dispositivo' });
  }
});

// Push datos
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
    
    registerDevice(normalizedCode, deviceId, deviceName || 'Dispositivo');
    const serverUpdatedAt = getLastUpdated(normalizedCode);
    
    if (localUpdatedAt >= serverUpdatedAt) {
      saveSyncData(normalizedCode, data);
      console.log(`Sync push: ${normalizedCode} desde ${deviceId}`);
      res.json({ success: true, serverUpdatedAt: Date.now() });
    } else {
      const serverData = getSyncData(normalizedCode);
      res.json({ success: true, conflict: true, serverData, serverUpdatedAt });
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
    
    registerDevice(normalizedCode, deviceId, deviceName || 'Dispositivo');
    
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
      console.log(`Dispositivo ${deviceId} desvinculado de ${normalizedCode}`);
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
