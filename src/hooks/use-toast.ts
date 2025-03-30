
import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast";
import { useToast as useToastOriginal } from "@/components/ui/use-toast";

export { type Toast, type ToastActionElement, type ToastProps } from "@/components/ui/toast";

export const useToast = useToastOriginal;

export const toast = useToastOriginal().toast;
