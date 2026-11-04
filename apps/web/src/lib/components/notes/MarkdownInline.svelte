<script lang="ts">
  import type { Inline } from '../../markdown/parse';
  import Self from './MarkdownInline.svelte';

  interface Props {
    nodes: readonly Inline[];
  }
  let { nodes }: Props = $props();
</script>

<!-- Every value below is interpolated as text; raw-HTML rendering is banned app-wide (ADR 0012). -->
{#each nodes as node, index (index)}
  {#if node.kind === 'text'}{node.text}{:else if node.kind === 'strong'}<strong
      class="font-semibold"><Self nodes={node.children} /></strong
    >{:else if node.kind === 'em'}<em><Self nodes={node.children} /></em
    >{:else if node.kind === 'del'}<del><Self nodes={node.children} /></del
    >{:else if node.kind === 'code'}<code
      class="rounded bg-sunken px-1 py-0.5 font-mono text-[0.875em]">{node.text}</code
    >{:else if node.kind === 'br'}<br />{:else}<a
      href={node.href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      class="text-primary underline underline-offset-2 hover:no-underline"
      ><Self nodes={node.children} /><span class="text-muted">{` (${node.href})`}</span></a
    >{/if}
{/each}
