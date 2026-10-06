"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkPassword } from "@/lib/password-policy";

const inputCls =
    "h-12 w-full rounded-2xl bg-muted pl-4 pr-12 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-foreground/20 disabled:opacity-60";

const SEGMENT = ["bg-destructive", "bg-orange-500", "bg-amber-400", "bg-lime-500", "bg-emerald-500"];

interface PasswordFieldProps {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    /** "new" shows the strength meter and uses new-password autofill. */
    mode: "current" | "new";
    who?: { email?: string; name?: string };
    disabled?: boolean;
    label: string;
}

/** Password input with a show/hide toggle and, for new passwords, a live strength meter that explains what's wrong. */
export default function PasswordField({ value, onChange, placeholder, mode, who, disabled, label }: PasswordFieldProps) {
    const [shown, setShown] = useState(false);
    const hintId = useId();
    const check = mode === "new" && value ? checkPassword(value, who) : null;

    return (
        <div>
            <div className="relative">
                <input
                    type={shown ? "text" : "password"}
                    required
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={inputCls}
                    placeholder={placeholder ?? "Password"}
                    aria-label={label}
                    aria-describedby={check ? hintId : undefined}
                    autoComplete={mode === "new" ? "new-password" : "current-password"}
                    disabled={disabled}
                    maxLength={128}
                />
                <button
                    type="button"
                    onClick={() => setShown((s) => !s)}
                    aria-label={shown ? "Hide password" : "Show password"}
                    aria-pressed={shown}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                >
                    {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>

            {mode === "new" && (
                <div id={hintId} aria-live="polite" className="mt-2 min-h-[34px]">
                    {check ? (
                        <>
                            <div className="flex gap-1" aria-hidden>
                                {[1, 2, 3, 4].map((i) => (
                                    <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", check.score >= i && check.ok ? SEGMENT[check.score] : check.ok ? "bg-muted" : i === 1 ? SEGMENT[0] : "bg-muted")} />
                                ))}
                            </div>
                            <p className={cn("mt-1.5 text-xs", check.ok ? "text-muted-foreground" : "text-destructive")}>
                                <span className="font-medium">{check.label}</span>
                                {check.ok ? (check.score < 3 ? ". Longer is stronger." : "") : `: ${check.messages[0]}`}
                            </p>
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground">Use 10 or more characters. A few unrelated words works well.</p>
                    )}
                </div>
            )}
        </div>
    );
}
