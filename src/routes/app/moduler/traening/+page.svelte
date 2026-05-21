<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import { erForlobsklient, erModulbruger, harPremium } from '$lib/utils/userAdgang';
	import {
		hentAlleProgrammerPaaTvaers,
		hentTildelingerForBruger,
		type ProgramMedForlob
	} from '$lib/firestore/tildelinger';
	import type { ProgramTildeling } from '$lib/content/tildelinger';
	import { alleProdukter } from '$lib/content/produkter';
	import { hentMineProgrammer, gemAktivtTraeningsprogram } from '$lib/firestore/mineProgrammer';
	import {
		anslaaetVarighedMinutter,
		type CustomProgram
	} from '$lib/content/mineProgrammer';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	const erPremium = $derived(harPremium(userDoc));
	const erAppKunde = $derived(erModulbruger(userDoc));

	let tildelteProgrammer = $state<ProgramTildeling[]>([]);
	let alleProgrammerPaaTvaers = $state<ProgramMedForlob[]>([]);
	let mineProgrammer = $state<CustomProgram[]>([]);
	let harCustomBuilderTildelt = $state(false);
	let indlaeserNyt = $state(false);
	let gemmerAktiv = $state(false);

	const visCustomBuilder = $derived(erAppKunde || harCustomBuilderTildelt);

	type AktivKilde = 'mikrotraening' | 'eget' | 'tildelt';
	const aktivt = $derived(userDoc?.aktivtTraeningsprogram);

	function erAktivt(kilde: AktivKilde, programId?: string, forlobId?: string): boolean {
		if (!aktivt) return kilde === 'mikrotraening';
		if (aktivt.kilde !== kilde) return false;
		if (kilde === 'mikrotraening') return true;
		if (kilde === 'eget') return aktivt.programId === programId;
		return aktivt.programId === programId && aktivt.forlobId === forlobId;
	}

	async function vaelgAktiv(
		kilde: AktivKilde,
		programId?: string,
		forlobId?: string
	) {
		if (!user || gemmerAktiv) return;
		gemmerAktiv = true;
		try {
			await gemAktivtTraeningsprogram(user.uid, {
				kilde,
				...(programId ? { programId } : {}),
				...(forlobId ? { forlobId } : {})
			});
		} catch (e) {
			console.error('Kunne ikke gemme aktivt program:', e);
		} finally {
			gemmerAktiv = false;
		}
	}

	onMount(async () => {
		if (!erPremium || !user || !userDoc) return;
		indlaeserNyt = true;
		try {
			const [tildelinger, allePaaTvaers, mine] = await Promise.all([
				hentTildelingerForBruger(user.uid, userDoc.forlobIds ?? []),
				hentAlleProgrammerPaaTvaers(),
				hentMineProgrammer(user.uid)
			]);
			tildelteProgrammer = tildelinger.programmer;
			harCustomBuilderTildelt = tildelinger.harCustomBuilder;
			alleProgrammerPaaTvaers = allePaaTvaers;
			mineProgrammer = mine;
		} catch (e) {
			console.error('Kunne ikke hente programmer:', e);
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
				Dine træningsprogrammer fra forløbet og dine egne.
			{:else}
				Træningsprogrammer du har adgang til. Vælg det program du vil køre.
			{/if}
		</p>
	</header>

	<div class="program-liste">
		<a
			class="program-row"
			class:aktiv={erAktivt('mikrotraening')}
			href="/app/moduler/traening/mikrotraening"
		>
			<div class="program-icon mikro">
				<Icon name="flame" size={18} color="#fff" />
			</div>
			<div class="program-tekst">
				<div class="program-navn">
					Mikrotræning
					{#if erAktivt('mikrotraening')}
						<span class="aktiv-badge">Aktiv</span>
					{/if}
				</div>
				<div class="program-sub">Daglig træning</div>
			</div>
			{#if !erAktivt('mikrotraening') && erPremium}
				<button
					type="button"
					class="vaelg-knap"
					disabled={gemmerAktiv}
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						vaelgAktiv('mikrotraening');
					}}
				>
					Vælg
				</button>
			{:else}
				<div class="program-pil">
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</div>
			{/if}
		</a>

		{#if erPremium}
			{#if indlaeserNyt}
				<div class="status-rad">Henter dine programmer…</div>
			{:else}
				{#each tildelteProgrammer as t (t.id)}
					{@const info = programInfo(t)}
					<a
						class="program-row"
						class:aktiv={erAktivt('tildelt', t.programId, t.forlobId)}
						href={`/app/moduler/traening/program/${t.forlobId}/${t.programId}`}
					>
						<div class="program-icon">
							<Icon name="flame" size={18} color="#fff" />
						</div>
						<div class="program-tekst">
							<div class="program-navn">
								{info?.program.navn ?? t.programId}
								{#if erAktivt('tildelt', t.programId, t.forlobId)}
									<span class="aktiv-badge">Aktiv</span>
								{/if}
							</div>
							<div class="program-sub">
								{#if info}
									{info.program.antalDage} dage · {info.program.udstyr.join(', ')}
								{:else}
									Fra {forlobNavnFor(t.forlobId)}
								{/if}
							</div>
						</div>
						{#if !erAktivt('tildelt', t.programId, t.forlobId)}
							<button
								type="button"
								class="vaelg-knap"
								disabled={gemmerAktiv}
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									vaelgAktiv('tildelt', t.programId, t.forlobId);
								}}
							>
								Vælg
							</button>
						{:else}
							<div class="program-pil">
								<Icon name="chevron-r" size={14} color="var(--text3)" />
							</div>
						{/if}
					</a>
				{/each}

				{#each mineProgrammer as p (p.id)}
					<a
						class="program-row"
						class:aktiv={erAktivt('eget', p.id)}
						href={`/app/moduler/traening/byg-eget/${p.id}`}
					>
						<div class="program-icon">
							<Icon name="flame" size={18} color="#fff" />
						</div>
						<div class="program-tekst">
							<div class="program-navn">
								{p.navn}
								{#if erAktivt('eget', p.id)}
									<span class="aktiv-badge">Aktiv</span>
								{/if}
							</div>
							<div class="program-sub">
								{p.oevelser.length} øvelser · ca. {anslaaetVarighedMinutter(p)} min · selvbygget
							</div>
						</div>
						{#if !erAktivt('eget', p.id)}
							<button
								type="button"
								class="vaelg-knap"
								disabled={gemmerAktiv}
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									vaelgAktiv('eget', p.id);
								}}
							>
								Vælg
							</button>
						{:else}
							<div class="program-pil">
								<Icon name="chevron-r" size={14} color="var(--text3)" />
							</div>
						{/if}
					</a>
				{/each}
			{/if}
		{/if}
	</div>

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
				<Icon name="chevron-r" size={14} color="#fff" />
			</div>
		</a>
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

	.program-liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		margin-bottom: 14px;
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

	.program-row.aktiv {
		background: var(--tdim);
	}

	.program-row.aktiv:hover {
		background: var(--tdim);
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

	.program-icon.mikro {
		background: #c9a07a;
	}

	.program-tekst {
		flex: 1;
		min-width: 0;
	}

	.program-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.program-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
		line-height: 1.35;
	}

	.aktiv-badge {
		font-size: calc(9.5px * var(--fs-scale, 1));
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 99px;
		font-weight: 600;
		background: var(--terra);
		color: #fff;
	}

	.vaelg-knap {
		flex-shrink: 0;
		padding: 7px 14px;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.vaelg-knap:hover:not(:disabled) {
		background: var(--bg2);
	}

	.vaelg-knap:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.program-pil {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.status-rad {
		padding: 14px;
		text-align: center;
		color: var(--text3);
		font-size: calc(12px * var(--fs-scale, 1));
		border-top: 1px solid var(--border);
	}

	/* Byg-eget — distinkt grøn farve så den skiller sig ud fra program-listen */
	.byg-eget {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 14px;
		background: #6F9E7E;
		border-radius: 14px;
		text-decoration: none;
		color: #fff;
	}

	.byg-eget:hover {
		background: #628a6e;
	}

	.byg-eget-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: rgba(255, 255, 255, 0.2);
	}

	.byg-eget-tekst {
		flex: 1;
		min-width: 0;
	}

	.byg-eget-titel {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		color: #fff;
	}

	.byg-eget-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: rgba(255, 255, 255, 0.85);
		margin-top: 2px;
	}
</style>
