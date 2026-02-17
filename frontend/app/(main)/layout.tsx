import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { MainAuthGate } from "@/components/main-auth-gate";
import { AccountMenu } from "@/components/account-menu";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainAuthGate>
    <div className="min-h-screen flex flex-col">
      <header className="relative z-40 border-b border-border px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <nav className="min-w-0 flex items-center gap-3 flex-wrap">
          <Link href="/" className="font-medium text-foreground hover:underline">
            Now
          </Link>
          <Link href="/inbox" className="text-muted-foreground hover:underline">
            Inbox
          </Link>
          <Link href="/projects" className="text-muted-foreground hover:underline">
            Projects
          </Link>
          <Link href="/deadlines" className="text-muted-foreground hover:underline">
            Deadlines
          </Link>
          <Link href="/waiting" className="text-muted-foreground hover:underline">
            Waiting
          </Link>
          <Link href="/review" className="text-muted-foreground hover:underline">
            Review
          </Link>
          <span className="text-muted-foreground text-sm">|</span>
          <Link href="/someday" className="text-muted-foreground hover:underline text-sm">
            Someday
          </Link>
          <Link href="/reference" className="text-muted-foreground hover:underline text-sm">
            Reference
          </Link>
        </nav>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Link
            href="/capture"
            className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            + Capture
          </Link>
          <AccountMenu />
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
    </MainAuthGate>
  );
}
