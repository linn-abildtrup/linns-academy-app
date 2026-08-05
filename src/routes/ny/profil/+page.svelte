<script lang="ts">
	// ============================================================
	// Profil i 3.0. Kun den del der har et hjem nu: hvem hun er, hvor
	// laenge hun har vaeret med, og de forloeb hun har gennemfoert.
	//
	// Diplomerne bor her, fordi de fyldte for meget i forsidens hoved.
	// Resten af siden bygges i etape 5, se SPEC-3.0.md afsnit 7.
	// ============================================================

	import { getContext } from 'svelte';
	import type { UserDoc } from '$lib/types';
	import { formatMedlemstid, type Adgangsbillede } from '$lib/content/adgang3';

	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');

	const userDoc = $derived(hentUserDoc());
	const adgang = $derived(hentAdgang());

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

	<p class="kort rolig">Resten af din profil kommer her. Siden er ikke bygget færdig endnu.</p>
</div>
