import toast from 'react-hot-toast';

export class ToastService {
  static success(message: string, duration = 4000) {
    return toast.success(message, {
      duration,
      position: 'top-right',
      style: {
        background: '#10b981',
        color: '#ffffff',
      },
    });
  }

  static error(message: string, duration = 6000) {
    return toast.error(message, {
      duration,
      position: 'top-right',
      style: {
        background: '#ef4444',
        color: '#ffffff',
      },
    });
  }

  static warning(message: string, duration = 5000) {
    return toast(message, {
      duration,
      position: 'top-right',
      icon: '⚠️',
      style: {
        background: '#f59e0b',
        color: '#ffffff',
      },
    });
  }

  static info(message: string, duration = 4000) {
    return toast(message, {
      duration,
      position: 'top-right',
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: '#ffffff',
      },
    });
  }

  static loading(message: string) {
    return toast.loading(message, {
      position: 'top-right',
    });
  }

  static promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) {
    return toast.promise(promise, messages, {
      position: 'top-right',
      success: {
        duration: 4000,
        style: {
          background: '#10b981',
          color: '#ffffff',
        },
      },
      error: {
        duration: 6000,
        style: {
          background: '#ef4444',
          color: '#ffffff',
        },
      },
    });
  }

  static dismiss(toastId?: string) {
    return toast.dismiss(toastId);
  }

  static dismissAll() {
    return toast.dismiss();
  }
}
