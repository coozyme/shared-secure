<script lang="ts">
  import { toasts } from '../../stores/toast.svelte';
</script>

<!-- The live region always exists so screen readers pick up each new message. -->
<div
  class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
  role="status"
  aria-live="polite"
>
  {#if toasts.current}
    {#key toasts.current.id}
      <p
        class="rounded-(--radius-control) bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-(--shadow-panel)"
      >
        {toasts.current.text}
      </p>
    {/key}
  {/if}
</div>
