<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    label: string;
    hint?: string;
    error?: string | null;
    optional?: boolean;
    /** Right-aligned content on the label row, e.g. a character counter. */
    aside?: Snippet;
    children: Snippet;
  }

  let { id, label, hint, error = null, optional = false, aside, children }: Props = $props();
</script>

<div class="flex flex-col gap-1.5">
  <div class="flex items-baseline justify-between gap-3">
    <label for={id} class="text-sm font-medium text-foreground">
      {label}
      {#if optional}<span class="font-normal text-muted">(optional)</span>{/if}
    </label>
    {#if aside}{@render aside()}{/if}
  </div>
  {@render children()}
  {#if error}
    <p id="{id}-error" class="text-sm text-danger">{error}</p>
  {:else if hint}
    <p id="{id}-hint" class="text-sm text-muted">{hint}</p>
  {/if}
</div>
