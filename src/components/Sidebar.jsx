/**
 * Componente Sidebar para configuración (categorías, productos master, sincronización)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Settings,
  Tag,
  Cloud,
  CloudOff,
  RefreshCw,
  Smartphone,
  Copy,
  Check,
  LogOut,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
  Wine,
  Info,
  Edit3,
} from 'lucide-react';
import { SyncStatus } from '../hooks/useSync';
import { RESERVED_CATEGORIES } from '../hooks/useLocalDb';
import ConfirmModal from './ConfirmModal';

const COLOR_PRESETS = [
  { name: 'Verde', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  { name: 'Rojo', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  { name: 'Azul', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  { name: 'Naranja', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  { name: 'Amarillo', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  { name: 'Morado', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  { name: 'Gris', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  { name: 'Rosa', bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
  { name: 'Turquesa', bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
];

export default function Sidebar({
  isOpen,
  onClose,
  categories,
  setCategories,
  masterList,
  setMasterList,
  items,
  setItems,
  ICON_MAP,
  sync, // Hook de sincronización
  bacoMode,
  setBacoMode,
}) {
  const [expandedSettingsCat, setExpandedSettingsCat] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLOR_PRESETS[0]);
  const [newMasterItemText, setNewMasterItemText] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [deviceToUnlink, setDeviceToUnlink] = useState(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  
  // Estados para modales de confirmación
  const [showDuplicateCatModal, setShowDuplicateCatModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [showCantDeleteOtrosModal, setShowCantDeleteOtrosModal] = useState(false);
  const [showDuplicateProductModal, setShowDuplicateProductModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [showReservedCatModal, setShowReservedCatModal] = useState(false);
  
  // P2: Estado para renombrar dispositivo
  const [editingDeviceName, setEditingDeviceName] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  
  // Ref para scroll indicator
  const scrollContainerRef = useRef(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  // Detectar si hay más contenido para scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const checkScroll = () => {
      const hasMoreContent = container.scrollHeight > container.clientHeight;
      const isNotAtBottom = container.scrollTop < container.scrollHeight - container.clientHeight - 20;
      setShowScrollIndicator(hasMoreContent && isNotAtBottom);
    };
    
    checkScroll();
    container.addEventListener('scroll', checkScroll);
    return () => container.removeEventListener('scroll', checkScroll);
  }, [isOpen]);

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const trimmedName = newCatName.trim();
    
    // P2: Verificar si es una categoría reservada
    if (RESERVED_CATEGORIES.some(rc => rc.toLowerCase() === trimmedName.toLowerCase())) {
      setShowReservedCatModal(true);
      return;
    }
    
    if (categories[trimmedName]) {
      setShowDuplicateCatModal(true);
      return;
    }
    const newCategoryData = {
      color: `${newCatColor.bg} ${newCatColor.text}`,
      border: newCatColor.border,
      iconName: 'Tag',
    };
    setCategories({ ...categories, [trimmedName]: newCategoryData });
    setNewCatName('');
  };

  const deleteCategory = (catName) => {
    if (catName === 'Otros') {
      setShowCantDeleteOtrosModal(true);
      return;
    }
    setCategoryToDelete(catName);
  };

  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      const newCats = { ...categories };
      delete newCats[categoryToDelete];
      setCategories(newCats);
      setMasterList(masterList.map((item) => (item.category === categoryToDelete ? { ...item, category: 'Otros' } : item)));
      setItems(items.map((item) => (item.category === categoryToDelete ? { ...item, category: 'Otros' } : item)));
      setCategoryToDelete(null);
    }
  };

  const addMasterItemToCat = (catName) => {
    if (!newMasterItemText.trim()) return;
    const itemName = newMasterItemText.trim();
    const exists = masterList.some((item) => item.name.toLowerCase() === itemName.toLowerCase());
    if (exists) {
      setShowDuplicateProductModal(true);
      return;
    }
    // Añadir a la lista maestra (sugerencias)
    setMasterList([...masterList, { name: itemName, category: catName }]);
    
    // También añadir a la lista de compras activa si no existe
    const existsInItems = items.some(
      (item) => item.text.toLowerCase() === itemName.toLowerCase() && !item.completed
    );
    if (!existsInItems) {
      setItems([...items, {
        id: Date.now(),
        text: itemName,
        completed: false,
        category: catName,
        quantity: 1,
      }]);
    }
    
    setNewMasterItemText('');
  };

  const removeMasterItem = (itemName) => {
    setProductToDelete(itemName);
  };

  const confirmRemoveMasterItem = () => {
    if (productToDelete) {
      setMasterList(masterList.filter((item) => item.name !== productToDelete));
      setProductToDelete(null);
    }
  };

  // --- Funciones de sincronización ---
  const [newAccountCode, setNewAccountCode] = useState(null);

  const handleCreateAccount = async () => {
    setIsCreatingAccount(true);
    const code = await sync.createAccount();
    if (code) {
      setNewAccountCode(code);
    }
    setIsCreatingAccount(false);
  };

  const handleLinkDevice = async () => {
    if (!linkCode.trim() || linkCode.length !== 6) return;
    setIsLinking(true);
    const success = await sync.linkDevice(linkCode.trim());
    setIsLinking(false);
    if (success) {
      setLinkCode('');
      setShowLinkForm(false);
    }
  };

  const handleCopyCode = () => {
    if (sync.userCode) {
      navigator.clipboard.writeText(sync.userCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleUnlinkDevice = async (deviceId) => {
    const success = await sync.unlinkDevice(deviceId);
    if (success) {
      setDeviceToUnlink(null);
    }
  };

  const formatLastSeen = (timestamp) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${days}d`;
  };

  const getSyncStatusDisplay = () => {
    switch (sync.status) {
      case SyncStatus.ONLINE:
        return { icon: Cloud, color: 'text-green-600', bg: 'bg-green-100', text: 'Sincronizado', helpText: 'Tus datos están actualizados' };
      case SyncStatus.SYNCING:
        return { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-100', text: 'Sincronizando...', spin: true, helpText: 'Enviando cambios...' };
      case SyncStatus.OFFLINE:
        return { icon: WifiOff, color: 'text-orange-600', bg: 'bg-orange-100', text: 'Sin conexión', helpText: 'Los cambios se sincronizarán al reconectar' };
      case SyncStatus.PENDING:
        return { icon: RefreshCw, color: 'text-yellow-600', bg: 'bg-yellow-100', text: 'Cambios pendientes', helpText: 'Se sincronizará en unos segundos...' };
      case SyncStatus.ERROR:
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', text: 'Error de sync', helpText: 'Intenta sincronizar manualmente' };
      default:
        return { icon: CloudOff, color: 'text-stone-400', bg: 'bg-stone-100', text: 'No vinculado', helpText: '' };
    }
  };

  return (
    <div className={`fixed inset-0 z-50 transition-all duration-300 ${isOpen ? 'visible' : 'invisible'}`}>
      <div
        className={`absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Panel Lateral */}
      <div
        className={`absolute top-0 left-0 bottom-0 w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 bg-yellow-300 flex items-center justify-between">
          <h2 className="text-xl font-bold text-yellow-900 flex items-center gap-2">
            <Settings className="w-6 h-6" aria-hidden="true" /> Configuración
          </h2>
          <button 
            onClick={onClose} 
            className="p-3 bg-yellow-400/50 hover:bg-yellow-400 rounded-full text-yellow-900 focus:ring-2 focus:ring-yellow-600 focus:outline-none"
            aria-label="Cerrar configuración"
          >
            <X className="w-7 h-7" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8 relative" ref={scrollContainerRef}>
          {/* Scroll indicator */}
          {showScrollIndicator && (
            <div className="sticky bottom-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-t from-white to-transparent z-10" />
          )}
          {/* Modo Baco Toggle */}
          <div className="bg-purple-50 p-5 rounded-2xl border border-purple-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Wine className="w-5 h-5 text-purple-600" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-purple-800">Modo Baco</h3>
                  <p className="text-xs text-purple-600">{bacoMode ? 'Vinos siempre visible arriba' : 'Activa para priorizar vinos'}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const newBacoMode = !bacoMode;
                  setBacoMode(newBacoMode);
                  
                  if (newBacoMode) {
                    // Activar: Añadir categoría Vinos y el item Vino
                    const newCategories = {
                      ...categories,
                      'Vinos': {
                        color: 'bg-purple-100 text-purple-800',
                        border: 'border-purple-200',
                        iconName: 'Wine'
                      }
                    };
                    setCategories(newCategories);
                    
                    // Añadir Vino a masterList (filtrar si ya existe en otra categoría)
                    const filteredMaster = masterList.filter(i => i.name.toLowerCase() !== 'vino');
                    setMasterList([...filteredMaster, { name: 'Vino', category: 'Vinos' }]);
                    
                    // Añadir Vino a items (filtrar cualquier vino existente y añadir nuevo)
                    const filteredItems = items.filter(i => i.text.toLowerCase() !== 'vino');
                    setItems([...filteredItems, {
                      id: Date.now(),
                      text: 'Vino',
                      completed: false,
                      category: 'Vinos',
                      quantity: 1
                    }]);
                  } else {
                    // Desactivar: Eliminar categoría Vinos y sus items
                    const newCategories = { ...categories };
                    delete newCategories['Vinos'];
                    setCategories(newCategories);
                    // Eliminar items de Vinos
                    setItems(items.filter(i => i.category !== 'Vinos'));
                    setMasterList(masterList.filter(i => i.category !== 'Vinos'));
                  }
                }}
                className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                  bacoMode ? 'bg-purple-500' : 'bg-stone-300'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                    bacoMode ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Añadir Categoría */}
          <div className="bg-yellow-50 p-5 rounded-2xl border border-yellow-200 shadow-sm">
            <h3 className="font-bold text-lg text-yellow-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" aria-hidden="true" /> Nueva Categoría
            </h3>
            <input
              type="text"
              placeholder="Nombre (ej. Bebé)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full p-3 mb-4 rounded-xl border border-yellow-200 text-base focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 focus:outline-none transition-all"
              aria-label="Nombre de la nueva categoría"
            />
            <div className="relative">
              <p className="text-xs text-stone-500 mb-2">Elige un color:</p>
              <div 
                className="flex gap-4 overflow-x-auto py-3 px-1 mb-2 no-scrollbar scroll-mask pr-6"
                role="radiogroup"
                aria-label="Color de la categoría"
              >
                {COLOR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setNewCatColor(preset)}
                    className={`w-10 h-10 rounded-full flex-shrink-0 border-2 shadow-sm ${preset.bg} ${newCatColor.name === preset.name ? 'border-stone-800 scale-110 ring-2 ring-yellow-400 ring-offset-2' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-yellow-400`}
                    aria-label={`Color ${preset.name}`}
                    aria-pressed={newCatColor.name === preset.name}
                    role="radio"
                  />
                ))}
                <div className="w-4 flex-shrink-0"></div>
              </div>
            </div>
            <button
              onClick={addCategory}
              disabled={!newCatName}
              className="w-full py-3 bg-yellow-400 text-yellow-900 font-bold rounded-2xl text-base disabled:opacity-50 mt-2 shadow-sm active:scale-95 transition-transform focus:ring-2 focus:ring-yellow-500 focus:outline-none"
            >
              Crear Categoría
            </button>
          </div>

          {/* Lista de Categorías */}
          <div>
            <h3 className="font-bold text-stone-400 uppercase text-sm mb-4 px-2">Categorías y Productos</h3>
            <div className="space-y-3">
              {(() => {
                // Ordenar categorías alfabéticamente, con Vinos primero si Modo Baco activo
                let sortedCats = Object.keys(categories).sort((a, b) => 
                  a.localeCompare(b, 'es', { sensitivity: 'base' })
                );
                if (bacoMode && sortedCats.includes('Vinos')) {
                  sortedCats = ['Vinos', ...sortedCats.filter(c => c !== 'Vinos')];
                }
                return sortedCats;
              })().map((catName) => {
                const catConfig = categories[catName];
                const CatIcon = ICON_MAP[catConfig.iconName] || Tag;
                const isExpanded = expandedSettingsCat === catName;

                return (
                  <div key={catName} className="border border-stone-100 rounded-2xl overflow-hidden shadow-sm">
                    <div
                      className="flex items-center justify-between p-4 bg-white hover:bg-stone-50 cursor-pointer active:bg-stone-100"
                      onClick={() => setExpandedSettingsCat(isExpanded ? null : catName)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${catConfig.color.split(' ')[0]} ${catConfig.color.split(' ')[1]}`}
                        >
                          <CatIcon className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-lg text-stone-700">{catName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {catName !== 'Otros' && !(bacoMode && catName === 'Vinos') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCategory(catName);
                            }}
                            className="p-3 text-stone-300 hover:text-red-500 rounded-full hover:bg-stone-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-stone-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-stone-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-stone-50 p-4 border-t border-stone-100">
                        <div className="flex gap-3 mb-4">
                          <input
                            type="text"
                            placeholder="Añadir producto..."
                            value={newMasterItemText}
                            onChange={(e) => setNewMasterItemText(e.target.value)}
                            className="flex-1 p-3 rounded-xl border border-stone-200 text-base shadow-sm focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 focus:outline-none transition-all"
                            aria-label={`Añadir producto a ${catName}`}
                          />
                          <button
                            onClick={() => addMasterItemToCat(catName)}
                            className="bg-stone-200 p-3 rounded-xl text-stone-600 hover:bg-stone-300 active:scale-95 focus:ring-2 focus:ring-stone-400 focus:outline-none"
                            aria-label="Añadir producto"
                          >
                            <Plus className="w-6 h-6" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {masterList
                            .filter((i) => i.category === catName)
                            .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
                            .map((mItem, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between items-center bg-white p-3 rounded-xl border border-stone-100 text-base text-stone-600 shadow-sm"
                              >
                                <span className="font-medium">{mItem.name}</span>
                                <button
                                  onClick={() => removeMasterItem(mItem.name)}
                                  className="text-stone-300 hover:text-red-400 p-2"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            ))}
                          {masterList.filter((i) => i.category === catName).length === 0 && (
                            <p className="text-sm text-stone-400 text-center py-4 italic">Sin productos guardados</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ==================== SINCRONIZACIÓN ==================== */}
          <div className="bg-stone-50 p-5 rounded-3xl border border-stone-200 shadow-sm">
            <h3 className="font-bold text-lg text-stone-700 mb-4 flex items-center gap-2">
              <Cloud className="w-5 h-5" /> Sincronización
            </h3>

            {/* Estado actual */}
            {sync && (
              <div className={`p-3 rounded-xl mb-4 ${getSyncStatusDisplay().bg}`}>
                <div className="flex items-center gap-3">
                  {(() => {
                    const StatusIcon = getSyncStatusDisplay().icon;
                    return (
                      <StatusIcon 
                        className={`w-5 h-5 ${getSyncStatusDisplay().color} ${getSyncStatusDisplay().spin ? 'animate-spin' : ''}`} 
                        aria-hidden="true"
                      />
                    );
                  })()}
                  <span className={`font-medium ${getSyncStatusDisplay().color}`}>
                    {getSyncStatusDisplay().text}
                  </span>
                </div>
                {getSyncStatusDisplay().helpText && (
                  <p className={`text-xs mt-1 ml-8 ${getSyncStatusDisplay().color} opacity-75`}>
                    {getSyncStatusDisplay().helpText}
                  </p>
                )}
              </div>
            )}

            {/* Si no está vinculado */}
            {sync && !sync.userCode && (
              <div className="space-y-3">
                {newAccountCode ? (
                  /* Mostrar código recién creado */
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Check className="w-5 h-5 text-green-600" />
                      <span className="font-bold text-green-800">¡Cuenta creada!</span>
                    </div>
                    <p className="text-sm text-green-700 mb-3">Tu código de sincronización:</p>
                    <div className="flex items-center justify-center gap-3 bg-white p-3 rounded-xl border border-green-200">
                      <span className="text-3xl font-mono font-bold tracking-widest text-green-800">
                        {newAccountCode}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(newAccountCode);
                          setCodeCopied(true);
                          setTimeout(() => setCodeCopied(false), 2000);
                        }}
                        className="p-2 rounded-lg bg-green-100 hover:bg-green-200 active:scale-95 transition-all"
                      >
                        {codeCopied ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5 text-green-600" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-green-600 text-center mt-3">
                      Guarda este código para vincular otros dispositivos
                    </p>
                    <button
                      onClick={() => setNewAccountCode(null)}
                      className="w-full mt-3 py-2 bg-green-200 text-green-800 font-medium rounded-xl text-sm"
                    >
                      Entendido
                    </button>
                  </div>
                ) : !showLinkForm ? (
                  <>
                    <button
                      onClick={handleCreateAccount}
                      disabled={isCreatingAccount || !sync.isOnline}
                      className="w-full py-3 bg-yellow-400 text-yellow-900 font-bold rounded-2xl text-base disabled:opacity-50 shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                      {isCreatingAccount ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                      Crear cuenta
                    </button>
                    <button
                      onClick={() => setShowLinkForm(true)}
                      disabled={!sync.isOnline}
                      className="w-full py-3 bg-stone-200 text-stone-700 font-bold rounded-2xl text-base disabled:opacity-50 shadow-sm active:scale-95 transition-transform"
                    >
                      Ya tengo un código
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Código de 6 caracteres"
                      value={linkCode}
                      onChange={(e) => setLinkCode(e.target.value.toUpperCase().slice(0, 6))}
                      className="w-full p-3 rounded-xl border border-stone-200 text-center text-2xl font-mono tracking-widest uppercase focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 focus:outline-none transition-all"
                      maxLength={6}
                      inputMode="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck="false"
                      aria-label="Código de sincronización"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowLinkForm(false);
                          setLinkCode('');
                        }}
                        className="flex-1 py-3 bg-stone-200 text-stone-700 font-bold rounded-2xl"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleLinkDevice}
                        disabled={linkCode.length !== 6 || isLinking}
                        className="flex-1 py-3 bg-yellow-400 text-yellow-900 font-bold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isLinking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Vincular'}
                      </button>
                    </div>
                    {sync.error && (
                      <p className="text-red-600 text-sm text-center">{sync.error}</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-stone-400 text-center mt-2">
                  Sincroniza tu lista entre dispositivos
                </p>
              </div>
            )}

            {/* Si está vinculado - mostrar código */}
            {sync && sync.userCode && (
              <div className="space-y-4">
                {/* Código */}
                <div className="bg-white p-4 rounded-xl border border-stone-200">
                  <p className="text-xs text-stone-500 mb-2 text-center">Tu código de sincronización</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl font-mono font-bold tracking-widest text-stone-800">
                      {sync.userCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 active:scale-95 transition-all"
                    >
                      {codeCopied ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-stone-600" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-stone-400 text-center mt-2">
                    Usa este código en otros dispositivos
                  </p>
                </div>

                {/* Botón sync manual */}
                <button
                  onClick={() => sync.syncNow()}
                  disabled={!sync.isOnline || sync.status === SyncStatus.SYNCING}
                  className="w-full py-3 bg-stone-200 text-stone-700 font-bold rounded-2xl text-base disabled:opacity-50 shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-5 h-5 ${sync.status === SyncStatus.SYNCING ? 'animate-spin' : ''}`} />
                  Sincronizar ahora
                </button>

                {/* Lista de dispositivos */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-stone-600 flex items-center gap-2">
                      <Smartphone className="w-4 h-4" /> Dispositivos vinculados
                    </h4>
                    <button
                      onClick={() => sync.fetchDevices()}
                      className="p-1 text-stone-400 hover:text-stone-600"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {sync.devices.map((device) => (
                      <div
                        key={device.id}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          device.id === sync.deviceId
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-white border-stone-100'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          {/* P2: Editar nombre de dispositivo actual */}
                          {device.id === sync.deviceId && editingDeviceName ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={newDeviceName}
                                onChange={(e) => setNewDeviceName(e.target.value)}
                                className="flex-1 p-1 text-sm border border-yellow-300 rounded focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newDeviceName.trim()) {
                                    // Actualizar nombre localmente
                                    sync.updateDeviceName && sync.updateDeviceName(newDeviceName.trim());
                                    setEditingDeviceName(false);
                                  } else if (e.key === 'Escape') {
                                    setEditingDeviceName(false);
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (newDeviceName.trim()) {
                                    sync.updateDeviceName && sync.updateDeviceName(newDeviceName.trim());
                                  }
                                  setEditingDeviceName(false);
                                }}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <p className="font-medium text-stone-700 truncate flex items-center">
                              {device.name}
                              {device.id === sync.deviceId && (
                                <>
                                  <span className="ml-2 text-xs text-yellow-600 font-normal">(Este dispositivo)</span>
                                  <button
                                    onClick={() => {
                                      setNewDeviceName(device.name);
                                      setEditingDeviceName(true);
                                    }}
                                    className="ml-2 p-1 text-stone-400 hover:text-stone-600 rounded"
                                    title="Renombrar dispositivo"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </p>
                          )}
                          <p className="text-xs text-stone-400">
                            {formatLastSeen(device.last_seen)}
                          </p>
                        </div>
                        <button
                          onClick={() => setDeviceToUnlink(device)}
                          className="p-2 text-stone-300 hover:text-red-500 rounded-lg hover:bg-stone-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    {sync.devices.length === 0 && (
                      <p className="text-sm text-stone-400 text-center py-3 italic">
                        Cargando dispositivos...
                      </p>
                    )}
                  </div>
                </div>

                {/* Desconectar */}
                <button
                  onClick={() => setShowDisconnectModal(true)}
                  className="w-full py-3 text-red-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-50 rounded-xl"
                >
                  <LogOut className="w-4 h-4" />
                  Desconectar cuenta
                </button>
              </div>
            )}
          </div>

          {/* Modal de confirmación para desvincular dispositivo */}
          {deviceToUnlink && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setDeviceToUnlink(null)} />
              <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <h3 className="font-bold text-lg text-stone-800 mb-2">
                  ¿Desvincular dispositivo?
                </h3>
                <p className="text-stone-600 mb-4">
                  {deviceToUnlink.id === sync.deviceId ? (
                    <>Este es tu dispositivo actual. Se desvinculará pero mantendrás tus datos locales.</>
                  ) : (
                    <>"{deviceToUnlink.name}" ya no podrá sincronizar con tu cuenta.</>
                  )}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeviceToUnlink(null)}
                    className="flex-1 py-3 bg-stone-200 text-stone-700 font-bold rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleUnlinkDevice(deviceToUnlink.id)}
                    className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl"
                  >
                    Desvincular
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de confirmación para desconectar cuenta */}
          {showDisconnectModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setShowDisconnectModal(false)} />
              <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <LogOut className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-bold text-lg text-stone-800 mb-2 text-center">
                  ¿Desconectar cuenta?
                </h3>
                <p className="text-stone-600 mb-4 text-center text-sm">
                  Se desvinculará la sincronización de este dispositivo. Tus datos locales se mantendrán intactos.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDisconnectModal(false)}
                    className="flex-1 py-3 bg-stone-200 text-stone-700 font-bold rounded-xl active:scale-95 transition-transform"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      sync.disconnect();
                      setShowDisconnectModal(false);
                    }}
                    className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl active:scale-95 transition-transform"
                  >
                    Desconectar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Categoría duplicada */}
          <ConfirmModal
            isOpen={showDuplicateCatModal}
            onClose={() => setShowDuplicateCatModal(false)}
            onConfirm={() => setShowDuplicateCatModal(false)}
            title="Categoría existente"
            message="Ya existe una categoría con ese nombre. Por favor, elige otro nombre."
            confirmText="Entendido"
            cancelText=""
            icon={Info}
            iconColor="text-yellow-600"
            iconBg="bg-yellow-100"
          />

          {/* Modal: No se puede borrar Otros */}
          <ConfirmModal
            isOpen={showCantDeleteOtrosModal}
            onClose={() => setShowCantDeleteOtrosModal(false)}
            onConfirm={() => setShowCantDeleteOtrosModal(false)}
            title="Categoría protegida"
            message='La categoría "Otros" no se puede eliminar porque es la categoría por defecto.'
            confirmText="Entendido"
            cancelText=""
            icon={Info}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />

          {/* Modal: Confirmar eliminar categoría */}
          <ConfirmModal
            isOpen={!!categoryToDelete}
            onClose={() => setCategoryToDelete(null)}
            onConfirm={confirmDeleteCategory}
            title="¿Eliminar categoría?"
            message={`"${categoryToDelete}" será eliminada y sus productos pasarán a "Otros".`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            icon={Trash2}
            iconColor="text-red-600"
            iconBg="bg-red-100"
            confirmColor="bg-red-500 hover:bg-red-600 text-white"
          />

          {/* Modal: Producto duplicado */}
          <ConfirmModal
            isOpen={showDuplicateProductModal}
            onClose={() => setShowDuplicateProductModal(false)}
            onConfirm={() => setShowDuplicateProductModal(false)}
            title="Producto existente"
            message="Este producto ya existe en la lista de sugerencias."
            confirmText="Entendido"
            cancelText=""
            icon={Info}
            iconColor="text-yellow-600"
            iconBg="bg-yellow-100"
          />

          {/* Modal: Confirmar eliminar producto */}
          <ConfirmModal
            isOpen={!!productToDelete}
            onClose={() => setProductToDelete(null)}
            onConfirm={confirmRemoveMasterItem}
            title="¿Eliminar producto?"
            message={`"${productToDelete}" será eliminado de la lista de sugerencias.`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            icon={Trash2}
            iconColor="text-red-600"
            iconBg="bg-red-100"
            confirmColor="bg-red-500 hover:bg-red-600 text-white"
          />

          {/* P2: Modal: Categoría reservada */}
          <ConfirmModal
            isOpen={showReservedCatModal}
            onClose={() => setShowReservedCatModal(false)}
            onConfirm={() => setShowReservedCatModal(false)}
            title="Nombre reservado"
            message={`"${newCatName}" es un nombre reservado del sistema. Por favor, elige otro nombre.`}
            confirmText="Entendido"
            cancelText=""
            icon={Info}
            iconColor="text-orange-600"
            iconBg="bg-orange-100"
          />
        </div>

        {/* Footer fijo con código de usuario */}
        {sync && sync.userCode && (
          <div className="border-t border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-green-600" />
                <span className="text-sm text-stone-600">Tu código:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg tracking-wider text-stone-800">
                  {sync.userCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 active:scale-95 transition-all"
                >
                  {codeCopied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-stone-600" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
