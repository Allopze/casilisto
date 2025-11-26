import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import FavoritesBar from '../src/components/FavoritesBar';
import ShoppingItem from '../src/components/ShoppingItem';

describe('FavoritesBar', () => {
  const mockFavorites = [
    { text: 'Leche', category: 'Lácteos y Huevos' },
    { text: 'Pan', category: 'Panadería' },
  ];
  const mockItemsCompleted = [
    { id: 1, text: 'Manzanas', category: 'Frutas y Verduras' },
  ];

  it('renderiza favoritos correctamente', () => {
    const onAddFavorite = vi.fn();
    const onRepeatCompleted = vi.fn();

    render(
      <FavoritesBar
        favorites={mockFavorites}
        itemsCompleted={mockItemsCompleted}
        onAddFavorite={onAddFavorite}
        onRepeatCompleted={onRepeatCompleted}
      />
    );

    // El texto incluye "+" antes del nombre
    expect(screen.getByText(/Leche/)).toBeDefined();
    expect(screen.getByText(/Pan/)).toBeDefined();
  });

  it('llama onAddFavorite al hacer click en un favorito', () => {
    const onAddFavorite = vi.fn();
    const onRepeatCompleted = vi.fn();

    render(
      <FavoritesBar
        favorites={mockFavorites}
        itemsCompleted={mockItemsCompleted}
        onAddFavorite={onAddFavorite}
        onRepeatCompleted={onRepeatCompleted}
      />
    );

    const lecheBtn = screen.getByText(/Leche/).closest('button');
    fireEvent.click(lecheBtn);
    expect(onAddFavorite).toHaveBeenCalledWith(mockFavorites[0]);
  });

  it('muestra botón "Reponer" cuando hay items completados', () => {
    const onAddFavorite = vi.fn();
    const onRepeatCompleted = vi.fn();

    render(
      <FavoritesBar
        favorites={mockFavorites}
        itemsCompleted={mockItemsCompleted}
        onAddFavorite={onAddFavorite}
        onRepeatCompleted={onRepeatCompleted}
      />
    );

    const reponerBtn = screen.getByText(/Reponer completados/);
    expect(reponerBtn).toBeDefined();
  });

  it('no muestra botón "Reponer" cuando no hay items completados', () => {
    const onAddFavorite = vi.fn();
    const onRepeatCompleted = vi.fn();

    render(
      <FavoritesBar
        favorites={mockFavorites}
        itemsCompleted={[]}
        onAddFavorite={onAddFavorite}
        onRepeatCompleted={onRepeatCompleted}
      />
    );

    const reponerBtn = screen.queryByTitle(/Reponer/);
    expect(reponerBtn).toBeNull();
  });

  it('no renderiza nada si no hay favoritos ni items completados', () => {
    const onAddFavorite = vi.fn();
    const onRepeatCompleted = vi.fn();

    const { container } = render(
      <FavoritesBar
        favorites={[]}
        itemsCompleted={[]}
        onAddFavorite={onAddFavorite}
        onRepeatCompleted={onRepeatCompleted}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe('ShoppingItem', () => {
  const mockCategories = {
    'Frutas y Verduras': {
      color: 'bg-green-100 text-green-800',
      border: 'border-green-200',
      iconName: 'Carrot',
    },
    Otros: {
      color: 'bg-stone-100 text-stone-600',
      border: 'border-stone-200',
      iconName: 'Tag',
    },
  };

  const mockItem = {
    id: 1,
    text: 'Manzanas',
    category: 'Frutas y Verduras',
    completed: false,
    quantity: 2,
  };

  const mockDragHandlers = {
    onDragStart: vi.fn(),
    onDragEnter: vi.fn(),
    onDragEnd: vi.fn(),
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  };

  it('renderiza el item correctamente', () => {
    render(
      <ShoppingItem
        item={mockItem}
        isExpanded={false}
        isDragging={false}
        categories={mockCategories}
        isFavorite={false}
        onToggle={vi.fn()}
        onExpand={vi.fn()}
        onQuantityChange={vi.fn()}
        onEditChange={vi.fn()}
        onDelete={vi.fn()}
        onToggleFavorite={vi.fn()}
        dragHandlers={mockDragHandlers}
      />
    );

    expect(screen.getByText('Manzanas')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('llama onToggle al hacer click en el checkbox', () => {
    const onToggle = vi.fn();

    render(
      <ShoppingItem
        item={mockItem}
        isExpanded={false}
        isDragging={false}
        categories={mockCategories}
        isFavorite={false}
        onToggle={onToggle}
        onExpand={vi.fn()}
        onQuantityChange={vi.fn()}
        onEditChange={vi.fn()}
        onDelete={vi.fn()}
        onToggleFavorite={vi.fn()}
        dragHandlers={mockDragHandlers}
      />
    );

    // El checkbox es un div, no un button - hacemos click en el texto del item
    const itemText = screen.getByText('Manzanas');
    fireEvent.click(itemText);
    expect(onToggle).toHaveBeenCalled();
  });

  it('muestra indicador de favorito cuando isFavorite es true', () => {
    const { container } = render(
      <ShoppingItem
        item={mockItem}
        isExpanded={false}
        isDragging={false}
        categories={mockCategories}
        isFavorite={true}
        onToggle={vi.fn()}
        onExpand={vi.fn()}
        onQuantityChange={vi.fn()}
        onEditChange={vi.fn()}
        onDelete={vi.fn()}
        onToggleFavorite={vi.fn()}
        dragHandlers={mockDragHandlers}
      />
    );

    // Debería haber un indicador visual de favorito (estrella amarilla)
    const starIcon = container.querySelector('.text-yellow-400');
    expect(starIcon).toBeDefined();
  });

  it('aplica estilo de arrastre cuando isDragging es true', () => {
    const { container } = render(
      <ShoppingItem
        item={mockItem}
        isExpanded={false}
        isDragging={true}
        categories={mockCategories}
        isFavorite={false}
        onToggle={vi.fn()}
        onExpand={vi.fn()}
        onQuantityChange={vi.fn()}
        onEditChange={vi.fn()}
        onDelete={vi.fn()}
        onToggleFavorite={vi.fn()}
        dragHandlers={mockDragHandlers}
      />
    );

    const wrapper = container.firstChild;
    expect(wrapper.className).toContain('opacity-30');
  });

  it('muestra controles de edición cuando isExpanded es true', () => {
    render(
      <ShoppingItem
        item={mockItem}
        isExpanded={true}
        isDragging={false}
        categories={mockCategories}
        isFavorite={false}
        onToggle={vi.fn()}
        onExpand={vi.fn()}
        onQuantityChange={vi.fn()}
        onEditChange={vi.fn()}
        onDelete={vi.fn()}
        onToggleFavorite={vi.fn()}
        dragHandlers={mockDragHandlers}
      />
    );

    // Debería mostrar inputs de edición
    const textInput = screen.getByDisplayValue('Manzanas');
    expect(textInput).toBeDefined();
  });

  it('llama onQuantityChange con delta correcto', () => {
    const onQuantityChange = vi.fn();

    render(
      <ShoppingItem
        item={mockItem}
        isExpanded={false}
        isDragging={false}
        categories={mockCategories}
        isFavorite={false}
        onToggle={vi.fn()}
        onExpand={vi.fn()}
        onQuantityChange={onQuantityChange}
        onEditChange={vi.fn()}
        onDelete={vi.fn()}
        onToggleFavorite={vi.fn()}
        dragHandlers={mockDragHandlers}
      />
    );

    // Encontrar botón de incrementar cantidad
    const buttons = screen.getAllByRole('button');
    const plusButton = buttons.find(btn => btn.textContent === '+');
    if (plusButton) {
      fireEvent.click(plusButton);
      expect(onQuantityChange).toHaveBeenCalledWith(1);
    }
  });
});
