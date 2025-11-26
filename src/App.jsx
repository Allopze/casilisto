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
} from './hooks/useLocalDb';
import useDragAndDrop from './hooks/useDragAndDrop';
import Sidebar from './components/Sidebar';
import FavoritesBar from './components/FavoritesBar';
import ShoppingItem from './components/ShoppingItem';
import ConfirmModal from './components/ConfirmModal';

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
};

export default function App() {
  const { categories, setCategories, masterList, setMasterList, items, setItems, favorites, setFavorites } =
    useLocalDb();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [newItemText, setNewItemText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Otros');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const wrapperRef = useRef(null);

  const {
    draggingId,
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
    } else {
      const newItem = {
        id: Date.now(),
        text: newItemText.trim(),
        completed: false,
        category: selectedCategory,
        quantity: 1,
      };
      setItems([...items, newItem]);
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
      const category = categories[fav.category] ? fav.category : 'Otros';
      setItems([...items, { id: Date.now(), text: fav.text, category, completed: false, quantity: 1 }]);
    }
  };

  const itemsToBuy = items.filter((item) => !item.completed);
  const itemsCompleted = items.filter((item) => item.completed);

  const repeatCompletedItems = () => {
    if (itemsCompleted.length === 0) return;
    setItems(items.map((i) => (i.completed ? { ...i, completed: false } : i)));
  };

  const toggleItem = (id) => {
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
    if (window.confirm('¿Borrar de la lista?')) {
      setItems(items.filter((item) => item.id !== id));
      if (expandedItemId === id) setExpandedItemId(null);
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

    const catsToRender = [...new Set([...Object.keys(categories), 'Otros'])];

    return catsToRender.map((catName) => {
      if (!categories[catName] && catName !== 'Otros') return null;

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
            <CatIcon className="w-4 h-4" />
            {catName}
          </h2>
          <div className="space-y-2">
            {catItems.map((item) => (
              <ShoppingItem
                key={item.id}
                item={item}
                isExpanded={expandedItemId === item.id}
                isDragging={draggingId === item.id}
                categories={categories}
                isFavorite={isFavorite(item.text)}
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
      />

      {/* --- APP PRINCIPAL --- */}

      <header className="bg-yellow-300 py-4 px-4 shadow-sm sticky top-0 z-30 border-b border-yellow-400/30">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 -ml-2 hover:bg-yellow-400/50 rounded-xl transition-colors text-yellow-900"
            >
              <Menu className="w-7 h-7" />
            </button>
            <h1 className="text-xl font-bold flex items-center text-yellow-900 select-none">
              <PiggyBank className="mr-2 w-7 h-7" strokeWidth={2} />
              CasiListo
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-bold bg-yellow-100 px-3 py-1.5 rounded-full text-yellow-800 select-none">
              {itemsToBuy.length}
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              className="p-2 bg-white/50 rounded-full text-yellow-900 hover:bg-white active:scale-95 transition-all"
            >
              <RotateCcw className="w-5 h-5" />
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
              placeholder="¿Qué falta en casa?"
              className="w-full p-3 pr-14 rounded-t-3xl rounded-b-2xl border-2 border-yellow-200 bg-white shadow-sm focus:border-yellow-400 focus:ring-0 focus:outline-none text-base placeholder:text-stone-400"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-yellow-200 rounded-b-3xl shadow-lg mt-1 max-h-48 overflow-y-auto z-50">
                {suggestions.map((s, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectSuggestion(s)}
                    className="p-3 hover:bg-yellow-50 cursor-pointer flex justify-between items-center text-stone-700 border-b border-stone-50 last:border-0"
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-stone-400 bg-stone-100 px-2 py-1 rounded-full">{s.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 p-3 rounded-2xl border border-yellow-200 bg-white text-stone-600 text-sm focus:border-yellow-400 focus:outline-none appearance-none"
            >
              {Object.keys(categories).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!newItemText.trim()}
              className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold rounded-2xl px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm active:scale-95"
            >
              <Plus className="w-6 h-6" />
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
        onConfirm={() => setItems(items.map((item) => ({ ...item, completed: false })))}
        title="¿Nueva semana?"
        message="Todos los productos completados volverán a la lista de compras pendientes."
        confirmText="Reiniciar"
        cancelText="Cancelar"
        icon={RotateCcw}
        iconColor="text-yellow-600"
        iconBg="bg-yellow-100"
      />
    </div>
  );
}

// Exportamos utilidades para pruebas unitarias
export {
  DB_KEY,
  DEFAULT_ITEMS,
  DEFAULT_CATEGORIES,
  DEFAULT_MASTER_LIST,
  loadDb,
  getInitialCategories,
  getInitialMasterList,
  getInitialItems,
  getInitialFavorites,

};

