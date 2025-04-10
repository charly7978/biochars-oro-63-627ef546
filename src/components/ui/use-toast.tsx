
import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
};

export function toast({ 
  title, 
  description, 
  variant = "default", 
  duration = 3000 
}: ToastProps) {
  const style = {
    background: variant === "destructive" ? "rgba(220, 38, 38, 0.9)" : 
                 variant === "success" ? "rgba(34, 197, 94, 0.9)" : 
                 "rgba(31, 41, 55, 0.9)",
    color: "white",
    border: "none",
    borderRadius: "0.375rem"
  };

  sonnerToast(title, {
    description,
    duration,
    style
  });
}
