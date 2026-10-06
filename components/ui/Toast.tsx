"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export type ToastType = "success" | "error";

interface ToastData {
    id: number;
    message: string;
    type: ToastType;
}

let toastId = 0;
let addToastFn: ((toast: Omit<ToastData, "id">) => void) | null = null;

// Global function to trigger toasts from anywhere
export function showToast(message: string, type: ToastType = "success") {
    addToastFn?.({ message, type });
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // Animate in
        requestAnimationFrame(() => setIsVisible(true));

        // Auto dismiss after 3s
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(onDismiss, 300);
        }, 3000);

        return () => clearTimeout(timer);
    }, [onDismiss]);

    const isSuccess = toast.type === "success";

    return (
        <div
            className={`
                flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-full shadow-2xl
                min-w-[240px] max-w-[420px] bg-foreground text-background
                transition-all duration-300 ease-out
                ${isVisible && !isExiting
                    ? "translate-y-0 opacity-100 scale-100"
                    : "translate-y-3 opacity-0 scale-95"
                }
            `}
        >
            {isSuccess ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-volt dark:text-emerald-600" />
            ) : (
                <XCircle className="h-5 w-5 shrink-0 text-red-400 dark:text-red-600" />
            )}
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
                onClick={() => {
                    setIsExiting(true);
                    setTimeout(onDismiss, 300);
                }}
                className="opacity-50 hover:opacity-100 transition-opacity shrink-0"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

export function ToastProvider() {
    const [toasts, setToasts] = useState<ToastData[]>([]);

    useEffect(() => {
        addToastFn = (toast) => {
            setToasts((prev) => [...prev, { ...toast, id: ++toastId }]);
        };
        return () => { addToastFn = null; };
    }, []);

    const dismiss = (id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2 items-center">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
            ))}
        </div>
    );
}
