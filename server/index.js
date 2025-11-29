import express from 'express';
import cors from 'cors';
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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true, // Permitir cualquier origen (ajustar en producción si es necesario)
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

// Logging simple
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ============================================
// ENDPOINTS DE USUARIO
// ============================================

// Crear nueva cuenta (genera código de 6 dígitos)
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

// Vincular dispositivo con código existente
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
    
    // Registrar dispositivo
    registerDevice(normalizedCode, deviceId, deviceName || 'Dispositivo desconocido');
    
    // Obtener datos actuales
    const data = getSyncData(normalizedCode);
    
    console.log(`Dispositivo ${deviceId} vinculado a cuenta ${normalizedCode}`);
    res.json({ success: true, code: normalizedCode, data });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ success: false, error: 'Error vinculando dispositivo' });
  }
});

// ============================================
// ENDPOINTS DE SINCRONIZACIÓN
// ============================================

// Enviar datos al servidor
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
    
    // Actualizar último visto del dispositivo
    registerDevice(normalizedCode, deviceId, deviceName || 'Dispositivo');
    
    // Obtener timestamp del servidor
    const serverUpdatedAt = getLastUpdated(normalizedCode);
    
    // Si el cliente tiene datos más recientes, guardar
    // Si el servidor tiene datos más recientes, retornar conflicto
    if (localUpdatedAt >= serverUpdatedAt) {
      saveSyncData(normalizedCode, data);
      console.log(`Sync push: ${normalizedCode} desde ${deviceId}`);
      res.json({ success: true, serverUpdatedAt: Date.now() });
    } else {
      // Conflicto: servidor tiene datos más nuevos
      const serverData = getSyncData(normalizedCode);
      res.json({ 
        success: true, 
        conflict: true, 
        serverData,
        serverUpdatedAt 
      });
    }
  } catch (err) {
    console.error('Error en push:', err);
    res.status(500).json({ success: false, error: 'Error sincronizando' });
  }
});

// Obtener datos del servidor
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
    
    // Actualizar último visto
    registerDevice(normalizedCode, deviceId, deviceName || 'Dispositivo');
    
    const serverUpdatedAt = getLastUpdated(normalizedCode);
    const sinceTimestamp = parseInt(since) || 0;
    
    // Solo enviar datos si hay cambios desde 'since'
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

// ============================================
// ENDPOINTS DE DISPOSITIVOS
// ============================================

// Listar dispositivos vinculados
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

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     CasiListo Sync Server                 ║
║     Puerto: ${PORT}                           ║
║     http://localhost:${PORT}                  ║
╚═══════════════════════════════════════════╝
  `);
});
