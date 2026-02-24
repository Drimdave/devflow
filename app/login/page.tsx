"use client";

import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, Workflow } from "lucide-react";
import { showToast } from "@/components/ui/Toast";

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isLogin) {
                const res = await signIn.email({
                    email,
                    password,
                }, {
                    onSuccess: () => {
                        showToast("Signed in successfully", "success");
                        router.push("/");
                    },
                    onError: (ctx) => {
                        showToast(ctx.error.message || "Invalid credentials", "error");
                    }
                });
            } else {
                const res = await signUp.email({
                    email,
                    password,
                    name,
                }, {
                    onSuccess: () => {
                        showToast("Account created successfully", "success");
                        router.push("/");
                    },
                    onError: (ctx) => {
                        showToast(ctx.error.message || "Failed to create account", "error");
                    }
                });
            }
        } catch (err) {
            showToast("Something went wrong", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
                <div className="flex flex-col items-center mb-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                        <Workflow className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-xl font-bold text-foreground">
                        {isLogin ? "Welcome back" : "Create an account"}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 text-center">
                        {isLogin ? "Sign in to access your workflows" : "Sign up to start building workflows"}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none transition-colors"
                                placeholder="Jane Doe"
                                disabled={isLoading}
                            />
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none transition-colors"
                            placeholder="jane@example.com"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none transition-colors"
                            placeholder="••••••••"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isLogin ? "Sign In" : "Sign Up"}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="font-medium text-primary hover:underline"
                        disabled={isLoading}
                    >
                        {isLogin ? "Sign up" : "Sign in"}
                    </button>
                </div>
            </div>
        </div>
    );
}
