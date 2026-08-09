<script lang="ts">
	// ============================================================
	// Challenge paa forsiden: samlingen.
	//
	// Hver plante hun har spist er et felt. Gitteret er lige saa stort
	// som maalet Linn har sat, og raekkerne er ti brede, saa hun kan se
	// at hun har passeret tredive uden at taelle. Den nyeste plante
	// lyser op i honning, saa det sidste hun gjorde er synligt.
	//
	// Hendes plads staar kun naar hun er godt med. Se begrundelsen i
	// pladsTekst i challenge3.ts.
	// ============================================================

	import {
		byggRaekker,
		fremdriftTekst,
		pladsTekst,
		type ChallengeForside
	} from '$lib/content/challenge3';

	interface Props {
		challenge: ChallengeForside;
		onindtast: () => void;
		onstilling: () => void;
	}

	let { challenge, onindtast, onstilling }: Props = $props();

	const raekker = $derived(byggRaekker(challenge.score, challenge.maal));
	const fremdrift = $derived(fremdriftTekst(challenge));
	const plads = $derived(pladsTekst(challenge));

	const dageTekst = $derived(
		challenge.dageTilbage === 0
			? 'Sidste dag'
			: challenge.dageTilbage === 1
				? '1 dag tilbage'
				: `${challenge.dageTilbage} dage tilbage`
	);
</script>

<section>
	<div class="lab">
		<h2>Challenge</h2>
	</div>

	<article class="ch-kort">
		<div class="ch-hoved">
			<div class="ch-navn">{challenge.navn}</div>
			<div class="ch-score">{challenge.score}</div>
		</div>

		<div class="ch-gitter" role="img" aria-label="{challenge.score} af {challenge.maal} planter">
			{#each raekker as raekke (raekke.indtil)}
				<div class="ch-raekke">
					{#each raekke.felter as felt, i (i)}
						<span class="ch-felt" class:fyldt={felt.fyldt} class:nyeste={felt.nyeste}></span>
					{/each}
					<span class="ch-maerke">{raekke.indtil}</span>
				</div>
			{/each}
		</div>

		<div class="ch-linjer">
			<p class="ch-fremdrift">{fremdrift}</p>
			<p class="ch-under">
				{#if challenge.senesteJournal}
					Senest: {challenge.senesteJournal}.
				{/if}
				{dageTekst}.{#if plads}
					{' '}{plads}.{/if}
			</p>
		</div>

		<div class="ch-knapper">
			<button type="button" class="ch-knap primaer" onclick={onindtast}>Tilføj plante</button>
			<button type="button" class="ch-knap sekundaer" onclick={onstilling}>Se stillingen</button>
		</div>
	</article>
</section>
