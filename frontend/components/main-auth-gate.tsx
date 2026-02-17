"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export function MainAuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const returnUrl = pathname && pathname !== "/" ? `?returnUrl=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${returnUrl}`);
      return;
    }
    if (pathname === "/login" || pathname === "/register") {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) {
    return null;
  }
  return <>{children}</>;
}
