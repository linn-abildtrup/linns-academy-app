<script lang="ts">
	// ============================================================
	// "Dagens små skridt". Ét kort, uanset om skridtene kommer fra et
	// forloeb eller fra dem hun selv har valgt som medlem.
	//
	// Et tryk paa cirklen skifter mellem klaret og ikke klaret. Der
	// skrives kun det ene felt, aldrig hele dagen.
	// ============================================================

	import type { Skridt } from '$lib/firestore/forside3';
	import Fluebe from './Fluebe.svelte';

	interface Props {
		skridt: Skridt[];
		gemmer: string | null;
		onskift: (id: string, klaret: boolean) => void;
	}

	let { skridt, gemmer, onskift }: Props = $props();

	const klarede = $derived(skridt.filter((s) => s.svar === 'ja').length);
	const OMKREDS = 2 * Math.PI * 23;
	const ringOffset = $derived(
		skridt.length === 0 ? OMKREDS : OMKREDS - (klarede / skridt.length) * OMKREDS
	);

	const opmuntring = $derived.by(() => {
		if (skridt.length === 0) return '';
		if (klarede === 0) return 'Tag det første, når du er klar.';
		if (klarede === skridt.length) return 'Du har taget dem alle i dag.';
		if (klarede === 1) return 'Du er i gang, tag det næste.';
		return `${klarede} ud af ${skridt.length} klaret, flot.`;
	});
</script>

<section class="kort">
	<div class="skridt-top">
		<div class="ring">
			<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
				<circle cx="28" cy="28" r="23" fill="none" stroke="var(--line)" stroke-width="6" />
				<circle
					cx="28"
					cy="28"
					r="23"
					fill="none"
					stroke="var(--honey)"
					stroke-width="6"
					stroke-linecap="round"
					stroke-dasharray={OMKREDS}
					stroke-dashoffset={ringOffset}
				/>
			</svg>
			<span>{klarede}/{skridt.length}</span>
		</div>
		<div>
			<div class="skridt-t">Dagens små skridt</div>
			<div class="skridt-s">{opmuntring}</div>
		</div>
	</div>

	<div class="skridt-liste">
		{#each skridt as s (s.id)}
			{@const klaret = s.svar === 'ja'}
			<div class="skridt" class:klar={klaret}>
				<button
					class="boks"
					class:klar={klaret}
					disabled={gemmer === s.id}
					aria-pressed={klaret}
					aria-label={klaret ? `Fortryd ${s.label}` : `Markér ${s.label} som klaret`}
					onclick={() => onskift(s.id, !klaret)}
				>
					{#if klaret}<Fluebe />{/if}
				</button>
				<div class="tx">{s.label}</div>
				{#if !klaret}
					<button class="mrk" disabled={gemmer === s.id} onclick={() => onskift(s.id, true)}>
						Markér
					</button>
				{/if}
			</div>
		{/each}
	</div>
</section>
