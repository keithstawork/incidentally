import * as fs from "fs";
import * as path from "path";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface FileStorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const DEFAULT_S3_PREFIX = "incidentally";
const PRESIGN_EXPIRES_IN_SECONDS = 3600; // 1 hour

/**
 * Build storage key for a document: {prefix}/claims/{claimId}/{documentId}-{sanitizedFilename}
 * Caller uses this before upload and stores the returned key in documents.storage_path.
 */
function sanitizeFilenameForKey(filename: string): string {
  const base = path.basename(filename);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "file";
}

/**
 * Build storage key for a document: {prefix}/claims/{claimId}/{documentId}-{sanitizedFilename}
 * Caller uses this before upload and stores the returned key in documents.storage_path.
 */
export function buildDocumentStorageKey(
  claimId: number,
  documentId: number,
  filename: string,
): string {
  const prefix = process.env.AWS_S3_PREFIX ?? DEFAULT_S3_PREFIX;
  const sanitized = sanitizeFilenameForKey(filename);
  return `${prefix}/claims/${claimId}/${documentId}-${sanitized}`;
}

class LocalFileStorageProvider implements FileStorageProvider {
  constructor() {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const filePath = path.join(UPLOAD_DIR, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
    return key;
  }

  async getUrl(key: string): Promise<string> {
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

class S3FileStorageProvider implements FileStorageProvider {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new Error("AWS_S3_BUCKET is required when FILE_STORAGE=s3");
    }
    this.bucket = bucket;
    const region = process.env.AWS_REGION ?? "us-west-2";
    this.client = new S3Client({ region });
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType || "application/octet-stream",
      }),
    );
    return key;
  }

  async getUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_EXPIRES_IN_SECONDS,
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}

export const fileStorage: FileStorageProvider =
  process.env.FILE_STORAGE === "s3"
    ? new S3FileStorageProvider()
    : new LocalFileStorageProvider();
