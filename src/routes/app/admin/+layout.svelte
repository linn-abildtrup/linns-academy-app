<script lang="ts">
	// ============================================================
	// Rammen om de GAMLE admin-sider.
	//
	// Linns oenske 1. september 2026: alle admin-sider skal ligne det nye
	// design. De 19 gamle sider fylder tilsammen cirka 13.700 linjer, saa
	// de bliver lavet om én ad gangen, i den raekkefoelge hun bruger dem.
	//
	// DEN HER FIL ER FOERSTE SKRIDT, og den er det billige med den stoerste
	// virkning: den samme skinne og den samme top rundt om alle 19 paa én
	// gang, mens selve siderne staar uroerte indeni. Saa foeles admin som
	// ét sted, og man kan gaa fra en gammel til en ny side uden at skifte
	// verden.
	//
	// INGEN AF DE 19 SIDER ER ROERT. Kun rammen om dem.
	//
	// FARVERNE STAAR LOKALT HER, og det er med vilje. 3.0's farver bor i
	// ny.css, som kun hentes paa /ny. Importerede vi den fil ind i den
	// gamle app, ville den kunne aendre udseendet for 925 kunder. De faa
	// vaerdier her er skrevet af med samme hex, og Svelte holder dem inde
	// i komponenten, saa de ikke kan slippe ud.
	//
	// Adgangs-tjekket nederst er UAENDRET fra foer.
	// ============================================================

	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { OMRAADE_NAVN, VAERKTOEJER, type Omraade } from '$lib/content/adminForside3';

	let { children } = $props();

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	$effect(() => {
		if (user !== null && !isAdmin(user)) {
			goto('/app');
		}
	});

	const erAdmin = $derived(isAdmin(user));

	const OMRAADER: Omraade[] = ['kunder', 'forlob', 'mad', 'traening', 'beskeder', 'system'];

	/** Navnet paa den side man staar paa, saa toppen kan sige hvor man er. */
	const nuVaerktoej = $derived(
		VAERKTOEJER.find((v) => v.rute === page.url.pathname) ??
			VAERKTOEJER.find((v) => page.url.pathname.startsWith(v.rute + '/'))
	);
</script>

{#if erAdmin}
	<div class="ar">
		<!-- Indholdet staar FOERST i markup og skinnen SIDST. Linns oenske
		     1. september: menuen skal altid vaere ude til hoejre paa en
		     computer. Paa en telefon falder de under hinanden, og der
		     loefter order:-1 menuen op over indholdet. -->
		<div class="ar-hoved">
			{#if nuVaerktoej}
				<div class="ar-top">
					<a class="ar-tilbage" href="/ny/admin?omraade={nuVaerktoej.omraade}"
						>‹ {OMRAADE_NAVN[nuVaerktoej.omraade]}</a
					>
					<span class="ar-navn">{nuVaerktoej.navn}</span>
				</div>
			{/if}
			{@render children()}
		</div>

		<nav class="ar-skinne" aria-label="Admin-menu">
			<a class="ar-punkt" href="/ny/admin">Forside</a>
			{#each OMRAADER as o (o)}
				<a class="ar-punkt" class:paa={nuVaerktoej?.omraade === o} href="/ny/admin?omraade={o}"
					>{OMRAADE_NAVN[o]}</a
				>
			{/each}
		</nav>
	</div>
{:else}
	<div class="ingen-adgang">
		<p>Tjekker adgang...</p>
	</div>
{/if}

<style>
	/* 3.0's farver, skrevet af med samme hex. De staar HER og ikke paa
	   :root, saa de ikke kan naa den gamle apps oevrige sider. */
	.ar {
		--ar-paper: #fbf8f2;
		--ar-paper-2: #f6f0e7;
		--ar-oat: #f1eadf;
		--ar-espresso: #382c2a;
		--ar-ink-3: #a3948a;
		--ar-line: #e8dfd1;
		--ar-plum: #7c4f63;

		display: grid;
		grid-template-columns: 1fr 208px;
		align-items: start;
		background: var(--ar-paper);
	}

	/* INGEN min-height: 100vh her. De gamle admin-sider ligger inde i
	   kunde-appens skal, som allerede har en top og en bundmenu, og en
	   ramme paa fuld skaermhoejde ville lave dobbelt rulning og laegge sig
	   ind under bundmenuen. Skinnen faelger i stedet med paa lange sider. */

	.ar-skinne {
		background: var(--ar-paper-2);
		border-left: 1px solid var(--ar-line);
		padding: 20px 12px 30px;
		align-self: stretch;
		position: sticky;
		top: 0;
	}

	.ar-punkt {
		display: block;
		padding: 11px 12px;
		margin-bottom: 2px;
		border-radius: 12px;
		color: var(--ar-espresso);
		text-decoration: none;
		font-size: calc(14.5px * var(--fs-scale, 1));
	}

	.ar-punkt:hover {
		background: var(--ar-oat);
	}

	.ar-punkt.paa {
		background: var(--ar-plum);
		color: #fff;
		font-weight: 600;
	}

	.ar-hoved {
		min-width: 0;
		background: var(--ar-paper);
	}

	.ar-top {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 16px 22px 0;
	}

	.ar-tilbage {
		color: var(--ar-ink-3);
		text-decoration: none;
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.ar-tilbage:hover {
		color: var(--ar-espresso);
	}

	.ar-navn {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--ar-espresso);
	}

	/* iPad paa hoejkant og telefon. Skinnen bliver en raekke der ruller,
	   praecis som paa den nye forside. */
	@media (max-width: 900px) {
		.ar {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.ar-skinne {
			order: -1;
			display: flex;
			gap: 6px;
			overflow-x: auto;
			padding: 10px 14px;
			border-left: none;
			border-bottom: 1px solid var(--ar-line);
			position: static;
		}

		.ar-punkt {
			flex-shrink: 0;
			margin-bottom: 0;
			padding: 9px 15px;
			background: var(--ar-paper);
			border-radius: 99px;
			white-space: nowrap;
		}

		.ar-top {
			padding: 14px 18px 0;
		}
	}

	.ingen-adgang {
		padding: 40px 18px;
		text-align: center;
		color: var(--text3);
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
	}
</style>
