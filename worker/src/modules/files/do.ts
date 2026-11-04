import { DurableObject } from 'cloudflare:workers';
import { timingSafeEqual } from '../../shared/ids';

interface StoredFile {
  readonly objectPrefix: string;
  readonly headerCiphertext: string;
  readonly headerIv: string;
  readonly noncePrefix: string;
  readonly expiresAt: number;
  readonly deleteTokenHash: string;
  readonly maxDownloads: number;
  readonly downloadCount: number;
  readonly totalChunks: number;
  readonly totalCipherBytes: number;
  readonly chunkSizeBytes: number;
  readonly lastChunkPlainBytes: number;
  readonly uploadedChunks: readonly number[];
  readonly status: 'pending' | 'ready';
  readonly activeDownloadTokenHash?: string;
  readonly activeDownloadTokenExpiresAt?: number;
}

type CreatePayload = Omit<StoredFile, 'downloadCount' | 'uploadedChunks' | 'status'>;
interface UploadChunkPayload {
  readonly chunkIndex: number;
}
interface DeletePayload {
  readonly deleteTokenHash: string;
}
interface StartReadPayload {
  readonly downloadTokenHash: string;
  readonly now: number;
}
interface AuthorizeChunkPayload {
  readonly downloadTokenHash: string;
  readonly now: number;
}

const STORAGE_KEY = 'file';
const DOWNLOAD_TOKEN_TTL_MS = 2 * 60 * 1000;

export class FileItemDurableObject extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    switch (`${request.method} ${url.pathname}`) {
      case 'POST /create':
        return this.create(request);
      case 'POST /upload-chunk':
        return this.uploadChunk(request);
      case 'POST /complete':
        return this.complete();
      case 'POST /start-read':
        return this.startRead(request);
      case 'POST /authorize-chunk':
        return this.authorizeChunk(request);
      case 'POST /delete':
        return this.delete(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  override async alarm(): Promise<void> {
    const stored = await this.ctx.storage.get<StoredFile>(STORAGE_KEY);
    if (stored !== undefined) {
      const keys = Array.from(
        { length: stored.totalChunks },
        (_v, index) => `${stored.objectPrefix}${String(index).padStart(8, '0')}`,
      );
      const bucket = (this.env as { readonly FILES_BUCKET: R2Bucket }).FILES_BUCKET;
      await bucket.delete(keys);
    }
    await this.ctx.storage.delete(STORAGE_KEY);
  }

  private async create(request: Request): Promise<Response> {
    const existing = await this.ctx.storage.get<StoredFile>(STORAGE_KEY);
    if (existing !== undefined) return Response.json({ created: false }, { status: 200 });
    const payload = await request.json<CreatePayload>();
    await this.ctx.storage.put(STORAGE_KEY, {
      ...payload,
      status: 'pending',
      downloadCount: 0,
      uploadedChunks: [],
    } satisfies StoredFile);
    await this.ctx.storage.setAlarm(payload.expiresAt);
    return Response.json({ created: true }, { status: 200 });
  }

  private async uploadChunk(request: Request): Promise<Response> {
    const stored = await this.ctx.storage.get<StoredFile>(STORAGE_KEY);
    if (stored === undefined || Date.now() >= stored.expiresAt || stored.status !== 'pending') {
      await this.ctx.storage.delete(STORAGE_KEY);
      return Response.json({ accepted: false }, { status: 200 });
    }
    const payload = await request.json<UploadChunkPayload>();
    if (
      !Number.isInteger(payload.chunkIndex) ||
      payload.chunkIndex < 0 ||
      payload.chunkIndex >= stored.totalChunks
    ) {
      return Response.json({ accepted: false }, { status: 200 });
    }
    if (stored.uploadedChunks.includes(payload.chunkIndex)) {
      return Response.json({ accepted: true }, { status: 200 });
    }
    const next = [...stored.uploadedChunks, payload.chunkIndex].sort((a, b) => a - b);
    await this.ctx.storage.put(STORAGE_KEY, {
      ...stored,
      uploadedChunks: next,
    } satisfies StoredFile);
    return Response.json({ accepted: true }, { status: 200 });
  }

  private async complete(): Promise<Response> {
    const stored = await this.ctx.storage.get<StoredFile>(STORAGE_KEY);
    if (stored?.status !== 'pending') return Response.json({ completed: false }, { status: 200 });
    if (stored.uploadedChunks.length !== stored.totalChunks)
      return Response.json({ completed: false }, { status: 200 });
    await this.ctx.storage.put(STORAGE_KEY, { ...stored, status: 'ready' } satisfies StoredFile);
    return Response.json({ completed: true }, { status: 200 });
  }

  private async startRead(request: Request): Promise<Response> {
    const stored = await this.ctx.storage.get<StoredFile>(STORAGE_KEY);
    const expired = Date.now() >= (stored?.expiresAt ?? 0);
    if (stored?.status !== 'ready' || expired) {
      if (expired && stored !== undefined) await this.ctx.storage.delete(STORAGE_KEY);
      return Response.json({ found: false }, { status: 200 });
    }
    if (stored.downloadCount >= stored.maxDownloads)
      return Response.json({ found: false }, { status: 200 });

    const payload = await request.json<StartReadPayload>();
    const next = {
      ...stored,
      downloadCount: stored.downloadCount + 1,
      activeDownloadTokenHash: payload.downloadTokenHash,
      activeDownloadTokenExpiresAt: payload.now + DOWNLOAD_TOKEN_TTL_MS,
    } satisfies StoredFile;
    await this.ctx.storage.put(STORAGE_KEY, next);
    return Response.json(
      {
        found: true,
        headerCiphertext: stored.headerCiphertext,
        headerIv: stored.headerIv,
        noncePrefix: stored.noncePrefix,
        totalChunks: stored.totalChunks,
        chunkSizeBytes: stored.chunkSizeBytes,
        lastChunkPlainBytes: stored.lastChunkPlainBytes,
      },
      { status: 200 },
    );
  }

  private async authorizeChunk(request: Request): Promise<Response> {
    const stored = await this.ctx.storage.get<StoredFile>(STORAGE_KEY);
    const expired = Date.now() >= (stored?.expiresAt ?? 0);
    if (stored?.status !== 'ready' || expired) {
      if (expired && stored !== undefined) await this.ctx.storage.delete(STORAGE_KEY);
      return Response.json({ authorized: false }, { status: 200 });
    }
    const payload = await request.json<AuthorizeChunkPayload>();
    if (
      payload.now >= (stored.activeDownloadTokenExpiresAt ?? 0) ||
      !timingSafeEqual(stored.activeDownloadTokenHash ?? '', payload.downloadTokenHash)
    ) {
      return Response.json({ authorized: false }, { status: 200 });
    }
    return Response.json({ authorized: true }, { status: 200 });
  }

  private async delete(request: Request): Promise<Response> {
    const stored = await this.ctx.storage.get<StoredFile>(STORAGE_KEY);
    if (stored === undefined) return Response.json({ deleted: false }, { status: 200 });
    const payload = await request.json<DeletePayload>();
    if (!timingSafeEqual(stored.deleteTokenHash, payload.deleteTokenHash)) {
      return Response.json({ deleted: false }, { status: 200 });
    }
    await this.ctx.storage.delete(STORAGE_KEY);
    return Response.json({ deleted: true, totalChunks: stored.totalChunks }, { status: 200 });
  }
}
