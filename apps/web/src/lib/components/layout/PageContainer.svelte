<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** narrow: reading and single-task pages; wide: creation pages with a side panel. */
    width?: 'narrow' | 'default' | 'wide';
    children: Snippet;
  }
  let { width = 'default', children }: Props = $props();

  const widths = { narrow: 'max-w-2xl', default: 'max-w-4xl', wide: 'max-w-6xl' } as const;
</script>

<div class="mx-auto w-full {widths[width]} px-4 sm:px-6 lg:px-8">{@render children()}</div>
