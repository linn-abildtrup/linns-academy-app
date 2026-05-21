<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import { hentForlobsProgram, type ProgramMedDage } from '$lib/firestore/mikrotraening';

	const forlobId = $derived(page.params.forlobId ?? '');
	const programId = $derived(page.params.programId ?? '');

	let program = $state<ProgramMedDage | null>(null);
	let indlaeser = $state(true);
	let fejl = $state<string | null>(null);

	onMount(async () => {
		try {
			program = await hentForlobsProgram(forlobId, programId);
			if (!program) {
				fejl = 'Programmet findes ikke.';
			}
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente programmet.';
		} finally {
			indlaeser = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Træning</span>
		</a>
		<div class="eyebrow">Træningsprogram</div>
		<h1>{program?.program.navn ?? (indlaeser ? 'Henter…' : 'Program')}</h1>
		{#if program}
			<p class="page-sub">
				{program.program.antalDage} dage · {program.program.udstyr.join(', ')} ·
				{program.program.niveau}
			</p>
			{#if program.program.beskrivelse}
				<p class="page-sub">{program.program.beskrivelse}</p>
			{/if}
		{/if}
	</header>

	{#if fejl}
		<div class="besked fejl">{fejl}</div>
	{:else if indlaeser}
		<div class="besked">Henter program…</div>
	{:else if program}
		<div class="kommer-snart">
			<div class="kommer-snart-titel">Træning kommer snart</div>
			<p>
				Programmet er klar i admin, men selve træning-flowet (start dag, øvelser med video,
				timer) er endnu ikke koblet på her. Det bygges som det næste skridt.
			</p>
			<p class="hint">Programmet har {program.dage.length} dage tilgængelige i admin.</p>
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 18px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.kommer-snart {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 18px;
	}

	.kommer-snart-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 8px;
	}

	.kommer-snart p {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0 0 10px;
	}

	.hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
	}
</style>
