/**
 * Hook para sincronización con el servidor.
 * Maneja: crear cuenta, vincular dispositivo, push/pull datos, listar/desvincular dispositivos.
 * Soporta modo offline con cola de sincronización.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiBase } from '../utils/platform';

const API_BASE = getApiBase();

// Estados de conexión
export const SyncStatus = {
  DISCONNECTED: 'disconnected',   // Sin cuenta vinculada
  ONLINE: 'online',               // Conectado y sincronizado
  SYNCING: 'syncing',             // Sincronizando ahora
  OFFLINE: 'offline',             // Sin conexión a internet
  PENDING: 'pending',             // Cambios pendientes por sincronizar
  ERROR: 'error'                  // Error de sincronización
};

export function useSync({ syncInfo, updateSyncInfo, getDataForSync, applyServerData, getLastModified, dataVersion, onRemoteChanges }) {
  const [status, setStatus] = useState(SyncStatus.DISCONNECTED);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(syncInfo?.lastSyncAt || 0);
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  
  const syncInProgress = useRef(false);
  const syncTimeout = useRef(null);
  const retryCount = useRef(0);
  const maxRetries = 4; // 1s, 2s, 4s, 8s

  // Detectar cambios en conexión
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sincronizar inmediatamente al reconectar
      if (syncInfo?.userCode) {
        syncNow();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      if (syncInfo?.userCode) {
        setStatus(SyncStatus.OFFLINE);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncInfo?.userCode]);

  // P1: Page Visibility API para pausar polling en background y hacer flush
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      
      if (!visible && syncInfo?.userCode && syncInfo?.pendingChanges) {
        // App va a background con cambios pendientes - intentar sync inmediato
        pushToServerImmediate();
      } else if (visible && syncInfo?.userCode && isOnline) {
        // App vuelve a foreground - pull para obtener cambios de otros dispositivos
        pullFromServer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [syncInfo?.userCode, syncInfo?.pendingChanges, isOnline]);

  // P1: Flush en beforeunload para no perder cambios al cerrar
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (syncInfo?.userCode && syncInfo?.pendingChanges && isOnline) {
        // Usar sendBeacon para envío asíncrono que sobrevive al cierre
        const data = JSON.stringify({
          code: syncInfo.userCode,
          deviceId: syncInfo.deviceId,
          deviceName: syncInfo.deviceName,
          data: getDataForSync(),
          localUpdatedAt: getLastModified()
        });
        navigator.sendBeacon(`${API_BASE}/api/sync/push`, new Blob([data], { type: 'application/json' }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncInfo, isOnline, getDataForSync, getLastModified]);

  // Actualizar estado inicial
  useEffect(() => {
    if (!syncInfo?.userCode) {
      setStatus(SyncStatus.DISCONNECTED);
    } else if (!isOnline) {
      setStatus(SyncStatus.OFFLINE);
    } else if (syncInfo?.pendingChanges) {
      setStatus(SyncStatus.PENDING);
    } else {
      setStatus(SyncStatus.ONLINE);
    }
  }, [syncInfo?.userCode, syncInfo?.pendingChanges, isOnline]);

  // Auto-sync con debounce cuando hay cambios
  useEffect(() => {
    if (!syncInfo?.userCode || !isOnline) return;
    
    // Debounce: esperar 3 segundos después del último cambio
    if (syncTimeout.current) {
      clearTimeout(syncTimeout.current);
    }
    
    syncTimeout.current = setTimeout(() => {
      pushToServer();
    }, 1000); // Reducido de 3s a 1s para evitar pérdida de datos

    return () => {
      if (syncTimeout.current) {
        clearTimeout(syncTimeout.current);
      }
    };
  }, [dataVersion, syncInfo?.userCode, isOnline]);

  // Polling cada 60 segundos para obtener cambios de otros dispositivos
  // P1: Solo cuando la página está visible (Page Visibility API)
  useEffect(() => {
    if (!syncInfo?.userCode || !isOnline || !isPageVisible) return;

    const interval = setInterval(() => {
      pullFromServer();
    }, 60000);

    return () => clearInterval(interval);
  }, [syncInfo?.userCode, isOnline, isPageVisible]);

  // Crear nueva cuenta
  const createAccount = useCallback(async () => {
    if (!isOnline) {
      setError('Sin conexión a internet');
      return null;
    }

    try {
      setStatus(SyncStatus.SYNCING);
      setError(null);

      const response = await fetch(`${API_BASE}/api/user/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Error creando cuenta');
      }

      const data = await response.json();
      
      if (data.success && data.code) {
        // CRÍTICO: Guardar userCode PRIMERO para evitar race condition
        // Si el usuario cierra la app inmediatamente, no perderá la vinculación
        updateSyncInfo({
          userCode: data.code,
          lastSyncAt: Date.now(),
          pendingChanges: true  // Marcar como pendiente hasta que se suba
        });

        // Ahora subir datos locales al servidor
        const pushResponse = await fetch(`${API_BASE}/api/sync/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: data.code,
            deviceId: syncInfo.deviceId,
            deviceName: syncInfo.deviceName,
            data: getDataForSync(),
            localUpdatedAt: Date.now()
          })
        });

        if (!pushResponse.ok) {
          console.warn('Error subiendo datos iniciales, se reintentará...');
        } else {
          // Solo marcar como sincronizado si el push fue exitoso
          updateSyncInfo({
            lastSyncAt: Date.now(),
            pendingChanges: false
          });
        }

        // Registrar dispositivo (sin aplicar datos del servidor)
        await fetch(`${API_BASE}/api/user/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: data.code,
            deviceId: syncInfo.deviceId,
            deviceName: syncInfo.deviceName
          })
        });
        
        setStatus(SyncStatus.ONLINE);
        setLastSyncTime(Date.now());
        return data.code;
      }

      throw new Error('Respuesta inválida del servidor');
    } catch (err) {
      console.error('Error creando cuenta:', err);
      setError(err.message);
      setStatus(SyncStatus.ERROR);
      return null;
    }
  }, [isOnline, syncInfo, updateSyncInfo, getDataForSync]);

  // Vincular dispositivo con código existente
  const linkDevice = useCallback(async (code) => {
    if (!isOnline) {
      setError('Sin conexión a internet');
      return false;
    }

    // Validar formato: solo mayúsculas y números permitidos en el generador
    const codeRegex = /^[A-Z2-9]{6}$/;
    if (!code || !codeRegex.test(code.toUpperCase().trim())) {
      setError('Código inválido. Debe ser 6 caracteres (letras A-Z sin I,O y números 2-9)');
      return false;
    }

    try {
      setStatus(SyncStatus.SYNCING);
      setError(null);

      const response = await fetch(`${API_BASE}/api/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase(),
          deviceId: syncInfo.deviceId,
          deviceName: syncInfo.deviceName
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Código no encontrado');
      }

      if (data.success) {
        updateSyncInfo({
          userCode: data.code,
          lastSyncAt: Date.now(),
          pendingChanges: false
        });

        // Aplicar datos del servidor si existen
        if (data.data && data.data.items && data.data.items.length > 0) {
          applyServerData(data.data);
        } else {
          // Si el servidor está vacío, subir datos locales
          await pushToServer(data.code);
        }

        setStatus(SyncStatus.ONLINE);
        setLastSyncTime(Date.now());
        await fetchDevices(data.code);
        return true;
      }

      throw new Error('Error vinculando dispositivo');
    } catch (err) {
      console.error('Error vinculando:', err);
      setError(err.message);
      setStatus(SyncStatus.ERROR);
      return false;
    }
  }, [isOnline, syncInfo, updateSyncInfo, applyServerData]);

  // Login interno (registra dispositivo)
  const loginWithCode = async (code) => {
    const response = await fetch(`${API_BASE}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        deviceId: syncInfo.deviceId,
        deviceName: syncInfo.deviceName
      })
    });
    return response.json();
  };

  // Enviar datos al servidor (con retry exponencial)
  const pushToServer = useCallback(async (codeOverride = null) => {
    const code = codeOverride || syncInfo?.userCode;
    if (!code || syncInProgress.current) return false;

    if (!isOnline) {
      // P0: Encolar en Service Worker para Background Sync
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'QUEUE_SYNC',
          request: {
            url: `${API_BASE}/api/sync/push`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              deviceId: syncInfo.deviceId,
              deviceName: syncInfo.deviceName,
              data: getDataForSync(),
              localUpdatedAt: getLastModified()
            })
          }
        });
      }
      updateSyncInfo({ pendingChanges: true });
      setStatus(SyncStatus.OFFLINE);
      return false;
    }

    try {
      syncInProgress.current = true;
      setStatus(SyncStatus.SYNCING);

      const response = await fetch(`${API_BASE}/api/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          deviceId: syncInfo.deviceId,
          deviceName: syncInfo.deviceName,
          data: getDataForSync(),
          localUpdatedAt: getLastModified()
        })
      });

      if (!response.ok) {
        throw new Error('Error sincronizando');
      }

      const result = await response.json();

      if (result.conflict && result.serverData) {
        // El servidor tiene datos más recientes
        applyServerData(result.serverData);
        // P1: Notificar al usuario de cambios remotos
        if (onRemoteChanges) {
          onRemoteChanges('Datos actualizados desde otro dispositivo');
        }
      }

      updateSyncInfo({
        lastSyncAt: Date.now(),
        pendingChanges: false
      });

      setLastSyncTime(Date.now());
      setStatus(SyncStatus.ONLINE);
      setError(null);
      retryCount.current = 0; // Reset retry count on success
      return true;
    } catch (err) {
      console.error('Error en push:', err);
      setError(err.message);
      setStatus(SyncStatus.ERROR);
      
      // P2: Retry con backoff exponencial
      if (retryCount.current < maxRetries) {
        const delay = Math.pow(2, retryCount.current) * 1000; // 1s, 2s, 4s, 8s
        retryCount.current++;
        setTimeout(() => {
          syncInProgress.current = false;
          pushToServer(codeOverride);
        }, delay);
      }
      return false;
    } finally {
      syncInProgress.current = false;
    }
  }, [syncInfo, isOnline, getDataForSync, getLastModified, applyServerData, updateSyncInfo, onRemoteChanges]);

  // Push inmediato sin debounce (para visibility change / beforeunload)
  const pushToServerImmediate = useCallback(async () => {
    if (!syncInfo?.userCode || !isOnline) return false;
    if (syncTimeout.current) {
      clearTimeout(syncTimeout.current);
      syncTimeout.current = null;
    }
    return pushToServer();
  }, [syncInfo?.userCode, isOnline, pushToServer]);

  // Obtener datos del servidor
  const pullFromServer = useCallback(async () => {
    if (!syncInfo?.userCode || !isOnline || syncInProgress.current) return false;

    try {
      syncInProgress.current = true;
      
      const params = new URLSearchParams({
        code: syncInfo.userCode,
        deviceId: syncInfo.deviceId,
        deviceName: syncInfo.deviceName,
        since: lastSyncTime.toString()
      });

      const response = await fetch(`${API_BASE}/api/sync/pull?${params}`);

      if (!response.ok) {
        throw new Error('Error obteniendo datos');
      }

      const result = await response.json();

      if (result.hasChanges && result.data) {
        applyServerData(result.data);
        setLastSyncTime(result.serverUpdatedAt);
        updateSyncInfo({
          lastSyncAt: Date.now(),
          pendingChanges: false
        });
        // P1: Notificar al usuario que hay cambios de otro dispositivo
        if (onRemoteChanges) {
          onRemoteChanges('Lista actualizada desde otro dispositivo');
        }
      }

      setStatus(SyncStatus.ONLINE);
      return true;
    } catch (err) {
      console.error('Error en pull:', err);
      // No mostrar error para pulls silenciosos
      return false;
    } finally {
      syncInProgress.current = false;
    }
  }, [syncInfo, isOnline, lastSyncTime, applyServerData, updateSyncInfo, onRemoteChanges]);

  // Sincronizar ahora (push + pull)
  const syncNow = useCallback(async () => {
    if (!syncInfo?.userCode || !isOnline) return false;
    
    setStatus(SyncStatus.SYNCING);
    const pushOk = await pushToServer();
    const pullOk = await pullFromServer();
    
    if (pushOk || pullOk) {
      setStatus(SyncStatus.ONLINE);
    }
    
    return pushOk || pullOk;
  }, [syncInfo?.userCode, isOnline, pushToServer, pullFromServer]);

  // Obtener lista de dispositivos
  const fetchDevices = useCallback(async (codeOverride = null) => {
    const code = codeOverride || syncInfo?.userCode;
    if (!code || !isOnline) return [];

    try {
      const response = await fetch(`${API_BASE}/api/devices?code=${code}`);
      
      if (!response.ok) {
        throw new Error('Error obteniendo dispositivos');
      }

      const data = await response.json();
      
      if (data.success) {
        setDevices(data.devices || []);
        return data.devices;
      }

      return [];
    } catch (err) {
      console.error('Error listando dispositivos:', err);
      return [];
    }
  }, [syncInfo?.userCode, isOnline]);

  // Desvincular un dispositivo
  const unlinkDevice = useCallback(async (deviceId) => {
    if (!syncInfo?.userCode || !isOnline) return false;

    try {
      const response = await fetch(
        `${API_BASE}/api/devices/${deviceId}?code=${syncInfo.userCode}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Error desvinculando dispositivo');
      }

      // Si es el dispositivo actual, limpiar datos de sync local
      if (deviceId === syncInfo.deviceId) {
        updateSyncInfo({
          userCode: null,
          lastSyncAt: 0,
          pendingChanges: false
        });
        setStatus(SyncStatus.DISCONNECTED);
        setDevices([]);
      } else {
        // Actualizar lista de dispositivos
        await fetchDevices();
      }

      return true;
    } catch (err) {
      console.error('Error desvinculando:', err);
      setError(err.message);
      return false;
    }
  }, [syncInfo, isOnline, updateSyncInfo, fetchDevices]);

  // Desconectar cuenta (solo local, no borra del servidor)
  const disconnect = useCallback(() => {
    updateSyncInfo({
      userCode: null,
      lastSyncAt: 0,
      pendingChanges: false
    });
    setStatus(SyncStatus.DISCONNECTED);
    setDevices([]);
    setError(null);
  }, [updateSyncInfo]);

  // P2: Actualizar nombre del dispositivo
  const updateDeviceName = useCallback((newName) => {
    if (!newName || !newName.trim()) return;
    updateSyncInfo({ deviceName: newName.trim() });
    // Actualizar en servidor si está vinculado
    if (syncInfo?.userCode && isOnline) {
      fetchDevices(); // Refrescar lista con nuevo nombre
    }
  }, [syncInfo?.userCode, isOnline, updateSyncInfo, fetchDevices]);

  // Cargar dispositivos al montar si hay cuenta
  useEffect(() => {
    if (syncInfo?.userCode && isOnline) {
      fetchDevices();
    }
  }, [syncInfo?.userCode, isOnline]);

  return {
    // Estado
    status,
    isOnline,
    devices,
    error,
    lastSyncTime,
    userCode: syncInfo?.userCode,
    deviceId: syncInfo?.deviceId,
    deviceName: syncInfo?.deviceName,
    
    // Acciones
    createAccount,
    linkDevice,
    syncNow,
    pushToServer,
    pushToServerImmediate,
    pullFromServer,
    fetchDevices,
    unlinkDevice,
    disconnect,
    updateDeviceName,
    clearError: () => setError(null)
  };
}

export default useSync;
