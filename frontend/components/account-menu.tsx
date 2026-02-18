"use client";

import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useTheme } from "next-themes";
import { ChevronDown, LogOut, Palette, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { useState, useEffect } from "react";

function initials(email: string, name?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0];
  return local.slice(0, 2).toUpperCase();
}

export function AccountMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const div = document.createElement("div");
    div.id = "account-menu-portal";
    div.className = "fixed inset-0 z-[9999]";
    div.style.pointerEvents = "none";
    document.body.appendChild(div);
    setPortalContainer(div);
    return () => {
      document.body.removeChild(div);
    };
  }, []);

  useEffect(() => {
    if (portalContainer) {
      portalContainer.style.pointerEvents = open ? "auto" : "none";
    }
  }, [open, portalContainer]);

  if (!user) return null;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <span
              className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-medium"
              aria-hidden
            >
              {initials(user.email, user.name)}
            </span>
            <span className="max-w-[120px] truncate text-muted-foreground text-sm">
              {user.name || user.email}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal container={portalContainer ?? undefined}>
          <DropdownMenu.Content align="end" className="z-[100] min-w-[200px] pointer-events-auto">
            <div className="px-2 py-1.5 text-sm text-muted-foreground border-b border-border">
              Signed in as <span className="font-medium text-foreground truncate block">{user.email}</span>
            </div>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                setPasswordOpen(true);
              }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <KeyRound className="size-4" />
              Password
            </DropdownMenu.Item>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Palette className="size-3.5" />
              Appearance
            </div>
            <DropdownMenu.Item
              onSelect={() => setTheme("light")}
              className={cn("cursor-pointer", theme === "light" && "bg-accent")}
            >
              Light
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => setTheme("dark")}
              className={cn("cursor-pointer", theme === "dark" && "bg-accent")}
            >
              Dark
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => setTheme("system")}
              className={cn("cursor-pointer", theme === "system" && "bg-accent")}
            >
              System
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={handleLogout}
              className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ChangePasswordModal open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}
