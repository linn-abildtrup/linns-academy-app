<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { signOut } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import { getKoebForUser, formatUdlobsdato } from '$lib/content/koeb';
	import type { TrainingProgram, UserProduct } from '$lib/content/mikrotraening';
	import {
		gemProgramValg,
		hentForlobsProgrammer,
		hentUserProduct
	} from '$lib/firestore/mikrotraening';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');

	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc());

	// Mikrotræning-program-valg
	let mtProgrammer = $state<TrainingProgram[]>([]);
	let valgtMtProgramId = $state<string | null>(null);
	let mtIndlaeser = $state(false);
	let mtFejl = $state<string | null>(null);
	let mtGemmer = $state<string | null>(null);

	function ikonForUdstyr(udstyr: string[]): IconName {
		if (udstyr.includes('kettlebell')) return 'kettlebell';
		if (udstyr.includes('haandvaegte')) return 'kettlebell';
		return 'stretch';
	}

	onMount(async () => {
		const u = user;
		if (!u) return;
		mtIndlaeser = true;
		try {
			const up = await hentUserProduct(u.uid, 'kickstart');
			if (!up) return;
			const forlobId = (up as UserProduct & { forlobId?: string }).forlobId;
			if (!forlobId) return;
			const alle = await hentForlobsProgrammer(forlobId);
			mtProgrammer = alle.filter((p) => p.aktiv);
			valgtMtProgramId = up.programValg?.mikrotraening ?? null;
		} catch (e) {
			console.error('Kunne ikke hente mikrotræning-programmer:', e);
		} finally {
			mtIndlaeser = false;
		}
	});

	async function vaelgMtProgram(programId: string) {
		const u = user;
		if (!u || mtGemmer || valgtMtProgramId === programId) return;
		mtGemmer = programId;
		mtFejl = null;
		try {
			await gemProgramValg(u.uid, 'kickstart', 'mikrotraening', programId);
			valgtMtProgramId = programId;
		} catch (e) {
			console.error(e);
			mtFejl = 'Kunne ikke skifte program. Prøv igen.';
		} finally {
			mtGemmer = null;
		}
	}

	const initial = $derived((userDoc?.firstName ?? '?').charAt(0).toUpperCase());

	const statusTekst = $derived.by(() => {
		const state = userDoc?.state;
		if (state === 'forlobskunde') {
			return 'Du er på Kickstart en sund overgangsalder';
		}
		if (state === 'modulbruger') {
			return 'Du har adgang til Linn\u2019s Academy';
		}
		if (state === 'udlobet') {
			return 'Din adgang er udløbet';
		}
		return '';
	});

	const koeb = $derived(userDoc?.state ? getKoebForUser(userDoc.state) : []);

	async function handleLogout() {
		try {
			await signOut(auth);
			await goto('/login');
		} catch (err) {
			console.error('Log ud fejlede', err);
		}
	}

	function statusLabel(status: string): string {
		if (status === 'aktiv') return 'Aktiv';
		if (status === 'laeseadgang') return 'Læseadgang';
		return 'Udløbet';
	}

	function metaTekst(k: { lobende: boolean; udlobsdato?: string; status: string }): string {
		if (k.status === 'laeseadgang' && k.udlobsdato) {
			return 'Læseadgang til ' + formatUdlobsdato(k.udlobsdato);
		}
		if (k.status === 'laeseadgang') {
			return 'Læseadgang, ingen tracking';
		}
		if (k.lobende) {
			return 'Løbende adgang';
		}
		if (k.udlobsdato) {
			return 'Adgang til ' + formatUdlobsdato(k.udlobsdato);
		}
		return '';
	}
</script>

