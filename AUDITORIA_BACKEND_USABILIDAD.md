# 🔍 Auditoría de Usabilidad - Backend y Lógica Interna

**Fecha:** Noviembre 2025  
**Alcance:** Hooks, sincronización, persistencia, servidor, service worker, lógica de negocio  
**Tipo:** Bugs de usabilidad que afectan la experiencia pero no son visibles directamente en la UI

---

## 🔴 Prioridad Crítica (P0) - Pérdida de datos o mal funcionamiento severo

### 1. **Race condition en sincronización al crear cuenta**
- **Ubicación:** `useSync.js` - `createAccount()`
- **Problema:** Al crear una cuenta, se hace push de datos ANTES de que `updateSyncInfo` complete el guardado del `userCode` en localStorage. Si el usuario cierra la app inmediatamente, puede perder la vinculación pero sus datos ya están en el servidor.
- **Impacto:** Usuario cree que tiene cuenta pero al reabrir no está vinculado
- **Código problemático:**
```javascript
// Push se hace con data.code pero updateSyncInfo viene después
const pushResponse = await fetch(`${API_BASE}/api/sync/push`, { ... });
// ...después...
updateSyncInfo({ userCode: data.code, ... }); // ← Si falla esto, perdemos vinculación
```
- **Solución:** Usar transacción atómica o guardar `userCode` ANTES del push

### 2. **Colisión de IDs al añadir items simultáneamente**
- **Ubicación:** `App.jsx` - `addItem()` y `addFavoriteToList()`
- **Problema:** Los IDs de items se generan con `Date.now()`. Si dos dispositivos añaden items en el mismo milisegundo, habrá colisión de IDs.
- **Impacto:** Uno de los items se perderá o sobrescribirá al sincronizar
- **Código problemático:**
```javascript
const newItem = {
  id: Date.now(), // ← Colisión posible entre dispositivos
  text: newItemText.trim(),
  ...
};
```
- **Solución:** Usar UUIDs (crypto.randomUUID()) en lugar de timestamps

### 3. **Pérdida de datos offline: el Service Worker no encola operaciones de sync**
- **Ubicación:** `sw.js` y `useSync.js`
- **Problema:** Aunque el SW tiene código para cola de sync (`addToSyncQueue`), el hook `useSync` NUNCA envía mensajes al SW para encolar operaciones fallidas. Solo marca `pendingChanges: true` localmente.
- **Impacto:** Si el usuario hace cambios offline y cierra la app antes de reconectar, los cambios locales nunca se envían al servidor
- **Código problemático:**
```javascript
// useSync.js pushToServer():
if (!isOnline) {
  updateSyncInfo({ pendingChanges: true }); // Solo marca localmente
  setStatus(SyncStatus.OFFLINE);
  return false;
  // ← Nunca envía mensaje al SW para encolar!
}
```
- **Solución:** Integrar comunicación con SW para usar Background Sync API

### 4. **El servidor no persiste el campo `bacoMode`**
- **Ubicación:** `server/db.js` - `saveSyncData()` y `getSyncData()`
- **Problema:** El esquema de la base de datos y las funciones de sync NO incluyen `bacoMode`, aunque el cliente lo envía.
- **Impacto:** El Modo Baco no se sincroniza entre dispositivos; cada dispositivo tiene su propia configuración
- **Código problemático:**
```javascript
// db.js - saveSyncData no guarda bacoMode
stmt.run(
  JSON.stringify(data.items || []),
  JSON.stringify(data.categories || {}),
  JSON.stringify(data.masterList || []),
  JSON.stringify(data.favorites || []),
  // ← Falta: JSON.stringify(data.bacoMode)
  userCode
);
```
- **Solución:** Añadir columna `baco_mode` al esquema y actualizar funciones

---

## 🟡 Prioridad Alta (P1) - Comportamiento inesperado

