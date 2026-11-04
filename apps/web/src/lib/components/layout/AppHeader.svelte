<script lang="ts">
  import { onMount } from 'svelte';
  import { currentTheme, setTheme, type Theme } from '../../theme';
  import Logo from './Logo.svelte';

  interface Props {
    /** Current pathname, to mark the active section. */
    pathname: string;
  }
  let { pathname }: Props = $props();

  let theme = $state<Theme>('light');
  onMount(() => {
    theme = currentTheme();
  });

  function toggleTheme(): void {
    theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
  }

  const links = [
    { href: '/notes', label: 'Notes', match: ['/notes', '/n/'] },
    { href: '/files', label: 'Files', match: ['/files', '/f/'] },
  ] as const;

  const isActive = (match: readonly string[]): boolean =>
    match.some(
      (prefix) =>
        pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`),
    );
</script>

<header class="border-b border-line bg-surface/90">
  <div class="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
    <a
      href="/"
      class="-ml-1 flex items-center gap-2.5 rounded-md px-1 py-1 font-semibold tracking-tight text-foreground"
    >
      <Logo />
      <span class="text-[1.0625rem]">Shared</span>
    </a>
    <nav aria-label="Main" class="ml-auto">
      <ul class="flex items-center gap-1">
        {#each links as link (link.href)}
          <li>
            <a
              href={link.href}
              aria-current={isActive(link.match) ? 'page' : undefined}
              class="inline-flex min-h-10 items-center rounded-md px-3 text-sm text-muted transition-colors hover:bg-sunken hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              {link.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
    <button
      type="button"
      onclick={toggleTheme}
      aria-pressed={theme === 'dark'}
      class="inline-flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-foreground"
    >
      <span class="sr-only">Dark theme</span>
      {#if theme === 'dark'}
        <svg
          viewBox="0 0 24 24"
          class="size-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          aria-hidden="true"
        >
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" stroke-linejoin="round" />
        </svg>
      {:else}
        <svg
          viewBox="0 0 24 24"
          class="size-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"
            stroke-linecap="round"
          />
        </svg>
      {/if}
    </button>
  </div>
</header>
