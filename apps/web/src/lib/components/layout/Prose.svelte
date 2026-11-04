<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children }: { children: Snippet } = $props();
</script>

<!-- Long-form text: readable measure and spacing for legal and help pages. -->
<div
  class="flex flex-col gap-4 text-foreground/85 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5"
>
  {@render children()}
</div>
