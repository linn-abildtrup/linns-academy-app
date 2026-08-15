<script lang="ts">
	// ============================================================
	// Profil i 3.0. Kun den del der har et hjem nu: hvem hun er, hvor
	// laenge hun har vaeret med, og de forloeb hun har gennemfoert.
	//
	// Diplomerne bor her, fordi de fyldte for meget i forsidens hoved.
	// Resten af siden bygges i etape 5, se SPEC-3.0.md afsnit 7.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import { isAdmin } from '$lib/admin';
	import { formatMedlemstid, type Adgangsbillede } from '$lib/content/adgang3';
	import {
		rensUdstyr3,
		udstyrFra,
		udstyrTekst3,
		type TraeningKategori3
	} from '$lib/content/traeningKategori3';
	import { hentKategorier3 } from '$lib/firestore/traeningKategori3';

	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const hentUser = getContext<() => User | null>('user');

	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());
	// Vejen ind i 3.0's admin. Kun for admin, saa ingen kunde ser den.
	const visAdmin = $derived(isAdmin(hentUser()));

	// Kategorierne hentes for at kunne skrive hendes valg med ord. Fejler
	// det, staar der bare ingenting paa linjen. Profilen skal ikke gaa i
	// staa fordi en undertekst ikke kunne hentes.
	let kategorier = $state<TraeningKategori3[]>([]);
	const udstyrTekst = $derived(
		kategorier.length === 0
			? 'Vælg det udstyr du har'
			: udstyrTekst3(rensUdstyr3(udstyrFra(userDoc), kategorier), kategorier)
	);

	onMount(async () => {
		try {
			kategorier = await hentKategorier3();
		} catch (e) {
			console.warn('[ny] kunne ikke hente traeningskategorier', e);
		}
	});

	const navn = $derived(
		[userDoc?.firstName, userDoc?.lastName].filter(Boolean).join(' ') || 'Din konto'
	);
	const medlemstid = $derived(formatMedlemstid(adgang.medlemstidMs));

	const MAANEDER = [
		'januar',
		'februar',
		'marts',
		'april',
		'maj',
		'juni',
		'juli',
		'august',
		'september',
		'oktober',
		'november',
		'december'
	];

	function gennemfoertTekst(slutMs: number): string {
		const d = new Date(slutMs);
		return `Gennemført ${MAANEDER[d.getMonth()]} ${d.getFullYear()}`;
	}
</script>

<div class="ny-pad profil-side">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<h1>Din konto</h1>
	</header>

	<section class="profil-hoved">
		<span class="linn-ava" role="img" aria-label={navn}></span>
		<div>
			<div class="profil-navn">{navn}</div>
			{#if medlemstid}
				<span class="status medlem" style="margin-top:6px">
					<span class="prik" aria-hidden="true"></span>
					Medlem i {medlemstid}
				</span>
			{/if}
		</div>
	</section>

	{#if adgang.gennemfoerte.length}
		<section>
			<div class="lab"><h2>Det du har gennemført</h2></div>
			<div class="diplom-liste">
				{#each adgang.gennemfoerte as d (d.forlobId)}
					<div class="diplom-stor">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M12 2.6l2.7 5.8 6.3.8-4.6 4.4 1.2 6.2L12 16.7l-5.6 3.1 1.2-6.2L3 9.2l6.3-.8z" />
						</svg>
						<div>
							<div class="t">{d.navn}</div>
							<div class="s">{gennemfoertTekst(d.slutMs)}</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section>
		<div class="lab"><h2>Træning</h2></div>
		<a class="adm-raekke tr-raekke" href="/ny/profil/traening">
			<div class="adm-raekke-t"><span>Sådan træner jeg</span></div>
			<div class="adm-raekke-s">{udstyrTekst}</div>
		</a>
	</section>

	{#if visAdmin}
		<section>
			<div class="lab"><h2>Admin</h2></div>
			<a class="adm-raekke tr-raekke" href="/ny/admin">
				<div class="adm-raekke-t"><span>Værktøjerne i den nye app</span></div>
				<div class="adm-raekke-s">Træning, mad og challenges</div>
			</a>
		</section>
	{/if}

	<p class="kort rolig">Resten af din profil kommer her. Siden er ikke bygget færdig endnu.</p>
</div>
