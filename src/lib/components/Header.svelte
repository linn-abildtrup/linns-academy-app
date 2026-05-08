<script lang="ts">
	import { page } from '$app/state';

	function getModuleName(pathname: string): string {
		if (pathname.startsWith('/app/admin/forlob')) return 'ADMIN — FORLØB';
		if (pathname.startsWith('/app/admin/mikrotraening')) return 'ADMIN — MIKROTRÆNING';
		if (pathname.startsWith('/app/admin/opskrifter')) return 'ADMIN — OPSKRIFTER';
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
		<div class="brand-row">
			<span class="brand-possessive">Linn's</span>
			<span class="brand-title">Academy</span>
		</div>
		{#if moduleName}
			<span class="brand-module">{moduleName}</span>
		{/if}
	</a>
</header>

<style>
	.app-header {
		background: var(--header);
		border-bottom: 1px solid var(--border);
		padding: 14px 20px 10px;
		position: sticky;
		top: 0;
		z-index: 50;
		flex-shrink: 0;
	}

	.brand {
		display: inline-flex;
		flex-direction: column;
		line-height: 1;
		text-decoration: none;
		color: inherit;
	}

	.brand-row {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
	}

	.brand-possessive {
		font-family: var(--ff-d);
		font-style: italic;
		font-size: 16px;
		color: var(--terra);
		letter-spacing: 0.04em;
	}

	.brand-title {
		font-family: var(--ff-d);
		font-size: 16px;
		font-weight: 700;
		color: var(--text);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.brand-module {
		font-family: var(--ff-r);
		font-size: 9px;
		font-weight: 600;
		color: var(--terra);
		letter-spacing: 0.22em;
		text-transform: uppercase;
		margin-top: 4px;
		opacity: 0.85;
	}
</style>
