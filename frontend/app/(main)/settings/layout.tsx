import Link from "next/link";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Settings</h1>
      <nav className="flex gap-4 mb-6 border-b border-border pb-2">
        <Link href="/settings/areas" className="text-muted-foreground hover:text-foreground hover:underline">
          Areas of Focus
        </Link>
        <Link href="/settings/inbox-email" className="text-muted-foreground hover:text-foreground hover:underline">
          Inbox Email
        </Link>
      </nav>
      {children}
    </div>
  );
}
