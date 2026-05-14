<script lang="ts">
	// Subtle 5-stjerners rating-prompt under AI-svar. Brugeren ser en lille
	// 'Hjælp os med at gøre AI bedre'-tekst og fem stjerner hun kan klikke
	// på. Når hun har valgt rating, vises 'Tak!'-besked og stjernerne fryses
	// i den valgte tilstand.
	import type { User } from 'firebase/auth';
	import { gemAiRating } from '$lib/firestore/aiRating';
	import type { AiType, Rating } from '$lib/content/aiRating';

	interface Props {
		user: User | null;
		aiType: AiType;
		sporgsmaal: string;
		svar: string;
		samtaleId?: string;
		beskedIdx?: number;
	}

	const { user, aiType, sporgsmaal, svar, samtaleId, beskedIdx }: Props = $props();

	let valgtRating = $state<Rating | null>(null);
	let hoverRating = $state<Rating | null>(null);
	let gemmer = $state(false);
	let fejl = $state<string | null>(null);
	let lige_ratet = $state(false);

	async function rateSvar(rating: Rating) {
		if (!user || gemmer) return;
		gemmer = true;
		fejl = null;
		try {
			await gemAiRating({
				aiType,
				uid: user.uid,
				userEmail: user.email ?? '',
				sporgsmaal,
				svar,
				rating,
				samtaleId,
				beskedIdx
			});
			valgtRating = rating;
			lige_ratet = true;
		} catch (e) {
			console.error('Kunne ikke gemme AI-rating:', e);
			fejl = 'Kunne ikke gemme. Prøv igen.';
		} finally {
			gemmer = false;
		}
	}

	const stars: Rating[] = [1, 2, 3, 4, 5];
</script>

<div class="rating-blok">
	<div class="rating-prompt">
		{#if valgtRating !== null}
			{lige_ratet ? 'Tak — det hjælper Linn med at gøre AI bedre!' : 'Din rating'}
		{:else}
			Hjælp os med at gøre AI bedre — rate svaret
		{/if}
	</div>
	<div class="stjerne-rad" role="radiogroup" aria-label="Vurder svaret 1 til 5 stjerner">
		{#each stars as star (star)}
			{@const visning = hoverRating ?? valgtRating ?? 0}
			<button
				type="button"
				class="stjerne"
				class:fyldt={star <= visning}
				disabled={gemmer || valgtRating !== null}
				onmouseenter={() => (hoverRating = star)}
				onmouseleave={() => (hoverRating = null)}
				onfocus={() => (hoverRating = star)}
				onblur={() => (hoverRating = null)}
				onclick={() => rateSvar(star)}
				aria-label={`${star} ud af 5 stjerner`}
				aria-checked={valgtRating === star}
				role="radio"
			>
				★
			</button>
		{/each}
	</div>
	{#if fejl}
		<div class="rating-fejl">{fejl}</div>
	{/if}
</div>

<style>
	.rating-blok {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid var(--border);
	}

	.rating-prompt {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		font-family: var(--ff-b);
	}

	.stjerne-rad {
		display: flex;
		gap: 1px;
	}

	.stjerne {
		background: none;
		border: none;
		padding: 2px 3px;
		font-size: calc(15px * var(--fs-scale, 1));
		line-height: 1;
		color: var(--border2, #ddd1c5);
		cursor: pointer;
		transition: color 0.12s ease, transform 0.12s ease;
	}

	.stjerne:hover:not(:disabled) {
		transform: scale(1.1);
	}

	.stjerne.fyldt {
		color: #d9b350;
	}

	.stjerne:disabled {
		cursor: default;
	}

	.rating-fejl {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: #8a4a3e;
	}
</style>
