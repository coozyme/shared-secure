<script lang="ts">
  import { page } from '$app/state';
  import PageContainer from '#lib/components/layout/PageContainer.svelte';
  import LinkButton from '#lib/components/ui/LinkButton.svelte';

  const notFound = $derived(page.status === 404);
</script>

<svelte:head>
  <title>{notFound ? 'Page not found' : 'Error'} · Shared</title>
</svelte:head>

<PageContainer width="narrow">
  <div class="flex flex-col gap-5">
    <h1 class="text-3xl font-semibold tracking-tight">
      {notFound ? 'This page doesn’t exist' : 'Something went wrong'}
    </h1>
    <p class="text-foreground/85">
      {notFound
        ? 'Check the address. If you were sent a note link, make sure you have all of it.'
        : 'Reload the page and try again.'}
    </p>
    <div><LinkButton href="/" variant="secondary">Go to the home page</LinkButton></div>
  </div>
</PageContainer>
