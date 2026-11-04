<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Spinner from './Spinner.svelte';
  import { buttonClass, type ButtonSize, type ButtonVariant } from './button';

  interface Props extends Omit<HTMLButtonAttributes, 'class' | 'children'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Shows a spinner and blocks repeat clicks while keeping the button focusable. */
    loading?: boolean;
    class?: string;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    loading = false,
    type = 'button',
    disabled = false,
    class: className = '',
    onclick,
    children,
    ...rest
  }: Props = $props();
</script>

<button
  {...rest}
  {type}
  disabled={disabled === true}
  aria-busy={loading ? 'true' : undefined}
  aria-disabled={loading ? 'true' : undefined}
  class={buttonClass(variant, size, className)}
  onclick={(event) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onclick?.(event);
  }}
>
  {#if loading}<Spinner />{/if}
  {@render children()}
</button>
