<script lang="ts">
  import type { Snippet } from 'svelte';

  type Tone = 'neutral' | 'warning' | 'success';
  interface Props {
    tone?: Tone;
    children: Snippet;
  }
  let { tone = 'neutral', children }: Props = $props();

  const tones: Record<Tone, string> = {
    neutral: 'border-line bg-sunken text-muted',
    warning: 'border-warning/30 bg-warning-soft text-warning',
    success: 'border-success/30 bg-success-soft text-success',
  };
</script>

<span
  class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium {tones[tone]}"
>
  {@render children()}
</span>
