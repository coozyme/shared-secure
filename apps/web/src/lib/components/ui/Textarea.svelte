<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import { controlClass } from './control';

  interface Props extends Omit<HTMLTextareaAttributes, 'class' | 'value'> {
    value?: string;
    invalid?: boolean;
    class?: string;
  }

  let { value = $bindable(''), invalid = false, class: className = '', ...rest }: Props = $props();
</script>

<textarea
  {...rest}
  bind:value
  aria-invalid={invalid ? 'true' : undefined}
  class="{controlClass} min-h-56 resize-y leading-relaxed {className}"></textarea>
