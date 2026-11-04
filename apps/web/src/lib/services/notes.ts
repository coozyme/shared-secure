import {
  decryptNote,
  encryptNote,
  generateSecret,
  noteBlobSize,
  parseSecret,
  type NotePayload,
} from '@shared/crypto';
import {
  noteCreateResponseSchema,
  noteOpenResponseSchema,
  noteStatusResponseSchema,
  tokenSchema,
  type NoteStatusResponse,
} from '@shared/schema';
import { apiRequest } from './api';

export interface NoteDraft {
  readonly title: string;
  readonly body: string;
  readonly format: NotePayload['format'];
}

export interface NoteSettings {
  readonly ttlSeconds: number;
  readonly burnAfterRead: boolean;
}

export interface CreatedNote {
  /** Contains the key in the fragment. Show it once; never send it anywhere. */
  readonly shareUrl: string;
  /** Contains the delete token in the fragment. */
  readonly deleteUrl: string;
  readonly expiresAt: number;
  readonly burnAfterRead: boolean;
}

export interface OpenedNote {
  readonly note: NotePayload;
  readonly burnAfterRead: boolean;
  readonly expiresAt: number;
}

export function toPayload(draft: NoteDraft): NotePayload {
  const title = draft.title.trim();
  return { body: draft.body, format: draft.format, ...(title === '' ? {} : { title }) };
}

/** Encrypted size of the draft, to check against the server's `maxBlobBytes` before sending. */
export function draftBlobBytes(draft: NoteDraft): number {
  return noteBlobSize(toPayload(draft));
}

/** Encrypts locally, then uploads only ciphertext. The key never leaves this function except in the returned link. */
export async function createNote(
  draft: NoteDraft,
  settings: NoteSettings,
  turnstileToken: string,
  origin: string = window.location.origin,
): Promise<CreatedNote> {
  const secret = generateSecret();
  const blob = await encryptNote(toPayload(draft), secret);
  const created = await apiRequest('/notes', {
    method: 'POST',
    body: { blob, ...settings, turnstileToken },
    schema: noteCreateResponseSchema,
  });
  return {
    shareUrl: `${origin}/n/${created.id}#${secret}`,
    deleteUrl: `${origin}/n/${created.id}/delete#${created.deleteToken}`,
    expiresAt: created.expiresAt,
    burnAfterRead: settings.burnAfterRead,
  };
}

/** True if the fragment holds a well-formed 256-bit key. Checked before anything is consumed. */
export function isValidKey(secret: string): boolean {
  return parseSecret(secret) !== null;
}

export function isValidDeleteToken(token: string): boolean {
  return tokenSchema.safeParse(token).success;
}

/** Non-consuming: safe to call on page load. */
export function getNoteStatus(id: string): Promise<NoteStatusResponse> {
  return apiRequest(`/notes/${id}/status`, { schema: noteStatusResponseSchema });
}

/**
 * Fetches and decrypts. For burn-after-read notes the server deletes the note in the same step, so
 * this must only run after an explicit user action.
 */
export async function openNote(id: string, secret: string): Promise<OpenedNote> {
  const opened = await apiRequest(`/notes/${id}/open`, {
    method: 'POST',
    schema: noteOpenResponseSchema,
  });
  const note = await decryptNote(opened.blob, secret);
  return { note, burnAfterRead: opened.burnAfterRead, expiresAt: opened.expiresAt };
}

export function deleteNote(id: string, deleteToken: string): Promise<void> {
  return apiRequest(`/notes/${id}`, { method: 'DELETE', body: { deleteToken } });
}
