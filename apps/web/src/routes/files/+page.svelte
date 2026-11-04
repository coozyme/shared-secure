<script lang="ts">
  import PageContainer from '#lib/components/layout/PageContainer.svelte';
  import Badge from '#lib/components/ui/Badge.svelte';
  import LinkButton from '#lib/components/ui/LinkButton.svelte';
</script>

<svelte:head>
  <title>Shared Files · Shared</title>
</svelte:head>

<PageContainer width="narrow">
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-3xl font-semibold tracking-tight">Shared Files</h1>
      <Badge>Coming soon</Badge>
    </div>
    <p class="text-foreground/85">
      File sharing isn’t available yet. It will work like notes: the file and its name are encrypted
      in your browser in small pieces, uploaded, and deleted when the link expires or reaches its
      download limit.
    </p>
    <p class="text-foreground/85">Until then, you can share text privately with a note.</p>
    <div><LinkButton href="/notes">Write a note</LinkButton></div>
  </div>
</PageContainer>
