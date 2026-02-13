import path from "path";
import fs from "fs/promises";
import { getStorageConfig } from "../lib/intake-config";

export type UploadInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

export type UploadResult = {
  storageKey: string;
  url: string;
  filename: string;
  mimeType: string;
};

function generateStorageKey(filename: string): string {
  const ext = path.extname(filename) || "";
  const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${base}-${unique}${ext}`;
}

export async function upload(file: UploadInput): Promise<UploadResult> {
  const config = getStorageConfig();
  if (config.provider === "s3" && config.s3) {
    return s3Upload(file, config.s3);
  }
  return localUpload(file, path.resolve(process.cwd(), config.localUploadDir));
}

async function localUpload(input: UploadInput, uploadDir: string): Promise<UploadResult> {
  await fs.mkdir(uploadDir, { recursive: true });
  const storageKey = generateStorageKey(input.filename);
  const filePath = path.join(uploadDir, storageKey);
  await fs.writeFile(filePath, input.buffer);
  const url = `/uploads/${encodeURIComponent(storageKey)}`;
  return {
    storageKey,
    url,
    filename: input.filename,
    mimeType: input.mimeType,
  };
}

async function s3Upload(
  input: UploadInput,
  s3: { bucket: string; region: string; accessKeyId: string; secretAccessKey: string }
): Promise<UploadResult> {
  try {
    // Optional dependency: install @aws-sdk/client-s3 when using S3
    // @ts-expect-error - optional dependency, not installed by default
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: s3.region,
      credentials: s3.accessKeyId
        ? { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey }
        : undefined,
    });
    const storageKey = generateStorageKey(input.filename);
    await client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentType: input.mimeType,
      })
    );
    const url = `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${encodeURIComponent(storageKey)}`;
    return { storageKey, url, filename: input.filename, mimeType: input.mimeType };
  } catch (e) {
    throw new Error("S3 upload failed: install @aws-sdk/client-s3 and set AWS_* env vars. " + String(e));
  }
}

export function getUrl(storageKey: string): string {
  const config = getStorageConfig();
  if (config.provider === "s3" && config.s3) {
    return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${encodeURIComponent(storageKey)}`;
  }
  return `/uploads/${encodeURIComponent(storageKey)}`;
}
