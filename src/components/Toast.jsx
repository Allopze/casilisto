/**
 * Componente Toast para notificaciones no intrusivas
 */
import React, { useEffect, useState } from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

const TOAST_DURATION = 3000;

const TOAST_TYPES = {
  success: {
    icon: Check,
    bg: 'bg-green-100',
    border: 'border-green-200',
    text: 'text-green-800',
    iconBg: 'bg-green-500',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-100',
    border: 'border-red-200',
    text: 'text-red-800',
    iconBg: 'bg-red-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-100',
    border: 'border-blue-200',
    text: 'text-blue-800',
    iconBg: 'bg-blue-500',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-yellow-100',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    iconBg: 'bg-yellow-500',
  },
};

export function Toast({ message, type = 'info', onClose, action, actionLabel }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const config = TOAST_TYPES[type] || TOAST_TYPES.info;
  const Icon = config.icon;

  useEffect(() => {
    // Animación de entrada
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-cerrar después de TOAST_DURATION
    const timer = setTimeout(() => {
      handleClose();
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose?.();
    }, 200);
  };

  const handleAction = () => {
    action?.();
    handleClose();
  };

  return (
    <div
      className={`fixed bottom-24 left-4 right-4 z-[100] flex justify-center pointer-events-none transition-all duration-200 ${
        isVisible && !isLeaving ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div
        className={`max-w-md w-full ${config.bg} ${config.border} border rounded-2xl shadow-lg p-4 flex items-center gap-3 pointer-events-auto`}
      >
        <div className={`w-8 h-8 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className={`flex-1 ${config.text} font-medium text-sm`}>{message}</p>
        {action && actionLabel && (
          <button
            onClick={handleAction}
            className={`${config.text} font-bold text-sm px-3 py-1.5 rounded-xl hover:bg-white/50 active:scale-95 transition-all`}
          >
            {actionLabel}
          </button>
        )}
        <button
          onClick={handleClose}
          className={`${config.text} p-1.5 rounded-lg hover:bg-white/50 transition-colors`}
          aria-label="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Hook para manejar el estado de toasts
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info', options = {}) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, ...options }]);
    return id;
  };

  const hideToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const ToastContainer = () => (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          action={toast.action}
          actionLabel={toast.actionLabel}
          onClose={() => hideToast(toast.id)}
        />
      ))}
    </>
  );

  return { showToast, hideToast, ToastContainer };
}

export default Toast;
