import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <nav className="flex items-center gap-3 flex-wrap">
          <Link href="/" className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline">
            Now
          </Link>
          <Link href="/inbox" className="text-zinc-600 dark:text-zinc-400 hover:underline">
            Inbox
          </Link>
          <Link href="/projects" className="text-zinc-600 dark:text-zinc-400 hover:underline">
            Projects
          </Link>
          <Link href="/deadlines" className="text-zinc-600 dark:text-zinc-400 hover:underline">
            Deadlines
          </Link>
          <Link href="/waiting" className="text-zinc-600 dark:text-zinc-400 hover:underline">
            Waiting
          </Link>
          <Link href="/review" className="text-zinc-600 dark:text-zinc-400 hover:underline">
            Review
          </Link>
          <span className="text-zinc-400 dark:text-zinc-500 text-sm">|</span>
          <Link href="/someday" className="text-zinc-500 dark:text-zinc-500 hover:underline text-sm">
            Someday
          </Link>
          <Link href="/reference" className="text-zinc-500 dark:text-zinc-500 hover:underline text-sm">
            Reference
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/capture"
            className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            + Capture
          </Link>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
      <Toaster />
    </div>
  );
}
