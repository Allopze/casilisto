/**
 * Sección de favoritos y reponer completados
 */
import React from 'react';
import { RefreshCw, Star } from 'lucide-react';

export default function FavoritesBar({ favorites, itemsCompleted, onAddFavorite, onRepeatCompleted }) {
  // Mostrar tip si no hay favoritos pero sí hay items completados
  const showFavoritesTip = favorites.length === 0 && itemsCompleted.length > 0;

  if (favorites.length === 0 && itemsCompleted.length === 0) {
    return null;
  }

  return (
    <div className="mb-5 space-y-3">
      {itemsCompleted.length > 0 && (
        <button
          onClick={onRepeatCompleted}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white border border-yellow-200 shadow-sm text-yellow-900 hover:bg-yellow-50 active:scale-[0.98] transition-all focus:ring-2 focus:ring-yellow-300 focus:outline-none"
          aria-label={`Reponer ${itemsCompleted.length} productos completados a la lista de compras`}
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span className="font-bold">Reponer completados</span>
          </div>
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-full font-medium">
            {itemsCompleted.length} {itemsCompleted.length === 1 ? 'listo' : 'listos'}
          </span>
        </button>
      )}

      {favorites.length > 0 && (
        <div className="bg-white/80 border border-stone-100 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-stone-600 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
              Favoritos
            </h3>
            <span className="text-xs text-stone-400">{favorites.length} {favorites.length === 1 ? 'atajo' : 'atajos'}</span>
          </div>
          <div className="flex flex-wrap gap-2" role="list" aria-label="Lista de favoritos">
            {favorites.map((fav, idx) => (
              <button
                key={idx}
                onClick={() => onAddFavorite(fav)}
                className="px-3 py-2 rounded-xl bg-yellow-100 text-yellow-800 text-sm border border-yellow-200 hover:bg-yellow-200 active:scale-95 transition-all focus:ring-2 focus:ring-yellow-300 focus:outline-none"
                aria-label={`Añadir ${fav.text} a la lista`}
                role="listitem"
              >
                + {fav.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {showFavoritesTip && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-stone-400 bg-stone-50 rounded-xl">
          <Star className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Marca productos como favoritos para acceso rápido</span>
        </div>
      )}
    </div>
  );
}
