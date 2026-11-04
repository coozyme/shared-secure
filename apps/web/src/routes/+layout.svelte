<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import AppFooter from '#lib/components/layout/AppFooter.svelte';
  import AppHeader from '#lib/components/layout/AppHeader.svelte';
  import Toaster from '#lib/components/ui/Toaster.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<a
  href="#main"
  class="sr-only z-50 rounded-md bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
>
  Skip to content
</a>
<div class="flex min-h-dvh flex-col">
  <AppHeader pathname={page.url.pathname} />
  <main id="main" tabindex="-1" class="flex-1 py-10 focus:outline-none sm:py-14">
    {@render children()}
  </main>
  <AppFooter />
</div>
<Toaster />
