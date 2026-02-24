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
                flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl
                min-w-[280px] max-w-[400px]
                transition-all duration-300 ease-out
                ${isSuccess
                    ? "bg-green-500/10 border-green-500/20 shadow-green-500/5"
                    : "bg-red-500/10 border-red-500/20 shadow-red-500/5"
                }
                ${isVisible && !isExiting
                    ? "translate-y-0 opacity-100 scale-100"
                    : "translate-y-3 opacity-0 scale-95"
                }
            `}
        >
            {isSuccess ? (
                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
            ) : (
                <XCircle className="h-5 w-5 text-red-400 shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground flex-1">{toast.message}</span>
            <button
                onClick={() => {
                    setIsExiting(true);
                    setTimeout(onDismiss, 300);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
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
        <div className="fixed top-20 right-6 z-[100] flex flex-col gap-2 items-end">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
            ))}
        </div>
    );
}
