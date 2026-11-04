import { DurableObject } from 'cloudflare:workers';
import { timingSafeEqual } from '../../shared/ids';

/** Everything the server knows about a note. The blob is opaque ciphertext. */
interface StoredNote {
  readonly blob: string;
  readonly burnAfterRead: boolean;
  readonly expiresAt: number;
  readonly deleteTokenHash: string;
}

export type NoteCreateInput = StoredNote;

export interface NoteStatus {
  readonly burnAfterRead: boolean;
  readonly expiresAt: number;
}

export interface OpenedNote extends NoteStatus {
  readonly blob: string;
}

const STORAGE_KEY = 'note';

/**
 * One object per note id. Reads and consuming deletes use the synchronous KV API, so "check, then
 * consume" happens in one uninterrupted JavaScript turn: two concurrent opens of a burn-after-read
 * note can't both succeed (the async API leaves a gap between `get` and `delete`; a concurrency
 * test caught it). Every terminal path then calls `deleteAll()`, which on SQLite-backed objects
 * drops the whole database and, with our compatibility date, the pending alarm (ADR 0011).
 */
export class NoteItemDurableObject extends DurableObject {
  /** Stores the note unless the id is already taken. Returns false on collision. */
  async create(input: NoteCreateInput): Promise<boolean> {
    if (this.ctx.storage.kv.get<StoredNote>(STORAGE_KEY) !== undefined) return false;
    this.ctx.storage.kv.put(STORAGE_KEY, input);
    await this.ctx.storage.setAlarm(input.expiresAt);
    return true;
  }

  /** Non-consuming metadata for the recipient interstitial. */
  async status(now: number): Promise<NoteStatus | null> {
    const { note } = await this.settle(this.take(now, () => false));
    return note === null ? null : { burnAfterRead: note.burnAfterRead, expiresAt: note.expiresAt };
  }

  /** Returns the blob; burn-after-read notes are consumed in the same synchronous step. */
  async open(now: number): Promise<OpenedNote | null> {
    const { note } = await this.settle(this.take(now, (stored) => stored.burnAfterRead));
    return note === null
      ? null
      : { blob: note.blob, burnAfterRead: note.burnAfterRead, expiresAt: note.expiresAt };
  }

  /** Deletes the note if `deleteTokenHash` matches. Constant-time comparison. */
  async remove(deleteTokenHash: string, now: number): Promise<boolean> {
    const { consumed } = await this.settle(
      this.take(now, (stored) => timingSafeEqual(stored.deleteTokenHash, deleteTokenHash)),
    );
    return consumed;
  }

  /** Abuse revoke; the admin token is checked by the route before this is called. */
  async revoke(now: number): Promise<boolean> {
    const { consumed } = await this.settle(this.take(now, () => true));
    return consumed;
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  /**
   * Synchronously reads the note and deletes its key when it has expired or `consume` returns true.
   * Must stay free of `await`: this is what makes burn-after-read atomic.
   */
  private take(now: number, consume: (note: StoredNote) => boolean): Taken {
    const note = this.ctx.storage.kv.get<StoredNote>(STORAGE_KEY);
    if (note === undefined) return { note: null, consumed: false, removed: false };
    if (now >= note.expiresAt) {
      this.ctx.storage.kv.delete(STORAGE_KEY);
      return { note: null, consumed: false, removed: true };
    }
    if (!consume(note)) return { note, consumed: false, removed: false };
    this.ctx.storage.kv.delete(STORAGE_KEY);
    return { note, consumed: true, removed: true };
  }

  /** After a key was removed, frees the whole database and the alarm. Unknown ids cost no writes. */
  private async settle(taken: Taken): Promise<Taken> {
    if (taken.removed) await this.ctx.storage.deleteAll();
    return taken;
  }
}

interface Taken {
  /** The live note (also when it was just consumed), or null if none/expired. */
  readonly note: StoredNote | null;
  /** True if `consume` accepted the note and it was deleted. */
  readonly consumed: boolean;
  /** True if the key was deleted for any reason (consumed or expired). */
  readonly removed: boolean;
}
