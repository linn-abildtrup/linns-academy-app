<script lang="ts">
	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';
	import type { UserDoc } from '$lib/types';
	import { getGreetingWithName } from '$lib/utils/greeting';
	import { formatDato } from '$lib/content/forlob';

	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const userDoc = $derived(getUserDoc?.() ?? null);

	const erForside = $derived(
		page.url.pathname === '/app' || page.url.pathname === '/app/'
	);
	const greeting = $derived(getGreetingWithName(userDoc?.firstName ?? ''));
	const today = $derived(formatDato(new Date()));

	function getModuleName(pathname: string): string {
		if (pathname.startsWith('/app/admin/forlob')) return 'ADMIN — FORLØB';
		if (pathname.startsWith('/app/admin/traening')) return 'ADMIN — TRÆNINGSMODUL';
		if (pathname.startsWith('/app/admin/opskrifter')) return 'ADMIN — OPSKRIFTER';
		if (pathname.startsWith('/app/admin/spoergsmaal')) return 'ADMIN — SPØRGSMÅL';
		if (pathname.startsWith('/app/admin')) return 'ADMIN';
		if (pathname.startsWith('/app/moduler/30-30-3')) return '30-30 BEREGNER';
		if (pathname.startsWith('/app/moduler/bibliotek')) return 'BIBLIOTEK';
		if (pathname.startsWith('/app/moduler/forlob')) return 'MIT FORLØB';
		if (pathname.startsWith('/app/moduler/traening/mikrotraening')) return 'MIKROTRÆNING';
		if (pathname.startsWith('/app/moduler/traening')) return 'TRÆNING';
		if (pathname.startsWith('/app/moduler/vaner')) return 'VANER';
		if (pathname.startsWith('/app/moduler')) return 'MODULER';
		if (pathname.startsWith('/app/profil')) return 'PROFIL';
		if (pathname.startsWith('/app/beskeder')) return 'BESKEDER';
		if (pathname.startsWith('/app/faellesskab')) return 'FÆLLESSKAB';
		return '';
	}

	const moduleName = $derived(getModuleName(page.url.pathname));
</script>

<header class="app-header">
	<a class="brand" href="/app" aria-label="Tilbage til forsiden">
		<Logo size="sm" />
		{#if moduleName}
			<span class="brand-module">{moduleName}</span>
		{/if}
	</a>
	{#if erForside && userDoc?.firstName}
		<span class="divider" aria-hidden="true"></span>
		<div class="header-hilsen">
			<div class="date-label">{today}</div>
			<div class="greeting-text">{greeting}</div>
		</div>
	{/if}
</header>

<style>
	.app-header {
		background: var(--header);
		border-bottom: 1px solid var(--border);
		padding: calc(14px + env(safe-area-inset-top)) 20px 10px;
		position: sticky;
		top: 0;
		z-index: 50;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.brand {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1;
		text-decoration: none;
		color: inherit;
		gap: 4px;
		flex-shrink: 0;
	}

	.brand-module {
		font-family: var(--ff-b);
		font-size: 9px;
		font-weight: 600;
		color: var(--terra);
		letter-spacing: 0.22em;
		text-transform: uppercase;
		opacity: 0.85;
	}

	.divider {
		width: 1px;
		align-self: stretch;
		background: var(--border);
		margin: 4px 0;
	}

	.header-hilsen {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		text-align: right;
		gap: 4px;
		line-height: 1.1;
	}

	.date-label {
		font-family: var(--ff-b);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
	}

	.greeting-text {
		font-family: var(--ff-d);
		font-size: 16px;
		font-weight: 500;
		color: var(--text);
		letter-spacing: -0.005em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
</style>
