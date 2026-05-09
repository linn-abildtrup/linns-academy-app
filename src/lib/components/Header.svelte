<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';

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
	}

	.brand {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1;
		text-decoration: none;
		color: inherit;
		gap: 4px;
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
</style>
