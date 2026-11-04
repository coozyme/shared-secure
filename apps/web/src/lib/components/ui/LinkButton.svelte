<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes } from 'svelte/elements';
  import { buttonClass, type ButtonSize, type ButtonVariant } from './button';

  interface Props extends Omit<HTMLAnchorAttributes, 'class' | 'children'> {
    href: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: string;
    children: Snippet;
  }

  let {
    href,
    variant = 'primary',
    size = 'md',
    class: className = '',
    children,
    ...rest
  }: Props = $props();
</script>

<a {...rest} {href} class={buttonClass(variant, size, className)}>{@render children()}</a>
