/**
 * Sección de favoritos y reponer completados
 */
import React from 'react';

export default function FavoritesBar({ favorites, itemsCompleted, onAddFavorite, onRepeatCompleted }) {
  if (favorites.length === 0 && itemsCompleted.length === 0) return null;

  return (
    <div className="mb-5 space-y-3">
      {itemsCompleted.length > 0 && (
        <button
          onClick={onRepeatCompleted}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-yellow-200 shadow-sm text-yellow-900 hover:bg-yellow-50 active:scale-95"
        >
          <span className="font-bold">Reponer completados</span>
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
            {itemsCompleted.length} listos
          </span>
        </button>
      )}

      {favorites.length > 0 && (
        <div className="bg-white/80 border border-stone-100 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-stone-600">Favoritos</h3>
            <span className="text-xs text-stone-400">{favorites.length} atajos</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {favorites.map((fav, idx) => (
              <button
                key={idx}
                onClick={() => onAddFavorite(fav)}
                className="px-3 py-2 rounded-xl bg-yellow-100 text-yellow-800 text-sm border border-yellow-200 hover:bg-yellow-200 active:scale-95"
              >
                + {fav.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
