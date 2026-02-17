"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const loadingShell = (
  <div className="w-full max-w-sm text-center text-muted-foreground">
    Loading…
  </div>
);

function LoginForm() {
  const { user, loading, error, login, clearError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return loadingShell;
  }

  if (user && !loading) {
    router.replace(returnUrl);
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Signed in");
      router.replace(returnUrl);
    } catch {
      // error set in context
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return loadingShell;
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold text-foreground text-center">
        Sign in
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary text-primary-foreground py-2 px-4 font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-primary hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={loadingShell}>
      <LoginForm />
    </Suspense>
  );
}
