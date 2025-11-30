/**
 * Modal de confirmación personalizado que se integra con el UI/UX de la app
 */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  icon: Icon,
  iconColor = 'text-yellow-500',
  iconBg = 'bg-yellow-100',
  confirmColor = 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900',
}) {
  const confirmButtonRef = useRef(null);

  // Focus trap y keyboard handling
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasCancelButton = cancelText && cancelText.length > 0;

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 fade-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors focus:ring-2 focus:ring-stone-300 focus:outline-none"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Icon */}
        {Icon && (
          <div className={`w-16 h-16 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-8 h-8 ${iconColor}`} aria-hidden="true" />
          </div>
        )}

        {/* Title */}
        <h3 id="modal-title" className="text-xl font-bold text-stone-800 text-center mb-2">{title}</h3>

        {/* Message */}
        <p id="modal-description" className="text-stone-500 text-center mb-6 leading-relaxed">{message}</p>

        {/* Buttons */}
        <div className={`flex gap-3 ${!hasCancelButton ? 'justify-center' : ''}`}>
          {hasCancelButton && (
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-2xl transition-colors active:scale-95 focus:ring-2 focus:ring-stone-300 focus:outline-none"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`${hasCancelButton ? 'flex-1' : 'px-8'} py-3 px-4 font-bold rounded-2xl transition-colors active:scale-95 focus:ring-2 focus:ring-offset-2 focus:outline-none ${confirmColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
