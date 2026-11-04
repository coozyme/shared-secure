import { DecryptionError } from '@shared/crypto';
import { ApiError } from '../services/api';

export interface ErrorMessage {
  readonly title: string;
  readonly detail: string;
}

/** Maps any failure to calm, specific copy. Never shows raw error text from the network. */
export function describeError(error: unknown): ErrorMessage {
  if (error instanceof DecryptionError) {
    return {
      title: 'This note can’t be decrypted',
      detail:
        'The key in the link doesn’t match the note, or the content was changed. Ask the sender for a fresh link.',
    };
  }
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'not_found':
        return {
          title: 'This note is no longer available',
          detail:
            'It may have expired, been opened already, or been deleted by the sender. Notes can’t be recovered.',
        };
      case 'rate_limited':
        return {
          title: 'Too many requests',
          detail: 'Wait a minute, then try again.',
        };
      case 'challenge_failed':
        return {
          title: 'Verification didn’t pass',
          detail: 'Complete the verification again, then retry.',
        };
      case 'payload_too_large':
        return {
          title: 'This note is too long',
          detail: 'Shorten it and try again.',
        };
      case 'feature_disabled':
        return {
          title: 'Temporarily unavailable',
          detail: 'This feature is switched off for now. Try again later.',
        };
      case 'network':
        return {
          title: 'You seem to be offline',
          detail: 'Check your connection and try again. Nothing was sent.',
        };
      default:
        return {
          title: 'Service temporarily unavailable',
          detail: 'Something went wrong on our side. Try again in a few minutes.',
        };
    }
  }
  return {
    title: 'Something went wrong',
    detail: 'Reload the page and try again.',
  };
}
