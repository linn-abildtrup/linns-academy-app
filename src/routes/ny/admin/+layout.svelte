<script lang="ts">
	// ============================================================
	// Rammen om ALLE admin-sider i den nye app.
	//
	// Linns oenske 1. september 2026: sidemenuen skal ALTID staa ude til
	// hoejre paa en computer. Foer den her fil laa skinnen kun paa
	// admin-forsiden, saa de nye undersider havde slet ingen menu.
	//
	// SKINNEN STAAR TIL HOEJRE. Det er derfor indholdet kommer FOERST i
	// markup og skinnen SIDST: paa en telefon falder de to under hinanden i
	// den raekkefoelge de staar, og der skal menuen ligge oeverst, ikke
	// under en side der kan vaere flere skaerme lang.
	//
	// Den samme skinne ligger i /app/admin/+layout.svelte, som er rammen om
	// de 19 gamle sider. Retter du navnene her, saa ret dem ogsaa der.
	// ============================================================

	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { OMRAADE_NAVN, VAERKTOEJER, type Omraade } from '$lib/content/adminForside3';

	let { children } = $props();

	const hentUser = getContext<() => User | null>('user');
	const erAdmin = $derived(isAdmin(hentUser()));

	const OMRAADER: Omraade[] = ['kunder', 'forlob', 'mad', 'traening', 'beskeder', 'system'];

	const erForside = $derived(page.url.pathname === '/ny/admin');
	const valgtOmraade = $derived(page.url.searchParams.get('omraade'));

	/** Hvilket omraade den side man staar paa hoerer til. */
	const nuVaerktoej = $derived(
		VAERKTOEJER.find((v) => v.rute === page.url.pathname) ??
			VAERKTOEJER.find((v) => page.url.pathname.startsWith(v.rute + '/'))
	);

	function erPaa(o: Omraade): boolean {
		if (erForside) return valgtOmraade === o;
		return nuVaerktoej?.omraade === o;
	}
</script>

{#if erAdmin}
	<div class="al">
		<div class="al-indhold">{@render children()}</div>

		<nav class="al-skinne" aria-label="Admin-menu">
			<a class="al-punkt" class:paa={erForside && !valgtOmraade} href="/ny/admin">Forside</a>
			{#each OMRAADER as o (o)}
				<a class="al-punkt" class:paa={erPaa(o)} href="/ny/admin?omraade={o}">
					{OMRAADE_NAVN[o]}
				</a>
			{/each}
			<a class="al-punkt al-ud" href="/app">Ud til appen</a>
		</nav>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.al {
		display: grid;
		/* Indholdet foerst, skinnen sidst. Se noten i toppen. */
		grid-template-columns: 1fr 208px;
		align-items: start;
		min-height: 100%;
	}

	.al-indhold {
		min-width: 0;
	}

	.al-skinne {
		padding: 18px 12px 30px;
		border-left: 1px solid var(--line);
		background: var(--paper-2);
		align-self: stretch;
		position: sticky;
		top: 0;
	}

	.al-punkt {
		display: block;
		padding: 11px 12px;
		margin-bottom: 2px;
		border-radius: 12px;
		color: var(--espresso);
		text-decoration: none;
		font-size: calc(14.5px * var(--fs-scale, 1));
	}

	.al-punkt.paa {
		background: var(--plum);
		color: #fff;
		font-weight: 600;
	}

	.al-ud {
		margin-top: 14px;
		color: var(--ink-3);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	/* iPad paa hoejkant og telefon. Skinnen falder OP over indholdet, fordi
	   den staar sidst i markup men foerst i raekkefoelgen her. En menu under
	   en side der er fem skaerme lang kan man ikke finde. */
	@media (max-width: 900px) {
		.al {
			display: flex;
			flex-direction: column;
		}

		.al-skinne {
			order: -1;
			display: flex;
			gap: 6px;
			overflow-x: auto;
			padding: 10px 14px;
			border-left: none;
			border-bottom: 1px solid var(--line);
			position: static;
		}

		.al-punkt {
			flex-shrink: 0;
			margin-bottom: 0;
			padding: 9px 15px;
			background: var(--paper);
			border-radius: 99px;
			white-space: nowrap;
		}

		.al-ud {
			margin-top: 0;
		}
	}
</style>
