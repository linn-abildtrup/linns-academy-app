<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import { erForlobsklient, erModulbruger, harPremium } from '$lib/utils/userAdgang';
	import { hentAlleProgrammerPaaTvaers, hentTildelingerForBruger, type ProgramMedForlob } from '$lib/firestore/tildelinger';
	import type { ProgramTildeling } from '$lib/content/tildelinger';
	import { alleProdukter } from '$lib/content/produkter';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	const erPremium = $derived(harPremium(userDoc));
	const erAppKunde = $derived(erModulbruger(userDoc));

	const programmer = [
		{
			id: 'mikrotraening',
			navn: 'Mikrotræning',
			beskrivelse: 'Daglig træning',
			rute: '/app/moduler/traening/mikrotraening',
			tilgaengelig: true
		}
	];

	let tildelteProgrammer = $state<ProgramTildeling[]>([]);
	let alleProgrammerPaaTvaers = $state<ProgramMedForlob[]>([]);
	let harCustomBuilderTildelt = $state(false);
	let indlaeserNyt = $state(false);

	// App-kunder har altid custom-builder. Forløbskunder kun hvis admin har tildelt
	// adgang (pr forløb eller pr kunde).
	const visCustomBuilder = $derived(erAppKunde || harCustomBuilderTildelt);

	onMount(async () => {
		if (!erPremium || !user || !userDoc) return;
		indlaeserNyt = true;
		try {
			const [tildelinger, allePaaTvaers] = await Promise.all([
				hentTildelingerForBruger(user.uid, userDoc.forlobIds ?? []),
				hentAlleProgrammerPaaTvaers()
			]);
			tildelteProgrammer = tildelinger.programmer;
			harCustomBuilderTildelt = tildelinger.harCustomBuilder;
			alleProgrammerPaaTvaers = allePaaTvaers;
		} catch (e) {
			console.error('Kunne ikke hente tildelinger:', e);
		} finally {
			indlaeserNyt = false;
		}
	});

	function programInfo(t: ProgramTildeling): ProgramMedForlob | undefined {
		return alleProgrammerPaaTvaers.find(
			(p) => p.forlobId === t.forlobId && p.program.id === t.programId
		);
	}

	function forlobNavnFor(id: string): string {
		const produkt = alleProdukter().find((p) => p.forlobId === id);
		return produkt?.navn ?? id;
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">Modul</div>
		<h1>Træning</h1>
		<p class="page-sub">
			{#if erForlobsklient(userDoc)}
				Dit aktive træningsprogram fra forløbet.
			{:else}
				Træningsprogrammer du har adgang til.
			{/if}
		</p>
	</header>

	{#if erPremium}
		<div class="sektion">
			<div class="sektion-titel">Mine træningsprogrammer</div>
			{#if indlaeserNyt}
				<p class="hint">Henter…</p>
			{:else if tildelteProgrammer.length === 0}
				<p class="hint">
					Du har ikke nogen tildelte programmer endnu. Når Linn tildeler et program til
					dig eller dit forløb, dukker det op her.
				</p>
			{:else}
				<div class="program-liste">
					{#each tildelteProgrammer as t (t.id)}
						{@const info = programInfo(t)}
						<a
							class="program-row"
							href={`/app/moduler/traening/program/${t.forlobId}/${t.programId}`}
						>
							<div class="program-icon">
								<Icon name="flame" size={18} color="#fff" />
							</div>
							<div class="program-tekst">
								<div class="program-navn">{info?.program.navn ?? t.programId}</div>
								<div class="program-sub">
									{#if info}
										{info.program.antalDage} dage · {info.program.udstyr.join(', ')}
									{:else}
										Fra {forlobNavnFor(t.forlobId)}
									{/if}
								</div>
							</div>
							<div class="program-pil">
								<Icon name="chevron-r" size={14} color="var(--text3)" />
							</div>
						</a>
					{/each}
				</div>
			{/if}

			{#if visCustomBuilder}
				<a class="byg-eget" href="/app/moduler/traening/byg-eget">
					<div class="byg-eget-icon">
						<Icon name="flame" size={18} color="#fff" />
					</div>
					<div class="byg-eget-tekst">
						<div class="byg-eget-titel">Byg dit eget program</div>
						<div class="byg-eget-sub">Vælg øvelser, sæt, reps og pause selv</div>
					</div>
					<div class="program-pil">
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</div>
				</a>
			{/if}
		</div>
	{/if}

	<div class="program-liste">
		{#each programmer as program (program.id)}
			<a class="program-row" href={program.rute}>
				<div class="program-icon">
					<Icon name="flame" size={18} color="#fff" />
				</div>

				<div class="program-tekst">
					<div class="program-navn">{program.navn}</div>
					<div class="program-sub">{program.beskrivelse}</div>
				</div>

				<div class="program-pil">
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</div>
			</a>
		{/each}
	</div>
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

	.back:hover {
		color: var(--text);
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
		font-size: calc(28px * var(--fs-scale, 1));
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

	.sektion {
		margin-bottom: 18px;
	}

	.sektion-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text2);
		margin-bottom: 8px;
	}

	.hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		line-height: 1.5;
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		margin: 0;
	}

	.program-liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
	}

	.program-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.program-row:first-child {
		border-top: none;
	}

	.program-row:hover {
		background: var(--bg2);
	}

	.program-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: #b87b6e;
	}

	.program-tekst {
		flex: 1;
		min-width: 0;
	}

	.program-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.program-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
		line-height: 1.35;
	}

	.program-pil {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.byg-eget {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 14px;
		background: var(--white);
		border: 1px dashed var(--terra);
		border-radius: 14px;
		text-decoration: none;
		color: inherit;
		margin-top: 10px;
	}

	.byg-eget:hover {
		background: var(--bg2);
	}

	.byg-eget-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: var(--terra);
	}

	.byg-eget-tekst {
		flex: 1;
		min-width: 0;
	}

	.byg-eget-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.byg-eget-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}
</style>
