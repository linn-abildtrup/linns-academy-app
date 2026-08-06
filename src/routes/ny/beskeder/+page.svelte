<script lang="ts">
	// ============================================================
	// Beskeder til Linn i 3.0. Kun for kunder paa et forloeb, fordi det
	// ikke kan skaleres til alle medlemmer. Se SPEC-3.0.md afsnit 3.2.
	//
	// Hun skriver, og Linn svarer. Svarene staar i den samme traad, saa
	// hun ikke skal lede efter dem.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import {
		gemSpoergsmaal,
		hentMineSpoergsmaal,
		type KlientSpoergsmaal
	} from '$lib/firestore/spoergsmaal';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');

	const user = $derived(hentUser());
	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	const forlob = $derived(adgang.aktiveForlob[0] ?? null);

	let traade = $state<KlientSpoergsmaal[]>([]);
	let henter = $state(true);
	let tekst = $state('');
	let sender = $state(false);
	let fejl = $state('');
	let sendtLige = $state(false);

	onMount(() => void indlaes());

	async function indlaes() {
		const uid = user?.uid;
		if (!uid) return;
		henter = true;
		try {
			traade = await hentMineSpoergsmaal(uid);
		} catch (e) {
			console.error('[ny] kunne ikke hente beskeder', e);
			fejl = 'Dine beskeder kunne ikke hentes lige nu.';
		} finally {
			henter = false;
		}
	}

	$effect(() => {
		if (user?.uid) void indlaes();
	});

	async function send() {
		const uid = user?.uid;
		const besked = tekst.trim();
		if (!uid || !besked || sender) return;
		sender = true;
		fejl = '';
		try {
			await gemSpoergsmaal({
				uid,
				email: user?.email ?? userDoc?.email ?? '',
				spoergsmaal: besked,
				forlobId: forlob?.forlobId,
				forlobNavn: forlob?.navn
			});
			tekst = '';
			sendtLige = true;
			setTimeout(() => (sendtLige = false), 5000);
			await indlaes();
		} catch (e) {
			console.error('[ny] kunne ikke sende beskeden', e);
			fejl = 'Beskeden kunne ikke sendes. Prøv igen om lidt.';
		} finally {
			sender = false;
		}
	}

	function tid(t: { toDate?: () => Date } | undefined): string {
		const d = t?.toDate?.();
		if (!d) return '';
		return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
	}
</script>

<div class="ny-pad beskeder-side">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<a class="tilbage" href="/ny">‹ Forside</a>
		<h1>Skriv til Linn</h1>
		<p>
			{#if forlob}
				Du får svar inden for et døgn. Det er Linn selv der læser og svarer.
			{:else}
				Beskeder hører til et forløb. Er du på et hold, kan du skrive direkte til Linn her.
			{/if}
		</p>
	</header>

	{#if forlob}
		<section class="kort skriv-kort">
			<textarea
				class="skrivefelt"
				bind:value={tekst}
				placeholder="Skriv til Linn …"
				rows="4"
				disabled={sender}
			></textarea>
			<div class="refleksion-fod">
				{#if sendtLige}
					<span class="gemt">Sendt. Linn kigger på den.</span>
				{:else}
					<span class="privat">Kun Linn kan læse den</span>
				{/if}
				<button class="btn" disabled={sender || tekst.trim().length === 0} onclick={send}>
					{sender ? 'Sender …' : 'Send'}
				</button>
			</div>
		</section>
	{/if}

	{#if fejl}
		<p class="fejl" role="alert">{fejl}</p>
	{/if}

	{#if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter dine beskeder</span>
		</div>
	{:else if traade.length === 0}
		<div class="kort rolig">
			Du har ikke skrevet endnu. Der er ingen spørgsmål der er for små.
		</div>
	{:else}
		<div class="traade">
			{#each traade as t (t.id)}
				<article class="traad">
					<div class="traad-top">
						<span class="traad-dato">{tid(t.oprettet)}</span>
						{#if t.svar}
							<span class="traad-status svaret">Besvaret</span>
						{:else}
							<span class="traad-status venter">Venter på svar</span>
						{/if}
					</div>
					<p class="traad-spm">{t.spoergsmaal}</p>
					{#if t.svar}
						<div class="traad-svar">
							<span class="traad-ava" aria-hidden="true"></span>
							<div>
								<div class="traad-fra">Linn</div>
								<p>{t.svar}</p>
							</div>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</div>