### 5. **Debounce de 3 segundos causa pérdida de datos rápidos**
- **Ubicación:** `useSync.js` - auto-sync effect
- **Problema:** El debounce de 3 segundos para sincronizar significa que si el usuario hace cambios y cierra la app en menos de 3 segundos, esos cambios nunca se envían al servidor.
- **Impacto:** Cambios rápidos (marcar varios items como completados) pueden perderse
- **Código problemático:**
```javascript
syncTimeout.current = setTimeout(() => {
  pushToServer();
}, 3000); // ← 3 segundos es demasiado largo
```
- **Solución:** Reducir a 1 segundo y/o implementar flush on page visibility change (beforeunload)

### 6. **Conflicto de sincronización usa "gana el más reciente" sin merge**
- **Ubicación:** `server.js` - `/api/sync/push`
- **Problema:** La resolución de conflictos compara timestamps (`localUpdatedAt >= serverUpdatedAt`) y el más reciente sobrescribe todo. No hay merge inteligente de cambios.
- **Impacto:** Si dispositivo A añade "Leche" y dispositivo B añade "Pan" simultáneamente, uno de los dos items se pierde
- **Código problemático:**
```javascript
if (localUpdatedAt >= serverUpdatedAt) {
  saveSyncData(normalizedCode, data); // Sobrescribe TODO
} else {
  // Devuelve datos del servidor, cliente descarta cambios locales
}
```
- **Solución:** Implementar merge a nivel de items individuales usando IDs y timestamps por item

### 7. **Pull silencioso no notifica al usuario de cambios remotos**
- **Ubicación:** `useSync.js` - `pullFromServer()`
- **Problema:** Cuando se hace pull cada 60 segundos y hay cambios, se aplican silenciosamente sin notificar al usuario. Puede ser confuso si su lista cambia "mágicamente".
- **Impacto:** Usuario no entiende por qué su lista cambió de repente
- **Solución:** Mostrar Toast cuando se detectan cambios de otro dispositivo

### 8. **LocalStorage puede llenarse sin aviso**
- **Ubicación:** `useLocalDb.js` - efecto de persistencia
- **Problema:** No hay manejo de `QuotaExceededError` al guardar en localStorage. Con listas muy grandes o muchos datos de sync, puede fallar silenciosamente.
- **Impacto:** Datos no se persisten y usuario pierde cambios sin saberlo
- **Código problemático:**
```javascript
try {
  localStorage.setItem(DB_KEY, JSON.stringify(payload));
} catch (e) {
  console.error('Error guardando...'); // Solo log, sin notificar
}
```
- **Solución:** Detectar QuotaExceededError y mostrar modal de advertencia

### 9. **El polling de 60 segundos no se pausa cuando app está en background**
- **Ubicación:** `useSync.js` - polling effect
- **Problema:** El `setInterval` de 60 segundos sigue ejecutando pulls aunque la app esté en background/minimizada, gastando batería y datos.
- **Impacto:** Consumo innecesario de recursos en móviles
- **Solución:** Usar Page Visibility API para pausar polling cuando documento no es visible

### 10. **Dispositivo no se desvincula correctamente al borrar datos del navegador**
- **Ubicación:** Sistema de sync
- **Problema:** Si el usuario borra datos del navegador (Clear Storage), el deviceId se regenera pero el viejo sigue registrado en el servidor, apareciendo como dispositivo fantasma.
- **Impacto:** Lista de dispositivos muestra dispositivos "muertos" que nunca se conectarán
- **Solución:** Implementar limpieza automática de dispositivos inactivos > 30 días en el servidor

---

## 🟢 Prioridad Media (P2) - Mejoras de robustez

