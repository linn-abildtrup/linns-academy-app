<script lang="ts">
	// Lille 'BETA'-badge der vises ved siden af eller over en test-feature
	// så brugeren ved at hun er med i en test. Bruges sammen med
	// harTestAdgang() der allerede har gated funktionen.
	//
	// Eksempel:
	//   {#if harTestAdgang(userDoc, 'madplan-v2')}
	//     <h2>Madplan <TesterBadge /></h2>
	//     <NyMadplan />
	//   {/if}

	interface Props {
		/** Vis 'BETA' (default) eller 'TEST' afhængigt af konteksten. */
		tekst?: 'BETA' | 'TEST' | 'NY';
		/** Lille tooltip-tekst. */
		title?: string;
	}

	let { tekst = 'BETA', title = 'Du tester en ny funktion — feedback modtages gerne' }: Props =
		$props();
</script>

<span class="badge" {title}>{tekst}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 7px;
		border-radius: 99px;
		background: var(--terra);
		color: #fff;
		font-size: calc(9.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		vertical-align: middle;
		margin-left: 6px;
		flex-shrink: 0;
	}
</style>