<div class="profil">
	<header class="header">
		<div class="avatar" aria-hidden="true">{initial}</div>
		<h1 class="navn">{userDoc?.firstName ?? ''}</h1>
		<p class="email">{user?.email ?? ''}</p>
	</header>

	{#if statusTekst}
		<section class="status-card">
			<p class="card-label">Status</p>
			<p class="card-text">{statusTekst}</p>
		</section>
	{/if}

	{#if koeb.length > 0}
		<section class="sektion">
			<h2 class="sektion-titel">Mine køb</h2>
			<ul class="koeb-liste">
				{#each koeb as k (k.id)}
					<li class="koeb" class:koeb-laeseadgang={k.status === 'laeseadgang'}>
						<div class="koeb-info">
							<span class="koeb-navn">{k.navn}</span>
							<span class="koeb-meta">{metaTekst(k)}</span>
						</div>
						<span class="badge" class:badge-laeseadgang={k.status === 'laeseadgang'}>
							{statusLabel(k.status)}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if mtProgrammer.length > 0}
		<section class="sektion">
			<h2 class="sektion-titel">Mikrotræning — program</h2>
			<p class="sektion-sub">
				Vælg om du træner med eller uden udstyr. Dit program opdateres med det samme.
			</p>
			{#if mtFejl}
				<div class="status-besked fejl">{mtFejl}</div>
			{/if}
			<div class="program-liste">
				{#each mtProgrammer as p (p.id)}
					{@const aktiv = valgtMtProgramId === p.id}
					{@const gemmerDenne = mtGemmer === p.id}
					<button
						class="program-knap"
						class:aktiv
						type="button"
						onclick={() => vaelgMtProgram(p.id)}
						disabled={mtGemmer !== null}
					>
						<span class="program-ikon" class:aktiv>
							<Icon name={ikonForUdstyr(p.udstyr)} size={18} />
						</span>
						<span class="program-tekst">
							<span class="program-navn">{p.navn}</span>
							{#if p.beskrivelse}
								<span class="program-sub">{p.beskrivelse}</span>
							{/if}
						</span>
						<span class="program-status">
							{#if gemmerDenne}
								<span class="program-gemmer">Gemmer...</span>
							{:else if aktiv}
								<Icon name="check" size={18} color="var(--sage, #6f9e7e)" />
							{/if}
						</span>
					</button>
				{/each}
			</div>
		</section>
	{:else if mtIndlaeser}
		<section class="sektion">
			<h2 class="sektion-titel">Mikrotræning — program</h2>
			<div class="status-besked">Henter dine programvalg...</div>
		</section>
	{/if}

	<section class="sektion">
		<h2 class="sektion-titel">Hjælp</h2>
		<div class="hjaelp">
			Skriv til <a href="mailto:kontakt@linnsacademy.dk">kontakt@linnsacademy.dk</a>
		</div>
	</section>

	<button class="logout" onclick={handleLogout}>Log ud</button>
</div>

<style>
	.profil {
		padding: 0 20px 32px;
		max-width: 480px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
	}

	.header {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 32px 16px 24px;
	}

	.avatar {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: var(--terra);
		color: var(--white);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Playfair Display', Georgia, serif;
		font-size: 32px;
		font-weight: 500;
		margin-bottom: 14px;
	}

	.navn {
		font-size: 22px;
		font-weight: 500;
		color: var(--text);
		margin: 0;
	}

	.email {
		font-size: 13px;
		color: var(--text3);
		margin: 4px 0 0;
	}

	.status-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px 18px;
		margin-bottom: 12px;
	}

	.card-label {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
		margin: 0 0 4px;
	}

	.card-text {
		font-size: 15px;
		color: var(--text);
		margin: 0;
	}

	.sektion {
		margin-top: 20px;
	}

	.sektion-titel {
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
		margin: 0 4px 8px;
		letter-spacing: 0.02em;
	}

	.koeb-liste {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.koeb {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px 14px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.koeb-laeseadgang {
		opacity: 0.75;
	}

	.koeb-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.koeb-navn {
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
	}

	.koeb-meta {
		font-size: 12px;
		color: var(--text3);
		margin-top: 2px;
	}

	.badge {
		font-size: 10px;
		font-weight: 500;
		padding: 4px 9px;
		border-radius: 10px;
		background: #e8f0e9;
		color: #4a7050;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	.badge-laeseadgang {
		background: #f1ede8;
		color: #8a7480;
	}

	.sektion-sub {
		font-size: 12px;
		color: var(--text3);
		margin: 0 4px 10px;
		line-height: 1.5;
	}

	.status-besked {
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: 13px;
		color: var(--text2);
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
		margin-bottom: 8px;
	}

	.program-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.program-knap {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		font-family: var(--ff-b);
		text-align: left;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.program-knap:hover:not(:disabled) {
		border-color: var(--terra);
	}

	.program-knap.aktiv {
		border-color: var(--sage, #6f9e7e);
		background: var(--sdim, #f0f5f1);
	}

	.program-knap:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.program-ikon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bg2);
		color: var(--terra);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.program-ikon.aktiv {
		background: var(--white);
		color: var(--sage, #6f9e7e);
	}

	.program-tekst {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.program-navn {
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
	}

	.program-sub {
		font-size: 12px;
		color: var(--text3);
		margin-top: 2px;
	}

	.program-status {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
	}

	.program-gemmer {
		font-size: 11px;
		color: var(--terra);
		font-weight: 500;
	}

	.hjaelp {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px 14px;
		font-size: 13px;
		color: var(--text);
	}

	.hjaelp a {
		color: var(--terra);
		text-decoration: none;
	}

	.hjaelp a:hover {
		text-decoration: underline;
	}

	.logout {
		display: block;
		width: 100%;
		padding: 13px;
		margin-top: 24px;
		background: transparent;
		border: 1px solid var(--border2, var(--border));
		border-radius: 10px;
		color: var(--text3);
		font-size: 13px;
		font-family: inherit;
		text-align: center;
		cursor: pointer;
	}

	.logout:hover {
		color: var(--text);
		border-color: var(--text4, var(--text3));
	}
</style>
