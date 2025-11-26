import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDragAndDrop from '../src/hooks/useDragAndDrop';

describe('useDragAndDrop hook', () => {
  const mockItems = [
    { id: 1, text: 'Item 1', category: 'A', completed: false },
    { id: 2, text: 'Item 2', category: 'A', completed: false },
    { id: 3, text: 'Item 3', category: 'B', completed: false },
  ];

  it('inicializa con draggingId null y sin overlay', () => {
    const setItems = vi.fn();
    const { result } = renderHook(() => useDragAndDrop(mockItems, setItems));

    expect(result.current.draggingId).toBeNull();
    expect(result.current.dragOverlay).toBeNull();
  });

  it('onDragStart establece draggingId correctamente', () => {
    const setItems = vi.fn();
    const { result } = renderHook(() => useDragAndDrop(mockItems, setItems));

    const mockEvent = {
      dataTransfer: { effectAllowed: '' },
    };

    act(() => {
      result.current.onDragStart(mockEvent, 0);
    });

    expect(result.current.draggingId).toBe(1);
  });

  it('onDragEnd limpia el estado de arrastre', () => {
    const setItems = vi.fn();
    const { result } = renderHook(() => useDragAndDrop(mockItems, setItems));

    // Primero iniciamos un drag
    const mockStartEvent = {
      dataTransfer: { effectAllowed: '' },
    };

    act(() => {
      result.current.onDragStart(mockStartEvent, 0);
    });

    expect(result.current.draggingId).toBe(1);

    // Luego terminamos el drag
    act(() => {
      result.current.onDragEnd();
    });

    expect(result.current.draggingId).toBeNull();
    expect(result.current.dragOverlay).toBeNull();
  });

  it('onDragEnter reordena items correctamente', () => {
    let currentItems = [...mockItems];
    const setItems = vi.fn((newItems) => {
      currentItems = newItems;
    });

    const { result, rerender } = renderHook(() => useDragAndDrop(currentItems, setItems));

    // Iniciamos drag del primer item
    const mockStartEvent = {
      dataTransfer: { effectAllowed: '' },
    };

    act(() => {
      result.current.onDragStart(mockStartEvent, 0);
    });

    // Entramos sobre el tercer item (índice 2)
    const mockEnterEvent = {
      preventDefault: vi.fn(),
    };

    act(() => {
      result.current.onDragEnter(mockEnterEvent, 2);
    });

    // Verificamos que setItems fue llamado
    expect(setItems).toHaveBeenCalled();
  });

  it('handleTouchStart configura overlay con datos del item', () => {
    const setItems = vi.fn();
    const { result } = renderHook(() => useDragAndDrop(mockItems, setItems));

    const mockTouch = {
      clientX: 100,
      clientY: 200,
    };

    // Mock currentTarget with parentElement
    const mockRect = {
      width: 300,
      height: 50,
      left: 50,
      top: 150,
    };

    const mockEvent = {
      touches: [mockTouch],
      currentTarget: {
        parentElement: {
          getBoundingClientRect: () => mockRect,
        },
      },
    };

    act(() => {
      result.current.handleTouchStart(mockEvent, mockItems[0], 0);
    });

    expect(result.current.draggingId).toBe(1);
    expect(result.current.dragOverlay).not.toBeNull();
    expect(result.current.dragOverlay.item).toEqual(mockItems[0]);
    expect(result.current.dragOverlay.x).toBe(100);
    expect(result.current.dragOverlay.y).toBe(200);
  });

  it('handleTouchEnd limpia estado de drag', () => {
    const setItems = vi.fn();
    const { result } = renderHook(() => useDragAndDrop(mockItems, setItems));

    // Mock para handleTouchStart
    const mockTouch = { clientX: 100, clientY: 200 };
    const mockEvent = {
      touches: [mockTouch],
      currentTarget: {
        parentElement: {
          getBoundingClientRect: () => ({ width: 300, height: 50, left: 50, top: 150 }),
        },
      },
    };

    act(() => {
      result.current.handleTouchStart(mockEvent, mockItems[0], 0);
    });

    expect(result.current.draggingId).toBe(1);

    // Terminamos el drag
    act(() => {
      result.current.handleTouchEnd();
    });

    expect(result.current.draggingId).toBeNull();
    expect(result.current.dragOverlay).toBeNull();
  });

  it('retorna todas las funciones necesarias', () => {
    const setItems = vi.fn();
    const { result } = renderHook(() => useDragAndDrop(mockItems, setItems));

    expect(typeof result.current.onDragStart).toBe('function');
    expect(typeof result.current.onDragEnter).toBe('function');
    expect(typeof result.current.onDragEnd).toBe('function');
    expect(typeof result.current.handleTouchStart).toBe('function');
    expect(typeof result.current.handleTouchMove).toBe('function');
    expect(typeof result.current.handleTouchEnd).toBe('function');
  });
});
