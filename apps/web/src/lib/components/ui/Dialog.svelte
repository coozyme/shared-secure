<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open?: boolean;
    title: string;
    description?: string;
    children?: Snippet;
    actions: Snippet;
  }

  let { open = $bindable(false), title, description, children, actions }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  const titleId = $props.id();

  // Native modal <dialog>: focus trapping, Escape and inert background are handled by the browser.
  $effect(() => {
    if (dialog === undefined) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="{titleId}-title"
  aria-describedby={description ? `${titleId}-description` : undefined}
  onclose={() => (open = false)}
  onclick={(event) => {
    if (event.target === dialog) open = false;
  }}
  class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-(--radius-panel) border border-line bg-surface p-0 text-foreground shadow-(--shadow-panel) backdrop:bg-foreground/40"
>
  <div class="flex flex-col gap-4 p-6">
    <h2 id="{titleId}-title" class="text-lg font-semibold">{title}</h2>
    {#if description}<p id="{titleId}-description" class="text-sm text-muted">{description}</p>{/if}
    {#if children}{@render children()}{/if}
    <div class="flex flex-wrap justify-end gap-2">{@render actions()}</div>
  </div>
</dialog>
