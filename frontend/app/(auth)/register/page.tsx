"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const loadingShell = (
  <div className="w-full max-w-sm text-center text-muted-foreground">
    Loading…
  </div>
);

function RegisterForm() {
  const { user, loading, error, register, clearError } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return loadingShell;
  }

  if (user && !loading) {
    router.replace("/");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    try {
      await register(email, password, name.trim() || undefined);
      toast.success("Account created");
      router.replace("/");
    } catch {
      // error set in context
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-sm text-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold text-foreground text-center">
        Create an account
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
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
            Name (optional)
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="At least 8 characters"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary text-primary-foreground py-2 px-4 font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Register"}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={loadingShell}>
      <RegisterForm />
    </Suspense>
  );
}
