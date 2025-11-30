import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'casilisto.db'));

// Habilitar WAL mode para mejor rendimiento
db.pragma('journal_mode = WAL');

// Crear tablas
db.exec(`
  -- Usuarios (solo código de 6 dígitos)
  CREATE TABLE IF NOT EXISTS users (
    code TEXT PRIMARY KEY,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  );

  -- Dispositivos vinculados a un usuario
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_code TEXT NOT NULL,
    name TEXT NOT NULL,
    last_seen INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_code) REFERENCES users(code) ON DELETE CASCADE
  );

  -- Datos sincronizados (JSON completo por usuario)
  -- P0: Añadida columna baco_mode para sincronizar Modo Baco
  CREATE TABLE IF NOT EXISTS sync_data (
    user_code TEXT PRIMARY KEY,
    items TEXT DEFAULT '[]',
    categories TEXT DEFAULT '{}',
    master_list TEXT DEFAULT '[]',
    favorites TEXT DEFAULT '[]',
    baco_mode INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_code) REFERENCES users(code) ON DELETE CASCADE
  );

  -- Índices
  CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_code);
`);

// P0: Migrar tablas existentes para añadir baco_mode si no existe
try {
  db.exec(`ALTER TABLE sync_data ADD COLUMN baco_mode INTEGER DEFAULT 0`);
} catch (e) {
  // Columna ya existe, ignorar
}

// Generar código aleatorio de 6 caracteres (letras mayúsculas y números)
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Crear nuevo usuario
export function createUser() {
  const insertUser = db.prepare('INSERT INTO users (code) VALUES (?)');
  const insertSyncData = db.prepare('INSERT INTO sync_data (user_code) VALUES (?)');
  
  let code;
  let attempts = 0;
  
  while (attempts < 10) {
    code = generateCode();
    try {
      insertUser.run(code);
      insertSyncData.run(code);
      return code;
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        attempts++;
        continue;
      }
      throw err;
    }
  }
  
  throw new Error('No se pudo generar un código único');
}

// Verificar si usuario existe
export function userExists(code) {
  const stmt = db.prepare('SELECT code FROM users WHERE code = ?');
  return stmt.get(code) !== undefined;
}

// Registrar/actualizar dispositivo
// P2: Limitar a 10 dispositivos por cuenta
export function registerDevice(userCode, deviceId, deviceName) {
  // Verificar cuántos dispositivos tiene el usuario
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM devices WHERE user_code = ?');
  const { count } = countStmt.get(userCode);
  
  // Verificar si el dispositivo ya existe
  const existsStmt = db.prepare('SELECT id FROM devices WHERE id = ?');
  const exists = existsStmt.get(deviceId);
  
  if (!exists && count >= 10) {
    throw new Error('Límite de dispositivos alcanzado (máximo 10)');
  }
  
  const upsert = db.prepare(`
    INSERT INTO devices (id, user_code, name, last_seen)
    VALUES (?, ?, ?, strftime('%s', 'now') * 1000)
    ON CONFLICT(id) DO UPDATE SET
      last_seen = strftime('%s', 'now') * 1000,
      name = excluded.name
  `);
  upsert.run(deviceId, userCode, deviceName);
}

// Obtener dispositivos de un usuario
export function getDevices(userCode) {
  const stmt = db.prepare(`
    SELECT id, name, last_seen, created_at
    FROM devices
    WHERE user_code = ?
    ORDER BY last_seen DESC
  `);
  return stmt.all(userCode);
}

// Desvincular dispositivo
export function unlinkDevice(userCode, deviceId) {
  const stmt = db.prepare('DELETE FROM devices WHERE id = ? AND user_code = ?');
  const result = stmt.run(deviceId, userCode);
  return result.changes > 0;
}

// Guardar datos sincronizados
// P0: Incluir bacoMode en el guardado
export function saveSyncData(userCode, data) {
  const stmt = db.prepare(`
    UPDATE sync_data
    SET items = ?,
        categories = ?,
        master_list = ?,
        favorites = ?,
        baco_mode = ?,
        updated_at = strftime('%s', 'now') * 1000
    WHERE user_code = ?
  `);
  
  stmt.run(
    JSON.stringify(data.items || []),
    JSON.stringify(data.categories || {}),
    JSON.stringify(data.masterList || []),
    JSON.stringify(data.favorites || []),
    data.bacoMode ? 1 : 0,
    userCode
  );
}

// Obtener datos sincronizados
// P0: Incluir bacoMode en la respuesta
export function getSyncData(userCode) {
  const stmt = db.prepare(`
    SELECT items, categories, master_list, favorites, baco_mode, updated_at
    FROM sync_data
    WHERE user_code = ?
  `);
  
  const row = stmt.get(userCode);
  if (!row) return null;
  
  return {
    items: JSON.parse(row.items),
    categories: JSON.parse(row.categories),
    masterList: JSON.parse(row.master_list),
    favorites: JSON.parse(row.favorites),
    bacoMode: row.baco_mode === 1,
    updatedAt: row.updated_at
  };
}

// Obtener timestamp de última actualización
export function getLastUpdated(userCode) {
  const stmt = db.prepare('SELECT updated_at FROM sync_data WHERE user_code = ?');
  const row = stmt.get(userCode);
  return row ? row.updated_at : 0;
}

// P1: Limpiar dispositivos inactivos (más de 30 días sin conectarse)
export function cleanupInactiveDevices() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const stmt = db.prepare('DELETE FROM devices WHERE last_seen < ?');
  const result = stmt.run(thirtyDaysAgo);
  return result.changes;
}

// P1: Merge inteligente de items (preserva cambios de ambos lados)
export function mergeItems(serverItems, clientItems) {
  const merged = new Map();
  
  // Primero añadir todos los items del servidor
  for (const item of serverItems) {
    merged.set(item.id, { ...item, source: 'server' });
  }
  
  // Luego procesar items del cliente
  for (const item of clientItems) {
    const existing = merged.get(item.id);
    if (!existing) {
      // Item nuevo del cliente, añadir
      merged.set(item.id, { ...item, source: 'client' });
    } else {
      // Item existe en ambos - comparar por algún criterio
      // Por ahora, el cliente gana si hay conflicto (ya que tiene los cambios más recientes del usuario)
      merged.set(item.id, { ...item, source: 'merged' });
    }
  }
  
  // Eliminar el campo source antes de devolver
  return Array.from(merged.values()).map(({ source, ...item }) => item);
}

// P1: Merge inteligente de categorías
export function mergeCategories(serverCats, clientCats) {
  return { ...serverCats, ...clientCats };
}

// P1: Merge inteligente de favoritos
export function mergeFavorites(serverFavs, clientFavs) {
  const merged = new Map();
  
  for (const fav of serverFavs) {
    merged.set(fav.text.toLowerCase(), fav);
  }
  
  for (const fav of clientFavs) {
    merged.set(fav.text.toLowerCase(), fav);
  }
  
  return Array.from(merged.values());
}

export default db;
