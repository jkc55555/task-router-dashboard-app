"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function InboxEmailSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [parseDomainConfigured, setParseDomainConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings
      .getInboxEmail()
      .then((data) => {
        setEnabled(data.enabled);
        setAddress(data.address);
        setParseDomainConfigured(data.parseDomainConfigured);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    try {
      const data = await api.settings.patchInboxEmail({ enabled: next });
      setEnabled(data.enabled);
      setAddress(data.address);
      toast.success(next ? "Email-to-inbox enabled" : "Email-to-inbox disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    toast.success("Address copied to clipboard");
  };

  if (loading) {
    return <p className="text-zinc-500">Loading...</p>;
  }

  return (
    <div>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
        Forward or CC emails to your unique address to add them to your inbox automatically. Attachments are included.
      </p>

      {!parseDomainConfigured && (
        <p className="text-amber-600 dark:text-amber-400 text-sm mb-4">
          Email-to-inbox is not fully configured. Ask your administrator to set INBOUND_PARSE_DOMAIN and configure an
          inbound email provider (e.g. SendGrid Inbound Parse).
        </p>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={saving || !parseDomainConfigured}
            onClick={() => handleToggle(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              enabled ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-600"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                enabled ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm font-medium">
            {enabled ? "Email-to-inbox enabled" : "Email-to-inbox disabled"}
          </span>
        </div>

        {enabled && address && (
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Your inbox email address</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm break-all">{address}</code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-2 text-sm font-medium shrink-0"
              >
                Copy
              </button>
            </div>
            <p className="text-zinc-500 text-xs">
              Forward or CC any email to this address. The subject becomes the title, the body becomes the item body,
              and attachments are saved.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
