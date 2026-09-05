<script lang="ts">
	// ============================================================
	// Testere, i det nye design.
	//
	// Ellevte af de 19 gamle admin-sider, 1. september 2026, og den FOERSTE
	// af dem der roerer en kundes adgang.
	//
	// DEN HER SIDE GIVER OG TAGER ADGANG. Et flueben her afgoer om en
	// kunde kan se noget der er under udvikling, og 'ny-app' er det der
	// lukker hende ind i hele 3.0. Derfor:
	//  - der bekraeftes foer noget fjernes, paa selve raekken
	//  - der staar HVAD en feature goer, og ikke kun hvad den hedder
	//  - 'ny-app' er markeret saerskilt, for den er den stoerste af dem
	//
	// LOGIKKEN ER FLYTTET, IKKE SKREVET OM. Samme arrayUnion og
	// arrayRemove paa users/{uid}.testerFeatures som den gamle side.
	//
	// Den gamle side paa /app/admin/testere er uroert og staar stadig i
	// menuen under System, indtil den her har vaeret brugt.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { arrayRemove, arrayUnion, collection, doc, getDocs, updateDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import { TEST_FEATURES } from '$lib/content/testFeatures';
	import type { UserDoc } from '$lib/types';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmMaerkat from '$lib/components/admin/AdmMaerkat.svelte';
	import AdmSoeg from '$lib/components/admin/AdmSoeg.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentUser()));

	type Bruger = {
		uid: string;
		email: string;
		fornavn: string;
		efternavn: string;
		features: string[];
	};

	let brugere = $state<Bruger[]>([]);
	let henter = $state(true);
	let fejl = $state('');
	let besked = $state('');
	let arbejder = $state('');

	/** Hvilken feature der er foldet ud og soeges i. */
	let aabenFeature = $state('');
	let soeg = $state('');
	/** "uid:feature" der bekraeftes fjernet. */
	let fjerner = $state('');

	onMount(() => void indlaes());

	async function indlaes() {
		henter = true;
		fejl = '';
		try {
			const snap = await getDocs(collection(db, 'users'));
			brugere = snap.docs
				.map((d) => {
					const x = d.data() as UserDoc & { lastName?: string };
					return {
						uid: d.id,
						email: x.email ?? '',
						fornavn: x.firstName ?? '',
						efternavn: x.lastName ?? '',
						features: x.testerFeatures ?? []
					};
				})
				.sort((a, b) => (a.fornavn || a.email).localeCompare(b.fornavn || b.email, 'da'));
		} catch (e) {
			console.error('[admin] testere', e);
			fejl = 'Kunne ikke hente kunderne.';
		} finally {
			henter = false;
		}
	}

	function sigTil(t: string) {
		besked = t;
		setTimeout(() => {
			if (besked === t) besked = '';
		}, 2600);
	}

	function navnFor(b: Bruger): string {
		return `${b.fornavn} ${b.efternavn}`.trim() || b.email || '(uden navn)';
	}

	function testereFor(f: string): Bruger[] {
		return brugere.filter((b) => b.features.includes(f));
	}

	const traeffer = $derived.by<Bruger[]>(() => {
		if (!aabenFeature || !soeg.trim()) return [];
		return brugere
			.filter((b) => !b.features.includes(aabenFeature))
			.filter((b) => klientSoegeMatch(`${b.fornavn} ${b.efternavn} ${b.email}`, soeg))
			.slice(0, 12);
	});

	async function tilfoej(uid: string, feature: string) {
		const key = `${uid}:${feature}`;
		if (arbejder === key) return;
		arbejder = key;
		try {
			await updateDoc(doc(db, 'users', uid), { testerFeatures: arrayUnion(feature) });
			brugere = brugere.map((b) =>
				b.uid === uid ? { ...b, features: [...b.features, feature] } : b
			);
			soeg = '';
			sigTil('Adgangen er givet');
		} catch (e) {
			console.error('[admin] tilføj tester', e);
			fejl = 'Kunne ikke give adgang.';
		} finally {
			arbejder = '';
		}
	}

	async function fjern(uid: string, feature: string) {
		const key = `${uid}:${feature}`;
		arbejder = key;
		try {
			await updateDoc(doc(db, 'users', uid), { testerFeatures: arrayRemove(feature) });
			brugere = brugere.map((b) =>
				b.uid === uid ? { ...b, features: b.features.filter((x) => x !== feature) } : b
			);
			fjerner = '';
			sigTil('Adgangen er fjernet');
		} catch (e) {
			console.error('[admin] fjern tester', e);
			fejl = 'Kunne ikke fjerne adgangen.';
		} finally {
			arbejder = '';
		}
	}
</script>

