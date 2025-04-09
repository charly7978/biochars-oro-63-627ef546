
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

// Empty state and functions that do nothing
type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

// Empty toast function that does nothing
function toast() {
  return {
    id: "",
    dismiss: () => {},
    update: () => {},
  }
}

// Empty useToast hook that does nothing
function useToast() {
  return {
    toasts: [],
    toast,
    dismiss: () => {},
  }
}

export { useToast, toast }
