<script lang="ts">
  interface Props {
    /** Announced to screen readers; omit when the surrounding text already says what is loading. */
    label?: string;
    class?: string;
  }
  let { label, class: className = 'size-4' }: Props = $props();
</script>

<svg
  class="animate-spin {className}"
  viewBox="0 0 24 24"
  fill="none"
  role={label === undefined ? 'presentation' : 'img'}
  aria-hidden={label === undefined ? 'true' : undefined}
  aria-label={label}
>
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
</svg>
