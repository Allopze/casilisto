import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Utensils,
  Carrot,
  Milk,
  Beef,
  Home,
  Coffee,
  Croissant,
  ShoppingCart,
  PiggyBank,
  Cat,
  GripVertical,
  Edit3,
  Menu,
  Tag,
  User,
  Wine,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

import useLocalDb, {
  DB_KEY,
  DEFAULT_ITEMS,
  DEFAULT_CATEGORIES,
  DEFAULT_MASTER_LIST,
  loadDb,
  getInitialCategories,
  getInitialMasterList,
  getInitialItems,
  getInitialFavorites,
  RESERVED_CATEGORIES,
} from './hooks/useLocalDb';
import useDragAndDrop from './hooks/useDragAndDrop';
import useSync, { SyncStatus } from './hooks/useSync';
import useNative, { useNativeInit } from './hooks/useNative';
import Sidebar from './components/Sidebar';
import FavoritesBar from './components/FavoritesBar';
import ShoppingItem from './components/ShoppingItem';
import ConfirmModal from './components/ConfirmModal';
import { useToast } from './components/Toast';

// --- ESTILOS PERSONALIZADOS (CSS INLINE) ---
const StyleTag = () => (
  <style>{`
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .scroll-mask {
      mask-image: linear-gradient(to right, black 85%, transparent 100%);
      -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
    }
  `}</style>
);

const ICON_MAP = {
  Carrot,
  Beef,
  Milk,
  Utensils,
  Croissant,
  Coffee,
  Home,
  Cat,
  ShoppingCart,
  Tag,
  User,
  Wine,
};

