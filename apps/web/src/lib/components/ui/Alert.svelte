<script lang="ts">
  import type { Snippet } from 'svelte';

  type Tone = 'info' | 'success' | 'warning' | 'danger';
  interface Props {
    tone?: Tone;
    title: string;
    /** Errors interrupt (role=alert); everything else is announced politely. */
    live?: boolean;
    children?: Snippet;
  }

  let { tone = 'info', title, live = false, children }: Props = $props();

  const tones: Record<Tone, string> = {
    info: 'border-line bg-sunken',
    success: 'border-success/30 bg-success-soft',
    warning: 'border-warning/30 bg-warning-soft',
    danger: 'border-danger/30 bg-danger-soft',
  };
  const titleTones: Record<Tone, string> = {
    info: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };
</script>

<div
  class="rounded-(--radius-control) border px-4 py-3 {tones[tone]}"
  role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}
>
  <p class="font-medium {titleTones[tone]}">{title}</p>
  {#if children}<div class="mt-1 text-sm text-foreground/85">{@render children()}</div>{/if}
</div>
