// src/components/ui/use-toast.ts (Placeholder with stable reference)
import { useCallback, useMemo } from 'react'; // useCallback might not be needed if toastFunction is defined outside

export interface ToastProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: 'default' | 'destructive';
  duration?: number;
  action?: React.ReactNode;
}

interface ToastFn {
  (props: ToastProps): void;
}

// Define the toast function outside the hook so its reference is stable
const toastFunction: ToastFn = (props) => {
  console.log("Toast (Placeholder):", {
    title: props.title,
    description: props.description,
    variant: props.variant,
    duration: props.duration,
  });
  // In a real implementation, this would dispatch to a toast manager/context
};

// Memoize the object containing the toast function
const toastApi = { toast: toastFunction };

export const useToast = (): { toast: ToastFn } => {
  return toastApi; // Returns the same object reference every time
};