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

export function useSync({ syncInfo, updateSyncInfo, getDataForSync, applyServerData, getLastModified, dataVersion }) {
  const [status, setStatus] = useState(SyncStatus.DISCONNECTED);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(syncInfo?.lastSyncAt || 0);
  
  const syncInProgress = useRef(false);
  const syncTimeout = useRef(null);

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
    }, 3000);

    return () => {
      if (syncTimeout.current) {
        clearTimeout(syncTimeout.current);
      }
    };
  }, [dataVersion, syncInfo?.userCode, isOnline]);

  // Polling cada 60 segundos para obtener cambios de otros dispositivos
  useEffect(() => {
    if (!syncInfo?.userCode || !isOnline) return;

    const interval = setInterval(() => {
      pullFromServer();
    }, 60000);

    return () => clearInterval(interval);
  }, [syncInfo?.userCode, isOnline]);

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
        // Primero subir datos locales al servidor ANTES de cualquier otra cosa
        // Esto asegura que los datos locales no se pierdan
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
          console.warn('Error subiendo datos iniciales, continuando...');
        }

        // Ahora guardar código localmente
        updateSyncInfo({
          userCode: data.code,
          lastSyncAt: Date.now(),
          pendingChanges: false
        });

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

    if (!code || code.length !== 6) {
      setError('Código inválido');
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

  // Enviar datos al servidor
  const pushToServer = useCallback(async (codeOverride = null) => {
    const code = codeOverride || syncInfo?.userCode;
    if (!code || syncInProgress.current) return false;

    if (!isOnline) {
      // Guardar en cola offline
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
      }

      updateSyncInfo({
        lastSyncAt: Date.now(),
        pendingChanges: false
      });

      setLastSyncTime(Date.now());
      setStatus(SyncStatus.ONLINE);
      setError(null);
      return true;
    } catch (err) {
      console.error('Error en push:', err);
      setError(err.message);
      setStatus(SyncStatus.ERROR);
      return false;
    } finally {
      syncInProgress.current = false;
    }
  }, [syncInfo, isOnline, getDataForSync, getLastModified, applyServerData, updateSyncInfo]);

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
  }, [syncInfo, isOnline, lastSyncTime, applyServerData, updateSyncInfo]);

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
    pullFromServer,
    fetchDevices,
    unlinkDevice,
    disconnect,
    clearError: () => setError(null)
  };
}

export default useSync;
