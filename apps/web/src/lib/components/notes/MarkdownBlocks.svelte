<script lang="ts">
  import type { Block } from '../../markdown/parse';
  import Inline from './MarkdownInline.svelte';
  import Self from './MarkdownBlocks.svelte';

  interface Props {
    blocks: readonly Block[];
  }
  let { blocks }: Props = $props();

  // The note title is the page's h1, so Markdown headings render one level lower (# → h2).
  const headingClass: Record<number, string> = {
    1: 'text-2xl font-semibold',
    2: 'text-xl font-semibold',
    3: 'text-lg font-semibold',
    4: 'text-base font-semibold',
    5: 'text-base font-medium',
    6: 'text-sm font-medium uppercase text-muted',
  };
</script>

{#each blocks as block, index (index)}
  {#if block.kind === 'heading'}
    <svelte:element
      this={`h${String(Math.min(block.level + 1, 6))}`}
      class={headingClass[block.level]}
    >
      <Inline nodes={block.children} />
    </svelte:element>
  {:else if block.kind === 'paragraph'}
    <p><Inline nodes={block.children} /></p>
  {:else if block.kind === 'code'}
    <pre
      class="overflow-x-auto rounded-(--radius-control) bg-sunken p-3 font-mono text-sm leading-relaxed"><code
        >{block.text}</code
      ></pre>
  {:else if block.kind === 'quote'}
    <blockquote class="flex flex-col gap-3 border-l-2 border-line-strong pl-4 text-foreground/80">
      <Self blocks={block.children} />
    </blockquote>
  {:else if block.kind === 'list'}
    <svelte:element
      this={block.ordered ? 'ol' : 'ul'}
      start={block.ordered ? block.start : undefined}
      class="flex flex-col gap-1 pl-6 {block.ordered ? 'list-decimal' : 'list-disc'}"
    >
      {#each block.items as item, itemIndex (itemIndex)}
        <li class={item.checked === null ? '' : 'list-none -ml-6 flex gap-2'}>
          {#if item.checked !== null}
            <input
              type="checkbox"
              checked={item.checked}
              disabled
              class="mt-1.5"
              aria-label={item.checked ? 'Done' : 'Not done'}
            />
          {/if}
          <div class="flex flex-col gap-2"><Self blocks={item.children} /></div>
        </li>
      {/each}
    </svelte:element>
  {:else if block.kind === 'hr'}
    <hr class="border-line" />
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr>
            {#each block.header as cell, cellIndex (cellIndex)}
              <th scope="col" class="border-b border-line-strong px-3 py-2 text-left font-semibold"
                ><Inline nodes={cell} /></th
              >
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each block.rows as row, rowIndex (rowIndex)}
            <tr>
              {#each row as cell, cellIndex (cellIndex)}
                <td class="border-b border-line px-3 py-2 align-top"><Inline nodes={cell} /></td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/each}
