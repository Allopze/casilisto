/**
 * Hook para manejar drag & drop / touch reordering de items.
 */
import { useState, useRef } from 'react';

export function useDragAndDrop(items, setItems) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverlay, setDragOverlay] = useState(null);
  const dragItem = useRef(null);

  const handleReorder = (targetIndex) => {
    if (dragItem.current !== null && dragItem.current !== targetIndex) {
      const newItems = [...items];
      const draggedItemContent = newItems[dragItem.current];
      const targetItemContent = newItems[targetIndex];
      if (draggedItemContent.category !== targetItemContent.category) {
        draggedItemContent.category = targetItemContent.category;
      }
      newItems.splice(dragItem.current, 1);
      newItems.splice(targetIndex, 0, draggedItemContent);
      dragItem.current = targetIndex;
      setItems(newItems);
    }
  };

  const onDragStart = (e, index) => {
    dragItem.current = index;
    setDraggingId(items[index].id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragEnter = (_e, index) => {
    handleReorder(index);
  };

  const onDragEnd = () => {
    dragItem.current = null;
    setDraggingId(null);
  };

  const handleTouchStart = (e, item, index) => {
    const touch = e.touches[0];
    const target = e.currentTarget.parentElement;
    const rect = target.getBoundingClientRect();
    dragItem.current = index;
    setDraggingId(item.id);
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
  };

  const handleTouchMove = (e) => {
    if (!draggingId || !dragOverlay) return;
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    setDragOverlay((prev) => ({ ...prev, x: touch.clientX, y: touch.clientY }));
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
  };

  const handleTouchEnd = () => {
    setDraggingId(null);
    setDragOverlay(null);
    dragItem.current = null;
    document.body.style.overflow = '';
  };

  return {
    draggingId,
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
