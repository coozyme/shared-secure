export interface ToastMessage {
  readonly id: number;
  readonly text: string;
}

const DISPLAY_MS = 3500;
let nextId = 0;

/** One short, polite confirmation at a time ("Link copied"). Rendered by Toaster in the layout. */
export const toasts = $state<{ current: ToastMessage | null }>({ current: null });

export function showToast(text: string): void {
  const id = ++nextId;
  toasts.current = { id, text };
  setTimeout(() => {
    if (toasts.current?.id === id) toasts.current = null;
  }, DISPLAY_MS);
}
