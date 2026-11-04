<script lang="ts">
  import { parseMarkdown } from '../../markdown/parse';
  import MarkdownBlocks from './MarkdownBlocks.svelte';

  interface Props {
    source: string;
  }
  let { source }: Props = $props();
  const blocks = $derived(parseMarkdown(source));
</script>

<div class="flex flex-col gap-4 break-words">
  <MarkdownBlocks {blocks} />
</div>
