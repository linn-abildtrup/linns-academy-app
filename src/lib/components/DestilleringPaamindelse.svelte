<script lang="ts">
	// Minder Linn om at koere "Laer af alle svar" naar den destillerede viden
	// er blevet gammel. Vises kun naar der er noget at minde om, saa den er
	// usynlig i hverdagen og kun taler naar den har noget at sige.
	import { onMount } from 'svelte';
	import {
		boerMindesOmDestillering,
		dageSidenDestillering,
		destilleringAlderTekst
	} from '$lib/content/linnAi';
	import { hentAlleVidenbaseDokumenter } from '$lib/firestore/linnAi';

	let dage = $state<number | null>(null);
	let hentet = $state(false);

	onMount(async () => {
		try {
			dage = dageSidenDestillering(await hentAlleVidenbaseDokumenter());
			hentet = true;
		} catch (e) {
			// En paamindelse maa aldrig vaelte siden den staar paa.
			console.error('Kunne ikke hente videnbasens alder:', e);
		}
	});
</script>

{#if hentet && boerMindesOmDestillering(dage)}
	<a class="paamindelse" href="/app/admin/linn-ai">
		<span class="prik" aria-hidden="true"></span>
		<span class="tekst">
			<strong>AI'en har ikke lært af dine nyeste svar.</strong>
			{destilleringAlderTekst(dage)}. Tryk her og kør "Lær af alle svar", det tager et halvt minut.
		</span>
	</a>
{/if}

<style>
	.paamindelse {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 16px;
		padding: 12px 14px;
		border-radius: 12px;
		border: 1px solid rgba(184, 123, 110, 0.35);
		background: rgba(184, 123, 110, 0.08);
		color: inherit;
		text-decoration: none;
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1.45;
	}

	.paamindelse:hover {
		background: rgba(184, 123, 110, 0.14);
	}

	.prik {
		flex: 0 0 auto;
		width: 8px;
		height: 8px;
		margin-top: 7px;
		border-radius: 50%;
		background: #b87b6e;
	}

	.tekst strong {
		display: block;
	}
</style>
