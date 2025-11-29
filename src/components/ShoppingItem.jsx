/**
 * Componente que muestra un ítem de la lista de compras
 */
import React, { useState } from 'react';
import { Plus, Trash2, Minus, GripVertical, ChevronUp, Edit3 } from 'lucide-react';
import useNative from '../hooks/useNative';

export default function ShoppingItem({
  item,
  isExpanded,
  isDragging,
  categories,
  isFavorite,
  bacoMode,
  onToggle,
  onExpand,
  onQuantityChange,
  onEditChange,
  onDelete,
  onToggleFavorite,
  dragHandlers,
}) {
  const { onDragStart, onDragEnter, onDragEnd, onTouchStart, onTouchMove, onTouchEnd } = dragHandlers;
  const [isShaking, setIsShaking] = useState(false);
  const { vibrate } = useNative();

  // Verificar si el item es de la categoría Vinos y Modo Baco está activo
  const isBacoProtected = bacoMode && item.category === 'Vinos';

  const handleToggle = async () => {
    if (isBacoProtected) {
      // Vibrar usando haptics nativo o fallback
      await vibrate('error');
      // Activar animación de shake
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }
    onToggle();
  };

  return (
    <div
      data-index={item.originalIndex}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`bg-white rounded-3xl shadow-sm border transition-all touch-manipulation ${
        isDragging ? 'opacity-30 bg-stone-50 border-stone-100' : ''
      } ${isBacoProtected ? 'border-purple-200 bg-purple-50/30' : 'border-stone-100'} ${
        isShaking ? 'animate-shake' : ''
      }`}
      style={isShaking ? {
        animation: 'shake 0.5s ease-in-out'
      } : {}}
    >
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}</style>
      <div className="flex items-center p-3 relative">
        <div
          className="mr-2 text-stone-300 cursor-grab active:cursor-grabbing p-2 -ml-2 touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <GripVertical className="w-5 h-5" />
        </div>
        <div
          onClick={handleToggle}
          className={`w-8 h-8 rounded-2xl border-2 mr-3 flex-shrink-0 flex items-center justify-center cursor-pointer active:scale-90 transition-all ${
            isBacoProtected 
              ? 'border-purple-300 bg-purple-100 hover:border-purple-400' 
              : 'border-stone-200 bg-stone-50 hover:border-yellow-400'
          }`}
        >
        </div>
        <div className="flex-1 min-w-0 pr-2 cursor-pointer" onClick={handleToggle}>
          <span className="text-lg font-medium text-stone-800 block truncate">{item.text}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className={`p-2 rounded-xl transition-colors mr-1 ${isExpanded ? 'bg-yellow-100 text-yellow-700' : 'text-stone-300 hover:bg-stone-100'}`}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
        </button>
        <div className="flex items-center bg-stone-50 rounded-xl p-1 border border-stone-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuantityChange(-1);
            }}
            className="w-7 h-7 flex items-center justify-center text-stone-400 hover:bg-white hover:text-red-500 rounded-lg transition-colors active:scale-90"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-6 text-center font-bold text-stone-700 text-sm select-none">{item.quantity}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuantityChange(1);
            }}
            className="w-7 h-7 flex items-center justify-center text-stone-400 hover:bg-white hover:text-green-600 rounded-lg transition-colors active:scale-90"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-stone-100 bg-yellow-50/50 p-4 rounded-b-3xl animate-in slide-in-from-top-2 duration-200">
          <div className="grid gap-3">
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase ml-1">Editar Nombre</label>
              <input
                type="text"
                value={item.text}
                onChange={(e) => onEditChange('text', e.target.value)}
                className="w-full p-2 rounded-xl border border-yellow-200 focus:outline-none focus:border-yellow-400 bg-white"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-stone-400 uppercase ml-1">Mover a Pasillo</label>
                <select
                  value={item.category}
                  onChange={(e) => onEditChange('category', e.target.value)}
                  className="w-full p-2 rounded-xl border border-yellow-200 focus:outline-none focus:border-yellow-400 bg-white text-sm h-10"
                >
                  {Object.keys(categories).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={onToggleFavorite}
                  className={`h-10 px-4 rounded-xl font-bold text-sm flex items-center gap-2 mr-2 ${isFavorite ? 'bg-yellow-200 text-yellow-900' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  {isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
                </button>
                <button
                  onClick={onDelete}
                  className="h-10 px-4 bg-red-100 text-red-600 rounded-xl font-bold text-sm hover:bg-red-200 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
