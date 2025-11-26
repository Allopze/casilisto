import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DB_KEY,
  DEFAULT_ITEMS,
  DEFAULT_CATEGORIES,
  DEFAULT_MASTER_LIST,
  loadDb,
  getInitialCategories,
  getInitialMasterList,
  getInitialItems,
  getInitialFavorites,
  normalizeCategoryName,
} from '../src/hooks/useLocalDb';

// Sencillo stub de localStorage para pruebas
const makeStorage = () => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe('Base de datos local (helpers)', () => {
  let originalLocalStorage;

  beforeEach(() => {
    originalLocalStorage = global.localStorage;
    global.localStorage = makeStorage();
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
  });

  it('loadDb devuelve null cuando no hay datos', () => {
    expect(loadDb()).toBeNull();
  });

  it('getInitial... devuelve defaults normalizados si no hay nada en storage', () => {
    const cats = getInitialCategories();
    const master = getInitialMasterList();
    const items = getInitialItems();
    expect(cats['Lácteos y Huevos']).toBeDefined();
    expect(master[0].category).toBeDefined();
    expect(items.length).toBeGreaterThan(0);
  });

  it('getInitial... prioriza DB_KEY si existe', () => {
    const payload = {
      categories: { Demo: { color: 'bg-red-100 text-red-800', border: 'border-red-200', iconName: 'Carrot' } },
      masterList: [{ name: 'X', category: 'Demo' }],
      items: [{ id: 1, text: 'X', category: 'Demo', completed: false, quantity: 1 }],
    };
    global.localStorage.setItem(DB_KEY, JSON.stringify(payload));
    expect(getInitialCategories()).toEqual(payload.categories);
    expect(getInitialMasterList()).toEqual(payload.masterList);
    expect(getInitialItems()).toEqual(payload.items);
  });

  it('getInitial... usa claves legacy si no hay DB_KEY', () => {
    const categories = { Legacy: { color: 'bg-blue-100 text-blue-800', border: 'border-blue-200', iconName: 'Carrot' } };
    const masterList = [{ name: 'Legacy item', category: 'Legacy' }];
    const items = [{ id: 99, text: 'Legacy item', category: 'Legacy', completed: false, quantity: 2 }];
    global.localStorage.setItem('shoppingListCategories', JSON.stringify(categories));
    global.localStorage.setItem('shoppingListMaster', JSON.stringify(masterList));
    global.localStorage.setItem('shoppingListV5', JSON.stringify(items));

    expect(getInitialCategories()).toEqual(categories);
    expect(getInitialMasterList()).toEqual(masterList);
    expect(getInitialItems()).toEqual(items);
  });

  it('listas por defecto no contienen caracteres corruptos (encoding)', () => {
    const hasBadChar = (str) => typeof str === 'string' && /[�ÃÂ]/.test(str);

    expect(Object.keys(DEFAULT_CATEGORIES).some(hasBadChar)).toBe(false);
    expect(DEFAULT_MASTER_LIST.some((i) => hasBadChar(i.name) || hasBadChar(i.category))).toBe(false);
    expect(DEFAULT_ITEMS.some((i) => hasBadChar(i.text) || hasBadChar(i.category))).toBe(false);
  });
});

describe('normalizeCategoryName', () => {
  it('normaliza categorías con mojibake UTF-8 a nombres correctos', () => {
    // Double-encoded UTF-8 patterns that occur in practice
    expect(normalizeCategoryName('LÃ¡cteos y Huevos')).toBe('Lácteos y Huevos');
    expect(normalizeCategoryName('Lacteos y Huevos')).toBe('Lácteos y Huevos');
    expect(normalizeCategoryName('PanaderÃ­a y Dulces')).toBe('Panadería y Dulces');
  });

  it('devuelve el nombre original si no hay mojibake', () => {
    expect(normalizeCategoryName('Lácteos y Huevos')).toBe('Lácteos y Huevos');
    expect(normalizeCategoryName('Frutas y Verduras')).toBe('Frutas y Verduras');
  });

  it('maneja strings vacíos correctamente', () => {
    expect(normalizeCategoryName('')).toBe('');
  });
});

describe('Favoritos', () => {
  let originalLocalStorage;

  beforeEach(() => {
    originalLocalStorage = global.localStorage;
    global.localStorage = makeStorage();
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
  });

  it('getInitialFavorites devuelve array vacío por defecto', () => {
    const favorites = getInitialFavorites();
    expect(Array.isArray(favorites)).toBe(true);
    expect(favorites.length).toBe(0);
  });

  it('getInitialFavorites carga desde DB_KEY si existe', () => {
    const payload = {
      categories: {},
      masterList: [],
      items: [],
      favorites: [{ text: 'Leche', category: 'Lácteos y Huevos' }],
    };
    global.localStorage.setItem(DB_KEY, JSON.stringify(payload));
    const favorites = getInitialFavorites();
    expect(favorites).toEqual(payload.favorites);
  });

  it('getInitialFavorites normaliza categorías corruptas en favoritos', () => {
    const payload = {
      categories: {},
      masterList: [],
      items: [],
      favorites: [{ text: 'Test', category: 'LÃ¡cteos y Huevos' }],
    };
    global.localStorage.setItem(DB_KEY, JSON.stringify(payload));
    const favorites = getInitialFavorites();
    expect(favorites[0].category).toBe('Lácteos y Huevos');
  });
});
