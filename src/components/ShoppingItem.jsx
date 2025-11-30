/**
 * Componente que muestra un ítem de la lista de compras
 */
import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Minus, GripVertical, ChevronUp, Edit3, Star } from 'lucide-react';
import useNative from '../hooks/useNative';

export default function ShoppingItem({
  item,
  isExpanded,
  isDragging,
  isDragOver,
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

  const handleToggle = useCallback(async () => {
    if (isBacoProtected) {
      // Vibrar usando haptics nativo o fallback
      await vibrate('error');
      // Activar animación de shake
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }
    // Vibración al marcar/desmarcar completado
    await vibrate('light');
    onToggle();
  }, [isBacoProtected, vibrate, onToggle]);

  return (
    <div
      data-index={item.originalIndex}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`relative bg-white rounded-2xl shadow-sm border transition-all duration-200 touch-manipulation select-none-all ${
        isDragging ? 'opacity-30 scale-95 bg-stone-50 border-stone-100' : ''
      } ${isDragOver ? 'transform translate-y-2 border-yellow-400 border-2' : ''} ${
        isBacoProtected ? 'border-purple-200 bg-purple-50/30' : 'border-stone-100'
      } ${isShaking ? 'animate-shake' : ''}`}
      role="listitem"
      aria-label={`${item.text}, cantidad ${item.quantity}`}
    >
      {/* Indicador de inserción cuando hay drag over */}
      {isDragOver && (
        <div className="absolute -top-3 left-4 right-4 h-1 bg-yellow-400 rounded-full shadow-lg" />
      )}
      <div className="flex items-center p-3 relative">
        {/* Drag handle - área táctil aumentada */}
        <div
          className="mr-1 text-stone-300 cursor-grab active:cursor-grabbing p-3 -ml-3 -my-1 touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          aria-label="Arrastrar para reordenar"
          role="button"
        >
          <GripVertical className="w-5 h-5" aria-hidden="true" />
        </div>
        
        {/* Checkbox - zona táctil aumentada a 44x44 */}
        <div
          onClick={handleToggle}
          className={`w-11 h-11 -m-1.5 flex items-center justify-center cursor-pointer`}
          role="checkbox"
          aria-checked="false"
          aria-label={`Marcar ${item.text} como completado`}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleToggle()}
        >
          <div className={`w-7 h-7 rounded-xl border-2 flex-shrink-0 flex items-center justify-center active:scale-90 transition-all ${
            isBacoProtected 
              ? 'border-purple-300 bg-purple-100 hover:border-purple-400' 
              : 'border-stone-200 bg-stone-50 hover:border-yellow-400'
          }`}>
          </div>
        </div>
        
        {/* Texto del item */}
        <div className="flex-1 min-w-0 pr-2 cursor-pointer ml-2" onClick={handleToggle}>
          <span className="text-lg font-medium text-stone-800 block truncate">{item.text}</span>
        </div>
        
        {/* Botón editar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className={`p-2.5 rounded-xl transition-colors mr-1 focus:ring-2 focus:ring-yellow-300 focus:outline-none ${isExpanded ? 'bg-yellow-100 text-yellow-700' : 'text-stone-300 hover:bg-stone-100'}`}
          aria-label={isExpanded ? 'Cerrar edición' : 'Editar producto'}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" aria-hidden="true" /> : <Edit3 className="w-5 h-5" aria-hidden="true" />}
        </button>
        
        {/* Control de cantidad */}
        <div className="flex items-center bg-stone-50 rounded-xl p-1 border border-stone-100" role="group" aria-label="Control de cantidad">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuantityChange(-1);
            }}
            className="w-8 h-8 flex items-center justify-center text-stone-400 hover:bg-white hover:text-red-500 rounded-lg transition-colors active:scale-90 focus:ring-2 focus:ring-red-200 focus:outline-none"
            aria-label="Reducir cantidad"
            disabled={item.quantity <= 1}
          >
            <Minus className="w-4 h-4" aria-hidden="true" />
          </button>
          <span className="w-7 text-center font-bold text-stone-700 text-sm select-none" aria-live="polite">{item.quantity}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuantityChange(1);
            }}
            className="w-8 h-8 flex items-center justify-center text-stone-400 hover:bg-white hover:text-green-600 rounded-lg transition-colors active:scale-90 focus:ring-2 focus:ring-green-200 focus:outline-none"
            aria-label="Aumentar cantidad"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-stone-100 bg-yellow-50/50 p-4 rounded-b-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="grid gap-3">
            <div>
              <label htmlFor={`edit-name-${item.id}`} className="text-xs font-bold text-stone-400 uppercase ml-1">Editar Nombre</label>
              <input
                id={`edit-name-${item.id}`}
                type="text"
                value={item.text}
                onChange={(e) => onEditChange('text', e.target.value)}
                className="w-full p-2.5 rounded-xl border border-yellow-200 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 bg-white transition-all"
              />
            </div>
            <div>
              <label htmlFor={`edit-category-${item.id}`} className="text-xs font-bold text-stone-400 uppercase ml-1">Mover a Pasillo</label>
              <select
                id={`edit-category-${item.id}`}
                value={item.category}
                onChange={(e) => onEditChange('category', e.target.value)}
                className="w-full p-2.5 rounded-xl border border-yellow-200 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 bg-white text-sm transition-all"
              >
                {Object.keys(categories).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            {/* Botones en stack vertical para móviles */}
            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <button
                onClick={onToggleFavorite}
                className={`flex-1 h-11 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all focus:ring-2 focus:outline-none ${
                  isFavorite 
                    ? 'bg-yellow-200 text-yellow-900 focus:ring-yellow-300' 
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 focus:ring-stone-300'
                }`}
                aria-pressed={isFavorite}
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-600' : ''}`} aria-hidden="true" />
                {isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
              </button>
              <button
                onClick={onDelete}
                className="flex-1 sm:flex-none h-11 px-4 bg-red-100 text-red-600 rounded-xl font-bold text-sm hover:bg-red-200 flex items-center justify-center gap-2 transition-all focus:ring-2 focus:ring-red-300 focus:outline-none"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
