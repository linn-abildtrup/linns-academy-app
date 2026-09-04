<script lang="ts">
	// Baandet oeverst der siger fra naar appen ikke kan naa serveren, og
	// kvitterer naar alt er naaet frem. Se forbindelseState.svelte.ts.
	//
	// Baandet kan IKKE lukkes mens forbindelsen er vaek. Linns beslutning 4.
	// september 2026: et baand hun kan klikke vaek, klikker hun vaek, og saa
	// er vi tilbage ved udgangspunktet.
	import { erNetopSendt, erOffline } from '$lib/state/forbindelseState.svelte';

	const offline = $derived(erOffline());
	const netopSendt = $derived(erNetopSendt());
</script>

{#if offline}
	<div class="baand roed" role="status">
		<span class="ikon" aria-hidden="true">⚠</span>
		<span class="tekst">
			<b>Ingen forbindelse</b>
			Det du taster bliver ikke gemt endnu. Bliv i appen, så sender vi det når nettet er tilbage.
		</span>
	</div>
{:else if netopSendt}
	<div class="baand groen" role="status">
		<span class="ikon" aria-hidden="true">✓</span>
		<span class="tekst">
			<b>Forbindelsen er tilbage</b>
			Alt det du tastede er sendt af sted.
		</span>
	</div>
{/if}

<style>
	.baand {
		flex: 0 0 auto;
		display: flex;
		gap: 9px;
		align-items: flex-start;
		padding: 10px 14px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		line-height: 1.4;
	}

	.roed {
		background: #f8ece9;
		border-bottom: 1px solid #e9cdc7;
		color: #7d3a31;
	}

	.groen {
		background: #e6f0e9;
		border-bottom: 1px solid #cadfd1;
		color: #33513e;
	}

	.ikon {
		flex: 0 0 auto;
		font-size: calc(14px * var(--fs-scale, 1));
		line-height: 1.25;
	}

	.tekst b {
		display: block;
		margin-bottom: 1px;
	}
</style>
