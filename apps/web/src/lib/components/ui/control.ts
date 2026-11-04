/** Shared look for text inputs and textareas. */
export const controlClass =
  'w-full rounded-(--radius-control) border border-line-strong bg-surface px-3 py-2.5 text-[0.9375rem] text-foreground placeholder:text-muted/80 transition-colors hover:border-foreground/50 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-sunken aria-[invalid=true]:border-danger';

/** aria-describedby for a Field: points at the error when there is one, otherwise the hint. */
export function describedBy(id: string, hasError: boolean, hasHint: boolean): string | undefined {
  if (hasError) return `${id}-error`;
  return hasHint ? `${id}-hint` : undefined;
}

export interface SegmentOption<V> {
  readonly value: V;
  readonly label: string;
}
