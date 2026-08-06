<script lang="ts">
	// ============================================================
	// "Til dig lige nu". Én plads oeverst paa forsiden til alt der
	// venter paa hende. Farvestriben til venstre siger hvad linjen er:
	// blomme for noget fra Linn, honning for noget der har en frist.
	//
	// Vises kun naar der faktisk er noget. Er listen tom, staar der
	// ingenting, og forsiden begynder med hendes overskud som foer.
	// ============================================================

	import type { Besked } from '$lib/content/beskeder3';

	interface Props {
		beskeder: Besked[];
	}

	let { beskeder }: Props = $props();
</script>

{#if beskeder.length > 0}
	<section class="tildig">
		<div class="tildig-k">Til dig lige nu</div>
		{#each beskeder as b (b.id)}
			<a
				class="tildig-linje"
				href={b.href}
				target={b.ekstern ? '_blank' : undefined}
				rel={b.ekstern ? 'noopener' : undefined}
			>
				<span class="tildig-stribe {b.slags}" aria-hidden="true"></span>
				<span class="tildig-tekst">
					<span class="tildig-t">{b.titel}</span>
					<span class="tildig-u">{b.uddrag}</span>
				</span>
				<svg
					class="tildig-pil"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m9 6 6 6-6 6" />
				</svg>
			</a>
		{/each}
	</section>
{/if}