<svelte:head><title>Testere · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="te-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Testere"
		under="Giv enkelte kunder adgang til noget der er under udvikling, uanset hvad funktions-skemaet siger."
		bred
	>
		{#snippet handling()}
			<AdmKnap onclick={indlaes}>Hent igen</AdmKnap>
		{/snippet}

		{#if besked}<div class="te-besked">{besked}</div>{/if}
		{#if fejl}<div class="te-fejl">{fejl}</div>{/if}

		{#if henter}
			<AdmTom tekst="Henter kunderne…" />
		{:else if fejl && brugere.length === 0}
			<AdmTom tekst={fejl} fejl>
				{#snippet handling()}
					<AdmKnap onclick={indlaes}>Prøv igen</AdmKnap>
				{/snippet}
			</AdmTom>
		{:else}
			<p class="te-antal">{brugere.length} kunder i alt</p>

			{#each TEST_FEATURES as f (f.key)}
				{@const paa = testereFor(f.key)}
				<AdmKort>
					<div class="te-hoved">
						<div>
							<span class="te-navn">{f.navn}</span>
							{#if f.key === 'ny-app'}
								<!-- Den her er ikke som de andre. Den lukker kunden ind i
								     HELE den nye app, ikke bare én funktion. -->
								<AdmMaerkat farve="ro">Giver adgang til hele den nye app</AdmMaerkat>
							{/if}
						</div>
						<span class="te-tal">{paa.length}</span>
					</div>

					<p class="te-besk">{f.beskrivelse}</p>

					{#if paa.length === 0}
						<p class="te-ingen">Ingen har adgang til den endnu.</p>
					{:else}
						<div class="te-liste">
							{#each paa as b (b.uid)}
								<div class="te-raekke">
									<div class="te-r-tekst">
										<span class="te-r-navn">{navnFor(b)}</span>
										<span class="te-r-mail">{b.email}</span>
									</div>
									{#if fjerner === `${b.uid}:${f.key}`}
										<span class="te-advarsel">Hun mister adgangen med det samme.</span>
										<AdmKnap
											slags="fare"
											disabled={arbejder === `${b.uid}:${f.key}`}
											onclick={() => fjern(b.uid, f.key)}
										>
											{arbejder === `${b.uid}:${f.key}` ? 'Fjerner…' : 'Ja, fjern'}
										</AdmKnap>
										<AdmKnap onclick={() => (fjerner = '')}>Fortryd</AdmKnap>
									{:else}
										<AdmKnap slags="fare" onclick={() => (fjerner = `${b.uid}:${f.key}`)}>
											Fjern
										</AdmKnap>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if aabenFeature === f.key}
						<div class="te-tilfoej">
							<AdmSoeg bind:vaerdi={soeg} placeholder="Søg efter navn eller mail…" />
							{#if soeg.trim() && traeffer.length === 0}
								<p class="te-ingen">Ingen kunder matcher, eller de har den allerede.</p>
							{/if}
							{#each traeffer as b (b.uid)}
								<div class="te-raekke">
									<div class="te-r-tekst">
										<span class="te-r-navn">{navnFor(b)}</span>
										<span class="te-r-mail">{b.email}</span>
									</div>
									<AdmKnap
										slags="primaer"
										disabled={arbejder === `${b.uid}:${f.key}`}
										onclick={() => tilfoej(b.uid, f.key)}
									>
										{arbejder === `${b.uid}:${f.key}` ? 'Giver…' : 'Giv adgang'}
									</AdmKnap>
								</div>
							{/each}
							<div class="te-knapper">
								<AdmKnap
									onclick={() => {
										aabenFeature = '';
										soeg = '';
									}}>Luk</AdmKnap
								>
							</div>
						</div>
					{:else}
						<div class="te-knapper">
							<AdmKnap
								onclick={() => {
									aabenFeature = f.key;
									soeg = '';
								}}>Giv en kunde adgang</AdmKnap
							>
						</div>
					{/if}
				</AdmKort>
			{/each}
		{/if}
	</AdmSide>
{/if}

<style>
	.te-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
	}

	.te-besked,
	.te-fejl {
		margin-bottom: 12px;
		padding: 11px 15px;
		border-radius: 12px;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.te-besked {
		background: var(--sage-tint, #e7efe5);
		color: var(--sage-tekst, #46603f);
	}

	.te-fejl {
		background: var(--ler-tint, #f4e6de);
		color: var(--ler-tekst, #8a5439);
	}

	.te-antal {
		margin: 0 0 12px;
		font-size: calc(12px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.te-hoved {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 5px;
	}

	.te-navn {
		font-size: calc(15px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		margin-right: 8px;
	}

	.te-tal {
		flex-shrink: 0;
		font-size: calc(19px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
		color: var(--plum, #7c4f63);
	}

	.te-besk {
		margin: 0 0 12px;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-2, #6f5f57);
		line-height: 1.5;
	}

	.te-ingen {
		margin: 0 0 10px;
		font-size: calc(12.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.te-liste {
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-bottom: 10px;
	}

	.te-raekke {
		display: flex;
		align-items: center;
		gap: 9px;
		flex-wrap: wrap;
		padding: 10px 13px;
		background: var(--paper, #fbf8f2);
		border-radius: 11px;
	}

	.te-r-tekst {
		flex: 1 1 180px;
		min-width: 0;
	}

	.te-r-navn {
		display: block;
		font-size: calc(13.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-weight: 600;
	}

	.te-r-mail {
		display: block;
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ink-3, #a3948a);
	}

	.te-advarsel {
		font-size: calc(11.5px * var(--fs-scale, 1) * var(--adm-skala, 1));
		color: var(--ler-tekst, #8a5439);
		font-weight: 600;
	}

	.te-tilfoej {
		margin-top: 4px;
		padding: 12px;
		background: var(--paper, #fbf8f2);
		border-radius: 12px;
	}

	.te-tilfoej :global(.asg) {
		margin-bottom: 10px;
	}

	.te-knapper {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 8px;
	}
</style>
