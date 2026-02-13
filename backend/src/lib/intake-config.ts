/**
 * Env-only integration config. Future connectors read from here; no hardcoded credentials.
 */

export type StorageConfig = {
  provider: "local" | "s3";
  localUploadDir: string;
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
};

export function getStorageConfig(): StorageConfig {
  const provider = (process.env.STORAGE_PROVIDER || "local") as "local" | "s3";
  const localUploadDir = process.env.LOCAL_UPLOAD_DIR || "./uploads";
  const config: StorageConfig = { provider, localUploadDir };
  if (provider === "s3") {
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || "us-east-1";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "";
    if (bucket) {
      config.s3 = { bucket, region, accessKeyId, secretAccessKey };
    }
  }
  return config;
}

export type EmailIntegrationConfig = {
  provider: "microsoft" | "google";
  microsoft?: { tenantId: string; clientId: string; clientSecret: string };
  google?: { clientId: string; clientSecret: string };
} | null;

export function getEmailIntegrationConfig(): EmailIntegrationConfig {
  const integration = process.env.EMAIL_INTEGRATION || "none";
  if (integration === "microsoft") {
    const tenantId = process.env.MICROSOFT_GRAPH_TENANT_ID || "";
    const clientId = process.env.MICROSOFT_GRAPH_CLIENT_ID || "";
    const clientSecret = process.env.MICROSOFT_GRAPH_CLIENT_SECRET || "";
    if (tenantId && clientId && clientSecret) {
      return { provider: "microsoft", microsoft: { tenantId, clientId, clientSecret } };
    }
  }
  if (integration === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    if (clientId && clientSecret) {
      return { provider: "google", google: { clientId, clientSecret } };
    }
  }
  return null;
}

export type CalendarIntegrationConfig = {
  microsoft: boolean;
  google: boolean;
  microsoftCredentials?: { tenantId: string; clientId: string; clientSecret: string };
  googleCredentials?: { clientId: string; clientSecret: string };
};

export function getCalendarIntegrationConfig(): CalendarIntegrationConfig {
  const microsoftEnabled = process.env.CALENDAR_MICROSOFT_ENABLED === "true";
  const googleEnabled = process.env.CALENDAR_GOOGLE_ENABLED === "true";
  const out: CalendarIntegrationConfig = { microsoft: false, google: false };
  if (microsoftEnabled) {
    const tenantId = process.env.MICROSOFT_GRAPH_TENANT_ID || "";
    const clientId = process.env.MICROSOFT_GRAPH_CLIENT_ID || "";
    const clientSecret = process.env.MICROSOFT_GRAPH_CLIENT_SECRET || "";
    if (tenantId && clientId && clientSecret) {
      out.microsoft = true;
      out.microsoftCredentials = { tenantId, clientId, clientSecret };
    }
  }
  if (googleEnabled) {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
    if (clientId && clientSecret) {
      out.google = true;
      out.googleCredentials = { clientId, clientSecret };
    }
  }
  return out;
}
