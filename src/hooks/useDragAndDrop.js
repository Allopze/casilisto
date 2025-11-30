/**
 * Hook para manejar drag & drop / touch reordering de items.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import useNative from './useNative';

export function useDragAndDrop(items, setItems) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragOverlay, setDragOverlay] = useState(null);
  const dragItem = useRef(null);
  const autoScrollRef = useRef(null);
  const lastReorderTime = useRef(0);
  const { vibrate } = useNative();

  // P3: Cancelar animación en cleanup del efecto
  useEffect(() => {
    return () => {
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
        autoScrollRef.current = null;
      }
    };
  }, []);

  const handleReorder = useCallback((targetIndex) => {
    if (dragItem.current !== null && dragItem.current !== targetIndex) {
      // Throttle reorder para evitar actualizaciones muy rápidas
      const now = Date.now();
      if (now - lastReorderTime.current < 50) return;
      lastReorderTime.current = now;
      
      const newItems = [...items];
      const draggedItemContent = newItems[dragItem.current];
      const targetItemContent = newItems[targetIndex];
      if (draggedItemContent.category !== targetItemContent.category) {
        draggedItemContent.category = targetItemContent.category;
      }
      newItems.splice(dragItem.current, 1);
      newItems.splice(targetIndex, 0, draggedItemContent);
      dragItem.current = targetIndex;
      setDragOverIndex(targetIndex);
      setItems(newItems);
      
      // Vibración suave al reordenar
      vibrate('light');
    }
  }, [items, setItems, vibrate]);

  // Auto-scroll cuando el item está cerca del borde
  const startAutoScroll = useCallback((clientY) => {
    const scrollThreshold = 100; // px desde el borde para activar scroll
    const scrollSpeed = 8; // px por frame
    
    const doScroll = () => {
      if (clientY < scrollThreshold) {
        // Cerca del borde superior - scroll hacia arriba
        window.scrollBy(0, -scrollSpeed);
      } else if (clientY > window.innerHeight - scrollThreshold) {
        // Cerca del borde inferior - scroll hacia abajo
        window.scrollBy(0, scrollSpeed);
      }
    };
    
    // Limpiar intervalo anterior si existe
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
    }
    
    // Solo iniciar scroll si está cerca de los bordes
    if (clientY < scrollThreshold || clientY > window.innerHeight - scrollThreshold) {
      const scrollLoop = () => {
        doScroll();
        autoScrollRef.current = requestAnimationFrame(scrollLoop);
      };
      autoScrollRef.current = requestAnimationFrame(scrollLoop);
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const onDragStart = useCallback((e, index) => {
    dragItem.current = index;
    setDraggingId(items[index].id);
    setDragOverIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Vibración al iniciar arrastre
    vibrate('medium');
  }, [items, vibrate]);

  const onDragEnter = useCallback((_e, index) => {
    handleReorder(index);
  }, [handleReorder]);

  const onDragEnd = useCallback(() => {
    dragItem.current = null;
    setDraggingId(null);
    setDragOverIndex(null);
    stopAutoScroll();
    // Vibración al soltar
    vibrate('light');
  }, [stopAutoScroll, vibrate]);

  const handleTouchStart = useCallback((e, item, index) => {
    const touch = e.touches[0];
    const target = e.currentTarget.parentElement;
    const rect = target.getBoundingClientRect();
    dragItem.current = index;
    setDraggingId(item.id);
    setDragOverIndex(index);
    setDragOverlay({
      item,
      x: touch.clientX,
      y: touch.clientY,
      width: rect.width,
      height: rect.height,
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    });
    document.body.style.overflow = 'hidden';
    // Prevenir selección de texto
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    // Vibración al iniciar arrastre táctil
    vibrate('medium');
  }, [vibrate]);

  const handleTouchMove = useCallback((e) => {
    if (!draggingId || !dragOverlay) return;
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    
    // Actualizar posición del overlay
    setDragOverlay((prev) => ({ ...prev, x: touch.clientX, y: touch.clientY }));
    
    // Auto-scroll si está cerca de los bordes
    startAutoScroll(touch.clientY);
    
    // Buscar elemento debajo del dedo
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element) {
      const row = element.closest('[data-index]');
      if (row) {
        const targetIndex = parseInt(row.getAttribute('data-index'), 10);
        if (!isNaN(targetIndex) && targetIndex !== dragItem.current) {
          handleReorder(targetIndex);
        }
      }
    }
  }, [draggingId, dragOverlay, startAutoScroll, handleReorder]);

  const handleTouchEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverlay(null);
    setDragOverIndex(null);
    dragItem.current = null;
    document.body.style.overflow = '';
    // Restaurar selección de texto
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    stopAutoScroll();
    // Vibración al soltar
    vibrate('light');
  }, [stopAutoScroll, vibrate]);

  return {
    draggingId,
    dragOverIndex,
    dragOverlay,
    onDragStart,
    onDragEnter,
    onDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

export default useDragAndDrop;
