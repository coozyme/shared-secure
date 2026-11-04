<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { controlClass } from './control';

  interface Props extends Omit<HTMLInputAttributes, 'class' | 'value'> {
    value?: string;
    invalid?: boolean;
    class?: string;
  }

  let { value = $bindable(''), invalid = false, class: className = '', ...rest }: Props = $props();
</script>

<input
  {...rest}
  bind:value
  aria-invalid={invalid ? 'true' : undefined}
  class="{controlClass} {className}"
/>