### 11. **No hay validación de datos del servidor antes de aplicar**
- **Ubicación:** `useLocalDb.js` - `applyServerData()`
- **Problema:** Se confía en que los datos del servidor son válidos. Si el servidor devuelve datos malformados, puede corromper el estado local.
- **Impacto:** App puede crashear o mostrar datos incorrectos
- **Código problemático:**
```javascript
if (serverData.items && Array.isArray(serverData.items) && serverData.items.length > 0) {
  setItems(normalizeItemList(serverData.items)); // ← No valida estructura de cada item
}
```
- **Solución:** Añadir validación de schema (cada item debe tener id, text, category, completed, quantity)

### 12. **El código de cuenta no valida formato antes de enviar**
- **Ubicación:** `useSync.js` - `linkDevice()`
- **Problema:** Solo valida longitud (`code.length !== 6`) pero no formato. Caracteres especiales o minúsculas pueden causar comportamiento inesperado.
- **Impacto:** Errores confusos si usuario copia código con espacios o caracteres incorrectos
- **Solución:** Validar con regex `/^[A-Z2-9]{6}$/` que coincide con los caracteres válidos del generador

### 13. **El Service Worker cachea assets indefinidamente sin límite**
- **Ubicación:** `sw.js`
- **Problema:** Los assets en `/assets/` se cachean con cache-first y nunca se limpian. Con muchas actualizaciones, el cache puede crecer indefinidamente.
- **Impacto:** Uso excesivo de almacenamiento del dispositivo
- **Solución:** Implementar límite de tamaño de cache o limpieza periódica

### 14. **No hay retry exponencial en errores de sync**
- **Ubicación:** `useSync.js` - `pushToServer()` y `pullFromServer()`
- **Problema:** Si una operación falla, se marca como error pero no hay reintento automático con backoff exponencial.
- **Impacto:** Un error temporal puede dejar al usuario desincronizado hasta que manualmente presione "Sincronizar ahora"
- **Solución:** Implementar retry con backoff: 1s, 2s, 4s, 8s...

### 15. **`detectDeviceName()` puede dar nombres muy genéricos**
- **Ubicación:** `useLocalDb.js`
- **Problema:** La detección de dispositivo da nombres como "Chrome en Windows" que no son únicos si el usuario tiene múltiples dispositivos similares.
- **Impacto:** Difícil distinguir entre dispositivos en la lista
- **Solución:** Permitir al usuario renombrar su dispositivo manualmente

### 16. **El timestamp de sincronización usa `Date.now()` que puede estar desincronizado**
- **Ubicación:** Todo el sistema de sync
- **Problema:** Se comparan timestamps de cliente y servidor, pero los relojes pueden estar desincronizados varios segundos/minutos.
- **Impacto:** Resolución incorrecta de conflictos si el reloj de un dispositivo está mal
- **Solución:** El servidor debería ser la única fuente de verdad para timestamps, o implementar NTP check

### 17. **No hay límite en el número de dispositivos vinculados**
- **Ubicación:** `server/db.js` - `registerDevice()`
- **Problema:** Un usuario puede vincular infinitos dispositivos, lo que podría ser abusado.
- **Impacto:** Potencial abuso del servicio
- **Solución:** Limitar a 10 dispositivos por cuenta

### 18. **La categoría "Otros" se puede crear duplicada por normalización**
- **Ubicación:** `useLocalDb.js` - normalización
- **Problema:** Si un usuario crea manualmente una categoría llamada exactamente "Otros", puede haber duplicados porque `DEFAULT_CATEGORIES` ya incluye "Otros".
- **Impacto:** Confusión con dos categorías "Otros" diferentes
- **Solución:** Prevenir creación de categorías con nombres reservados

### 19. **Los favoritos no se validan contra categorías existentes**
- **Ubicación:** `App.jsx` - `addFavoriteToList()`
- **Problema:** Un favorito guardado hace tiempo puede tener una categoría que ya fue eliminada. Aunque hay fallback a "Otros", no se actualiza el favorito.
- **Impacto:** Favorito sigue mostrando categoría inexistente en su metadata
- **Código problemático:**
```javascript
const category = categories[fav.category] ? fav.category : 'Otros';
// ← Usa 'Otros' pero no actualiza el favorito guardado
```
- **Solución:** Actualizar el favorito cuando se detecte categoría huérfana

