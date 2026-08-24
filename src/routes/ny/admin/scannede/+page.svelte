<script lang="ts">
	// ============================================================
	// Admin: de varer kunderne har scannet, og noedbremsen.
	//
	// Linns regel 24. august: HUN GODKENDER IKKE. En scannet vare er
	// delt fra det sekund den er scannet. Skulle hun godkende foerst,
	// ville en kunde staa og vente paa hende midt i sin morgenmad.
	//
	// Siden findes kun saa hun kan FJERNE igen hvis noget ser galt ud.
	// Derfor staar de varer hvor tallene ikke haenger sammen markeret,
	// saa hun kan noejes med at kigge paa dem.
	//
	// Se HANDOVER-3.0.md 9.51 og mockups-scan-vare.html afsnit 5.
	// Intet menupunkt, skriv adressen. Samme loesning som challenges.
	// ============================================================

	import { getContext } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { hentScannedeVarer3, fjernScanning } from '$lib/firestore/scannedeVarer3';
	import { tjekNaering } from '$lib/content/openFoodFacts';
	import type { Vare3 } from '$lib/content/fodevareKilde3';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const admin = $derived(isAdmin(user));

	let varer = $state<Vare3[]>([]);
	let henter = $state(true);
	let soeg = $state('');
	let fjerner = $state<string | null>(null);

	$effect(() => {
		if (!admin) return;
		let afbrudt = false;
		(async () => {
			const liste = await hentScannedeVarer3();
			if (!afbrudt) {
				varer = liste.filter((v) => !(v as { fjernet?: boolean }).fjernet);
				henter = false;
			}
		})();
		return () => {
			afbrudt = true;
		};
	});

	/** Tallene der ikke haenger sammen. Det er dem hun skal kigge paa. */
	function skaev(v: Vare3): boolean {
		return !tjekNaering({ kcal: v.kcal, protein: v.p, fiber: v.f, kh: v.kh, fedt: v.fedt }).ok;
	}

	const vist = $derived.by(() => {
		const q = soeg.trim().toLowerCase();
		const liste = q
			? varer.filter((v) => v.name.toLowerCase().includes(q) || (v.barcode ?? '').includes(q))
			: varer;
		// De skaeve oeverst. Resten efter navn.
		return [...liste].sort((a, b) => {
			const sa = skaev(a) ? 0 : 1;
			const sb = skaev(b) ? 0 : 1;
			if (sa !== sb) return sa - sb;
			return a.name.localeCompare(b.name, 'da');
		});
	});

	const antalSkaeve = $derived(varer.filter(skaev).length);

	async function fjern(v: Vare3) {
		if (!confirm(`Fjern "${v.name}" fra søgningen? Den bliver stående i de måltider hvor den er brugt.`))
			return;
		fjerner = v.id;
		try {
			await fjernScanning(v.id);
			varer = varer.filter((x) => x.id !== v.id);
		} finally {
			fjerner = null;
		}
	}

	function tal(x: number | null | undefined): string {
		if (x === null || x === undefined) return '—';
		return String(Math.round(x * 10) / 10).replace('.', ',');
	}
</script>

<div class="ny-pad sc-side">
	{#if !admin}
		<p class="sc-tom">Siden er kun for admin.</p>
	{:else}
		<h1 class="sc-h">Scannede varer</h1>
		<p class="sc-p">
			Kunderne har fotograferet varedeklarationen, og varerne er delt med alle med det
			samme. <b>Du godkender ikke, du fjerner.</b> Fjerner du en, forsvinder den fra
			søgningen hos alle, men bliver stående i de måltider hvor den er brugt.
		</p>

		{#if henter}
			<p class="sc-tom">Henter …</p>
		{:else if varer.length === 0}
			<p class="sc-tom">Ingen kunder har scannet en vare endnu.</p>
		{:else}
			<div class="sc-tael">
				<span><b>{varer.length}</b> varer</span>
				{#if antalSkaeve > 0}
					<span class="sc-advarsel"><b>{antalSkaeve}</b> hvor tallene ikke hænger sammen</span>
				{/if}
			</div>
			<input
				class="sc-soeg"
				type="search"
				bind:value={soeg}
				placeholder="Søg efter navn eller stregkode"
				aria-label="Søg"
			/>

			<div class="sc-liste">
				{#each vist as v (v.id)}
					<article class="sc-vare" class:skaev={skaev(v)}>
						<div class="sc-t">
							<div class="sc-navn">{v.name}</div>
							<div class="sc-tal">
								{tal(v.p)} g protein · {tal(v.f)} g fiber · {tal(v.kcal)} kcal pr 100 g
								{#if (v as { fiberUkendt?: boolean }).fiberUkendt}
									<span class="sc-mrk">fiber stod ikke på pakken</span>
								{/if}
							</div>
							<div class="sc-meta">
								{#if v.barcode}{v.barcode} · {/if}
								scannet {new Date((v as { scannetDen?: string }).scannetDen ?? '').toLocaleDateString('da-DK') || 'ukendt dato'}
							</div>
							{#if skaev(v)}
								<div class="sc-advarsel-linje">
									Tallene hænger ikke sammen. Se dem efter mod pakken.
								</div>
							{/if}
						</div>
						<button
							type="button"
							class="sc-fjern"
							disabled={fjerner === v.id}
							onclick={() => fjern(v)}
						>
							{fjerner === v.id ? 'Fjerner …' : 'Fjern'}
						</button>
					</article>
				{/each}
			</div>
		{/if}
	{/if}
</div>