export default function App() {
  const { 
    categories, setCategories, 
    masterList, setMasterList, 
    items, setItems, 
    favorites, setFavorites,
    bacoMode, setBacoMode,
    // Propiedades de sync
    syncInfo, updateSyncInfo, getDataForSync, applyServerData, getLastModified, dataVersion,
    // P1: Error de almacenamiento
    storageError
  } = useLocalDb();

  // Hook de sincronización con callback para notificar cambios remotos
  const sync = useSync({
    syncInfo,
    updateSyncInfo,
    getDataForSync,
    applyServerData,
    getLastModified,
    dataVersion,
    onRemoteChanges: (message) => showToast(message, 'info') // P1: Notificar cambios remotos
  });

  // Hook de toasts para notificaciones
  const { showToast, ToastContainer } = useToast();

  // Inicializar app nativa (splash screen, status bar)
  useNativeInit();
  
  // Hook para vibración
  const { vibrate } = useNative();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [newItemText, setNewItemText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Otros');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [showStorageWarning, setShowStorageWarning] = useState(false);

  // P1: Mostrar advertencia cuando el almacenamiento está lleno
  useEffect(() => {
    if (storageError === 'storage_full') {
      setShowStorageWarning(true);
    }
  }, [storageError]);

  const wrapperRef = useRef(null);

  const {
    draggingId,
    dragOverIndex,
    dragOverlay,
    onDragStart,
    onDragEnter,
    onDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useDragAndDrop(items, setItems);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  // --- MAIN LOGIC ---

  const addItem = (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;

    const existingItemIndex = items.findIndex(
      (i) => i.text.toLowerCase() === newItemText.trim().toLowerCase() && i.completed === false
    );

    if (existingItemIndex > -1) {
      const newItems = [...items];
      newItems[existingItemIndex].quantity += 1;
      setItems(newItems);
      showToast(`${newItemText} - cantidad actualizada a ${newItems[existingItemIndex].quantity}`, 'success');
    } else {
      const newItem = {
        id: crypto.randomUUID(), // P0: UUID en lugar de Date.now() para evitar colisiones
        text: newItemText.trim(),
        completed: false,
        category: selectedCategory,
        quantity: 1,
      };
      setItems([...items, newItem]);
      showToast(`${newItemText.trim()} añadido a la lista`, 'success');
    }
    setNewItemText('');
    setSelectedCategory('Otros');
    setShowSuggestions(false);
  };

  const isFavorite = (text) => favorites.some((f) => f.text.toLowerCase() === text.toLowerCase());

  const toggleFavorite = (item) => {
    if (isFavorite(item.text)) {
      setFavorites(favorites.filter((f) => f.text.toLowerCase() !== item.text.toLowerCase()));
    } else {
      setFavorites([...favorites, { text: item.text, category: item.category }]);
    }
  };

  const addFavoriteToList = (fav) => {
    const existing = items.find((i) => i.text.toLowerCase() === fav.text.toLowerCase() && !i.completed);
    if (existing) {
      setItems(items.map((i) => (i.id === existing.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i)));
    } else {
      // P2: Si la categoría del favorito no existe, usar 'Otros' y actualizar el favorito
      const categoryExists = categories[fav.category];
      const category = categoryExists ? fav.category : 'Otros';
      
      // Actualizar el favorito si su categoría era huérfana
      if (!categoryExists && fav.category !== 'Otros') {
        setFavorites(favorites.map(f => 
          f.text.toLowerCase() === fav.text.toLowerCase() 
            ? { ...f, category: 'Otros' } 
            : f
        ));
      }
      
      setItems([...items, { 
        id: crypto.randomUUID(), // P0: UUID en lugar de Date.now()
        text: fav.text, 
        category, 
        completed: false, 
        quantity: 1 
      }]);
    }
  };

  const itemsToBuy = items.filter((item) => !item.completed);
  const itemsCompleted = items
    .filter((item) => item.completed)
    .sort((a, b) => a.text.localeCompare(b.text, 'es', { sensitivity: 'base' }));

  const repeatCompletedItems = () => {
    setShowRepeatModal(true);
  };

  const confirmRepeatCompleted = () => {
    setItems(prevItems => {
      const hasCompleted = prevItems.some(i => i.completed);
      if (!hasCompleted) return prevItems;
      return prevItems.map((i) => (i.completed ? { ...i, completed: false } : i));
    });
    showToast('Items repuestos a la lista de compras', 'success');
  };

  const toggleItem = (id) => {
    // Vibración al marcar/desmarcar
    vibrate('light');
    setItems(items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)));
  };

  const updateQuantity = (id, delta) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const newQuantity = Math.max(1, (item.quantity || 1) + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const deleteItem = (id) => {
    setItemToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteItem = () => {
    if (itemToDelete) {
      const itemName = items.find(i => i.id === itemToDelete)?.text;
      setItems(items.filter((item) => item.id !== itemToDelete));
      if (expandedItemId === itemToDelete) setExpandedItemId(null);
      showToast(`${itemName} eliminado`, 'info');
      setItemToDelete(null);
    }
  };

  const handleEditChange = (id, field, value) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleTextChange = (e) => {
    const text = e.target.value;
    setNewItemText(text);

    if (text.length > 1) {
      const matches = masterList.filter((item) => item.name.toLowerCase().includes(text.toLowerCase()));
      setSuggestions(matches);
      setShowSuggestions(true);

      const exactMatch = masterList.find((item) => item.name.toLowerCase() === text.toLowerCase());
      if (exactMatch) setSelectedCategory(exactMatch.category);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion) => {
    setNewItemText(suggestion.name);
    const catExists = categories[suggestion.category];
    setSelectedCategory(catExists ? suggestion.category : 'Otros');
    setShowSuggestions(false);
  };

  const renderListWithHeaders = () => {
    if (itemsToBuy.length === 0) {
      return (
        <div className="text-center py-10 bg-white/50 rounded-3xl border border-dashed border-yellow-200 text-stone-400">
          <p className="text-lg">¡Todo listo!</p>
        </div>
      );
    }

    // Ordenar categorías alfabéticamente, con Vinos primero si Modo Baco activo
    let catsToRender = [...new Set([...Object.keys(categories), 'Otros'])]
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    if (bacoMode && catsToRender.includes('Vinos')) {
      catsToRender = ['Vinos', ...catsToRender.filter(c => c !== 'Vinos')];
    }

    return catsToRender.map((catName) => {
      if (!categories[catName] && catName !== 'Otros') return null;

      // No ordenar alfabéticamente para permitir reordenamiento manual
      const catItems = items
        .map((item, originalIndex) => ({ ...item, originalIndex }))
        .filter((item) => !item.completed && item.category === catName);

      if (catItems.length === 0) return null;

      const catConfig = categories[catName] || categories['Otros'] || DEFAULT_CATEGORIES['Otros'];
      const CatIcon = ICON_MAP[catConfig.iconName] || Tag;

      return (
        <div key={catName} className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2
            className={`text-sm font-bold uppercase tracking-wider mb-2 px-1 flex items-center gap-2 ${catConfig.color.split(' ')[1]}`}
          >
            <CatIcon className="w-4 h-4" aria-hidden="true" />
            <span>{catName}</span>
          </h2>
          <div className="space-y-2">
            {catItems.map((item) => (
              <ShoppingItem
                key={item.id}
                item={item}
                isExpanded={expandedItemId === item.id}
                isDragging={draggingId === item.id}
                isDragOver={draggingId && draggingId !== item.id && dragOverIndex === item.originalIndex}
                categories={categories}
                isFavorite={isFavorite(item.text)}
                bacoMode={bacoMode}
                onToggle={() => toggleItem(item.id)}
                onExpand={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                onQuantityChange={(delta) => updateQuantity(item.id, delta)}
                onEditChange={(field, value) => handleEditChange(item.id, field, value)}
                onDelete={() => deleteItem(item.id)}
                onToggleFavorite={() => toggleFavorite(item)}
                dragHandlers={{
                  onDragStart: (e) => onDragStart(e, item.originalIndex),
                  onDragEnter: (e) => onDragEnter(e, item.originalIndex),
                  onDragEnd,
                  onTouchStart: (e) => handleTouchStart(e, item, item.originalIndex),
                  onTouchMove: handleTouchMove,
                  onTouchEnd: handleTouchEnd,
                }}
              />
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-yellow-50 text-stone-800 font-sans selection:bg-yellow-200 pb-32 overflow-x-hidden relative">
      <StyleTag />

      {/* --- SIDEBAR MENU (CONFIGURACIÓN) --- */}
      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        categories={categories}
        setCategories={setCategories}
        masterList={masterList}
        setMasterList={setMasterList}
        items={items}
        setItems={setItems}
        ICON_MAP={ICON_MAP}
        sync={sync}
        bacoMode={bacoMode}
        setBacoMode={setBacoMode}
      />

      {/* --- APP PRINCIPAL --- */}

      <header className="bg-yellow-300 py-4 px-4 shadow-sm sticky top-0 z-30 border-b border-yellow-400/30">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 -ml-2 hover:bg-yellow-400/50 rounded-xl transition-colors text-yellow-900 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
              aria-label="Abrir menú de configuración"
            >
              <Menu className="w-7 h-7" aria-hidden="true" />
            </button>
            <h1 className="text-xl font-bold flex items-center text-yellow-900 select-none">
              <PiggyBank className="mr-2 w-7 h-7" strokeWidth={2} aria-hidden="true" />
              CasiListo
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="text-xs font-bold bg-yellow-100 px-3 py-1.5 rounded-full text-yellow-800 select-none"
              aria-label={`${itemsToBuy.length} ${itemsToBuy.length === 1 ? 'producto pendiente' : 'productos pendientes'}`}
              role="status"
            >
              {itemsToBuy.length}
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              className="p-2 bg-white/50 rounded-full text-yellow-900 hover:bg-white active:scale-95 transition-all focus:ring-2 focus:ring-yellow-500 focus:outline-none"
              aria-label="Nueva semana - reiniciar lista"
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <FavoritesBar
          favorites={favorites}
          itemsCompleted={itemsCompleted}
          onAddFavorite={addFavoriteToList}
          onRepeatCompleted={repeatCompletedItems}
        />

        {/* Formulario Añadir */}
        <form onSubmit={addItem} className="mb-6 relative z-10" ref={wrapperRef}>
          <div className="relative">
            <input
              type="text"
              value={newItemText}
              onChange={handleTextChange}
              placeholder="Buscar o añadir producto..."
              className="w-full p-3 pr-14 rounded-t-3xl rounded-b-2xl border-2 border-yellow-200 bg-white shadow-sm focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 focus:outline-none text-base placeholder:text-stone-400 transition-all"
              aria-label="Nombre del producto"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-yellow-200 rounded-b-3xl shadow-lg mt-1 max-h-48 overflow-y-auto z-50">
                {suggestions.map((s, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectSuggestion(s)}
                    className="p-3 hover:bg-yellow-50 cursor-pointer flex justify-between items-center text-stone-700 border-b border-stone-50 last:border-0 active:bg-yellow-100"
                    role="option"
                    aria-selected="false"
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-stone-400 bg-stone-100 px-2 py-1 rounded-full">{s.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 pr-10 rounded-2xl border border-yellow-200 bg-white text-stone-600 text-sm focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 focus:outline-none appearance-none transition-all"
                aria-label="Categoría del producto"
              >
                {Object.keys(categories).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none" aria-hidden="true" />
            </div>
            <button
              type="submit"
              disabled={!newItemText.trim()}
              className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold rounded-2xl px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm active:scale-95 focus:ring-2 focus:ring-yellow-300 focus:outline-none"
              aria-label="Añadir producto"
            >
              <Plus className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
        </form>

        {/* LISTAS */}
        {renderListWithHeaders()}

        {itemsCompleted.length > 0 && (
          <div className="opacity-60 hover:opacity-100 transition-opacity mt-8">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 px-2 flex items-center">
              En Casa / En el Carrito ({itemsCompleted.length})
            </h2>
            <div className="space-y-2">
              {itemsCompleted.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-yellow-100/40 rounded-2xl border border-transparent select-none"
                >
                  <div onClick={() => toggleItem(item.id)} className="flex-1 flex items-center cursor-pointer">
                    <div className="w-6 h-6 rounded-xl bg-yellow-400 border-2 border-yellow-400 mr-3 flex items-center justify-center text-white shadow-sm">
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-base font-medium text-stone-500 line-through decoration-stone-400 decoration-1">
                        {item.text}
                      </span>
                      {item.quantity > 1 && <span className="text-xs text-stone-400">Cantidad: {item.quantity}</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteItem(item.id)} className="p-2 text-stone-300 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* DRAG OVERLAY */}
      {dragOverlay && (
        <div
          style={{
            position: 'fixed',
            top: dragOverlay.y - dragOverlay.offsetY,
            left: dragOverlay.x - dragOverlay.offsetX,
            width: dragOverlay.width,
            height: dragOverlay.height,
            pointerEvents: 'none',
            zIndex: 1000,
            transform: 'scale(1.02)',
          }}
          className="bg-white rounded-3xl border-2 border-yellow-400 shadow-2xl flex items-center p-3 opacity-95"
        >
          <div className="mr-2 text-stone-300 p-2 -ml-2">
            <GripVertical className="w-5 h-5" />
          </div>
          <div className="w-8 h-8 rounded-2xl border-2 border-stone-200 mr-3 bg-stone-50"></div>
          <div className="flex-1 min-w-0 pr-2">
            <span className="text-lg font-bold text-stone-800 block truncate">{dragOverlay.item.text}</span>
          </div>
          <button className="p-2 text-stone-300 mr-1">
            <Edit3 className="w-5 h-5" />
          </button>
          <div className="flex items-center bg-stone-50 rounded-xl p-1 border border-stone-100 opacity-50">
            <span className="w-16 text-center font-bold text-stone-700 text-sm">...</span>
          </div>
        </div>
      )}

      {/* MODAL REINICIAR SEMANA */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={() => setItems(prevItems => prevItems.map((item) => ({ ...item, completed: false })))}
        title="¿Nueva semana?"
        message="Todos los productos completados volverán a la lista de compras pendientes."
        confirmText="Reiniciar"
        cancelText="Cancelar"
        icon={RotateCcw}
        iconColor="text-yellow-600"
        iconBg="bg-yellow-100"
      />

      {/* MODAL ELIMINAR ITEM */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        onConfirm={confirmDeleteItem}
        title="¿Eliminar producto?"
        message={`"${items.find(i => i.id === itemToDelete)?.text || ''}" será eliminado de tu lista.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        icon={Trash2}
        iconColor="text-red-600"
        iconBg="bg-red-100"
        confirmColor="bg-red-500 hover:bg-red-600 text-white"
      />

      {/* MODAL REPONER COMPLETADOS */}
      <ConfirmModal
        isOpen={showRepeatModal}
        onClose={() => setShowRepeatModal(false)}
        onConfirm={confirmRepeatCompleted}
        title="¿Reponer completados?"
        message={`${itemsCompleted.length} productos volverán a la lista de compras pendientes.`}
        confirmText="Reponer"
        cancelText="Cancelar"
        icon={RefreshCw}
        iconColor="text-yellow-600"
        iconBg="bg-yellow-100"
      />

      {/* P1: MODAL ADVERTENCIA ALMACENAMIENTO LLENO */}
      <ConfirmModal
        isOpen={showStorageWarning}
        onClose={() => setShowStorageWarning(false)}
        onConfirm={() => setShowStorageWarning(false)}
        title="Almacenamiento lleno"
        message="El almacenamiento local está lleno. Algunos cambios pueden no guardarse. Considera sincronizar tu cuenta o eliminar datos del navegador."
        confirmText="Entendido"
        cancelText=""
        icon={AlertTriangle}
        iconColor="text-orange-600"
        iconBg="bg-orange-100"
      />

      {/* TOAST CONTAINER */}
      <ToastContainer />
    </div>
  );
}

// Exportamos utilidades para pruebas unitarias
export {
  DB_KEY,
  DEFAULT_ITEMS,
  DEFAULT_CATEGORIES,
  DEFAULT_MASTER_LIST,
  RESERVED_CATEGORIES,
  loadDb,
  getInitialCategories,
  getInitialMasterList,
  getInitialItems,
  getInitialFavorites,
};