### 20. **El servidor no tiene rate limiting**
- **Ubicación:** `server/server.js`
- **Problema:** No hay limitación de requests por IP o por cuenta. Un actor malicioso podría hacer DoS.
- **Impacto:** Seguridad y disponibilidad del servicio
- **Solución:** Implementar rate limiting (ej: 100 requests/minuto por IP)

---

## 🔵 Prioridad Baja (P3) - Nice to have

### 21. **El `console.error` en producción expone información de debug**
- **Ubicación:** Múltiples archivos
- **Problema:** Muchos `console.error()` se mantienen en producción, exponiendo detalles internos.
- **Solución:** Usar logger condicional que solo funcione en desarrollo

### 22. **No hay métricas ni logging de sincronizaciones fallidas**
- **Ubicación:** Sistema de sync
- **Problema:** No hay forma de saber cuántas sincronizaciones fallan o por qué.
- **Solución:** Implementar telemetría anónima opcional

### 23. **El SW no precachea iconos de la app**
- **Ubicación:** `sw.js` - `OFFLINE_URLS`
- **Problema:** Los iconos (icon.svg, favicons) no están en la lista de precache, pueden no estar disponibles offline.
- **Solución:** Añadir iconos a `OFFLINE_URLS`

### 24. **La migración de localStorage legacy no limpia claves viejas**
- **Ubicación:** `useLocalDb.js` - funciones getInitial*
- **Problema:** Después de migrar datos de claves legacy (`shoppingListCategories`, `shoppingListMaster`, `shoppingListV5`) a `DB_KEY`, las claves viejas no se eliminan.
- **Impacto:** Datos duplicados en localStorage, desperdicio de espacio
- **Solución:** Eliminar claves legacy después de migración exitosa

### 25. **El hook `useDragAndDrop` no cancela animación frame en unmount**
- **Ubicación:** `useDragAndDrop.js` - auto-scroll
- **Problema:** Si el componente se desmonta mientras hay un `requestAnimationFrame` activo, puede causar memory leak o error.
- **Código problemático:**
```javascript
autoScrollRef.current = requestAnimationFrame(scrollLoop);
// ← No hay cleanup en useEffect return
```
- **Solución:** Cancelar animación en cleanup del efecto o en unmount

---

## 📊 Resumen Ejecutivo

| Prioridad | Cantidad | Riesgo Principal |
|-----------|----------|------------------|
| P0 (Crítica) | 4 | Pérdida de datos |
| P1 (Alta) | 6 | Comportamiento inesperado |
| P2 (Media) | 10 | Robustez y edge cases |
| P3 (Baja) | 5 | Deuda técnica |
| **Total** | **25** | |

---

## 🎯 Plan de Acción Recomendado

### Fase 1 - Inmediata (Esta semana)
1. ✅ Cambiar `Date.now()` por `crypto.randomUUID()` para IDs de items
2. ✅ Añadir `bacoMode` al schema del servidor
3. ✅ Implementar flush de sync en `beforeunload`/`visibilitychange`
4. ✅ Reducir debounce de sync a 1 segundo

### Fase 2 - Corto plazo (2 semanas)
1. Implementar merge inteligente de conflictos
2. Integrar cola de sync con Service Worker
3. Añadir validación de schema en datos del servidor
4. Implementar notificación de cambios remotos

### Fase 3 - Medio plazo (1 mes)
1. Limpieza automática de dispositivos inactivos
2. Rate limiting en el servidor
3. Page Visibility API para pausar polling
4. Migración y limpieza de localStorage legacy

---

*Auditoría realizada con enfoque en resiliencia de datos, sincronización distribuida y experiencia offline-first*
