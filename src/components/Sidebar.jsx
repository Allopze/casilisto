/**
 * Componente Sidebar para configuración (categorías, productos master, etc.)
 */
import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Settings,
  Tag,
} from 'lucide-react';

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
}) {
  const [expandedSettingsCat, setExpandedSettingsCat] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(COLOR_PRESETS[0]);
  const [newMasterItemText, setNewMasterItemText] = useState('');

  const addCategory = () => {
    if (!newCatName.trim()) return;
    if (categories[newCatName]) {
      alert('Ya existe una categoría con ese nombre');
      return;
    }
    const newCategoryData = {
      color: `${newCatColor.bg} ${newCatColor.text}`,
      border: newCatColor.border,
      iconName: 'Tag',
    };
    setCategories({ ...categories, [newCatName.trim()]: newCategoryData });
    setNewCatName('');
  };

  const deleteCategory = (catName) => {
    if (catName === 'Otros') {
      alert('No puedes borrar la categoría "Otros"');
      return;
    }
    if (window.confirm(`¿Borrar categoría "${catName}"? Los productos pasarán a "Otros".`)) {
      const newCats = { ...categories };
      delete newCats[catName];
      setCategories(newCats);
      setMasterList(masterList.map((item) => (item.category === catName ? { ...item, category: 'Otros' } : item)));
      setItems(items.map((item) => (item.category === catName ? { ...item, category: 'Otros' } : item)));
    }
  };

  const addMasterItemToCat = (catName) => {
    if (!newMasterItemText.trim()) return;
    const exists = masterList.some((item) => item.name.toLowerCase() === newMasterItemText.trim().toLowerCase());
    if (exists) {
      alert('Este producto ya existe en la lista maestra.');
      return;
    }
    setMasterList([...masterList, { name: newMasterItemText.trim(), category: catName }]);
    setNewMasterItemText('');
  };

  const removeMasterItem = (itemName) => {
    if (window.confirm(`¿Borrar "${itemName}" de la lista de sugerencias?`)) {
      setMasterList(masterList.filter((item) => item.name !== itemName));
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
            <Settings className="w-6 h-6" /> Configuración
          </h2>
          <button onClick={onClose} className="p-3 bg-yellow-400/50 hover:bg-yellow-400 rounded-full text-yellow-900">
            <X className="w-7 h-7" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8">
          {/* Añadir Categoría */}
          <div className="bg-yellow-50 p-5 rounded-3xl border border-yellow-200 shadow-sm">
            <h3 className="font-bold text-lg text-yellow-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" /> Nueva Categoría
            </h3>
            <input
              type="text"
              placeholder="Nombre (ej. Bebé)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full p-3 mb-4 rounded-xl border border-yellow-200 text-base"
            />
            <div className="relative">
              <div className="flex gap-4 overflow-x-auto py-3 px-1 mb-2 no-scrollbar scroll-mask pr-6">
                {COLOR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setNewCatColor(preset)}
                    className={`w-10 h-10 rounded-full flex-shrink-0 border-2 shadow-sm ${preset.bg} ${newCatColor.name === preset.name ? 'border-stone-800 scale-110 ring-2 ring-yellow-400 ring-offset-2' : 'border-transparent'}`}
                    title={preset.name}
                  />
                ))}
                <div className="w-4 flex-shrink-0"></div>
              </div>
            </div>
            <button
              onClick={addCategory}
              disabled={!newCatName}
              className="w-full py-3 bg-yellow-400 text-yellow-900 font-bold rounded-2xl text-base disabled:opacity-50 mt-2 shadow-sm active:scale-95 transition-transform"
            >
              Crear Categoría
            </button>
          </div>

          {/* Lista de Categorías */}
          <div>
            <h3 className="font-bold text-stone-400 uppercase text-sm mb-4 px-2">Categorías y Productos</h3>
            <div className="space-y-3">
              {Object.keys(categories).map((catName) => {
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
                        {catName !== 'Otros' && (
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
                            className="flex-1 p-3 rounded-xl border border-stone-200 text-base shadow-sm"
                          />
                          <button
                            onClick={() => addMasterItemToCat(catName)}
                            className="bg-stone-200 p-3 rounded-xl text-stone-600 hover:bg-stone-300 active:scale-95"
                          >
                            <Plus className="w-6 h-6" />
                          </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {masterList
                            .filter((i) => i.category === catName)
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
        </div>
      </div>
    </div>
  );
}
