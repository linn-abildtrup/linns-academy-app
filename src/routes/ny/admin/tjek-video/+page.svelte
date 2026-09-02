<script lang="ts">
	// ============================================================
	// Tjek video. En side der lader telefonen selv fortaelle hvad der gaar
	// galt, i stedet for at vi gaetter videre.
	//
	// BAGGRUND 2. september 2026. Kunder melder om traeningsvideo uden lyd,
	// der hakker eller er sort. Linn har det selv paa én iPhone 12 Pro Max,
	// mens en anden iPhone er fin i samme oejeblik. Lydkontakten,
	// stroemspare-tilstanden, en genstart og Safari uden om ikonet er alle
	// afproevet uden held.
	//
	// DEN VISER BAADE TAL OG BILLEDE. Det afgoerende spoergsmaal er om
	// telefonen TROR den spiller mens skaermen er sort. Derfor koerer
	// testvideoen synligt oeverst, ved siden af tallene: siger siden at
	// den spiller, og er ruden alligevel sort, ligger fejlen i det telefonen
	// tegner, ikke i det den henter.
	//
	// DEN KOERER FOERST UDEN ET TRYK, praecis som traeningsskaermen goer,
	// og kan derefter koeres igen MED et tryk. Er den foerste blokeret og
	// den anden fin, er det browserens regel om at starte af sig selv.
	//
	// Kun admin. Ingen kunde ser den, og den skriver ingenting nogen steder.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { getAudioUrl, getVideoUrl } from '$lib/utils/storage';
	import { hentAlleExercises } from '$lib/firestore/mikrotraening';
	import { medieFejlTekst, mp4Pakning } from '$lib/content/tjekVideo3';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentUser = getContext<() => User | null>('user');
	const user = $derived(hentUser());
	const maaVaereHer = $derived(isAdmin(user));

	type Status = 'ok' | 'fejl' | 'advarsel' | 'info';
	interface Linje {
		navn: string;
		status: Status;
		vaerdi: string;
	}
	interface Afsnit {
		titel: string;
		linjer: Linje[];
	}

	let afsnit = $state<Afsnit[]>([]);
	let koerer = $state(false);
	let medTryk = $state(false);
	let faerdig = $state(false);
	let kopieret = $state(false);
	/** Den video der vises paa skaermen mens testen koerer. */
	let visning = $state<HTMLVideoElement | null>(null);
	let visningUrl = $state('');

	function tal(n: number): string {
		return n.toLocaleString('da-DK', { maximumFractionDigits: 1 });
	}

	/** Venter paa noget, men aldrig for evigt. */
	function medFrist<T>(p: Promise<T>, ms: number, fald: T): Promise<T> {
		return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fald), ms))]);
	}

	async function testTelefonen(): Promise<Afsnit> {
		const linjer: Linje[] = [];
		const ua = navigator.userAgent;
		const ios = /OS (\d+)[_.](\d+)/.exec(ua);
		linjer.push({
			navn: 'Telefon eller computer',
			status: 'info',
			vaerdi: /iPhone/.test(ua)
				? 'iPhone'
				: /iPad/.test(ua)
					? 'iPad'
					: /Android/.test(ua)
						? 'Android'
						: 'Computer'
		});
		linjer.push({
			navn: 'System',
			status: 'info',
			vaerdi: ios ? `iOS ${ios[1]}.${ios[2]}` : ua.slice(0, 60)
		});
		linjer.push({
			navn: 'Åbnet fra',
			status: 'info',
			vaerdi: window.matchMedia('(display-mode: standalone)').matches
				? 'ikonet på hjemmeskærmen'
				: 'browseren'
		});

		// Plads paa telefonen. En telefon der er helt fyldt op kan ikke
		// gemme det den henter, og saa gaar afspilningen i staa.
		try {
			const est = await navigator.storage?.estimate?.();
			if (est?.quota) {
				const ledigMB = (est.quota - (est.usage ?? 0)) / (1024 * 1024);
				linjer.push({
					navn: 'Plads appen må bruge',
					status: ledigMB < 60 ? 'fejl' : ledigMB < 300 ? 'advarsel' : 'ok',
					vaerdi: `${tal(ledigMB)} MB tilbage`
				});
			}
		} catch {
			// Ikke alle browsere svarer paa det. Det er ikke en fejl.
		}
		return { titel: 'Telefonen', linjer };
	}

	async function testFil(navn: string, sti: string, brugTryk: boolean): Promise<Afsnit> {
		const linjer: Linje[] = [];
		let url: string;

		const t0 = performance.now();
		try {
			url = await getVideoUrl(sti);
			linjer.push({
				navn: 'Adressen på filen',
				status: 'ok',
				vaerdi: `hentet på ${tal(performance.now() - t0)} ms`
			});
		} catch (e) {
			linjer.push({
				navn: 'Adressen på filen',
				status: 'fejl',
				vaerdi: `kunne ikke hentes (${e instanceof Error ? e.message : 'ukendt'})`
			});
			return { titel: navn, linjer };
		}

		if (!visningUrl) visningUrl = url;

		// Hentningen. Vi tager hele filen, saa tallet er det samme kunden
		// venter paa naar videoen skal i gang.
		const t1 = performance.now();
		try {
			const res = await fetch(url);
			const buf = await res.arrayBuffer();
			const ms = performance.now() - t1;
			const mb = buf.byteLength / (1024 * 1024);
			const fart = (mb * 8) / (ms / 1000);
			linjer.push({
				navn: 'Filen hentet',
				status: ms > 6000 ? 'fejl' : ms > 2500 ? 'advarsel' : 'ok',
				vaerdi: `${tal(mb)} MB på ${tal(ms)} ms, altså ${tal(fart)} Mbit i sekundet`
			});
			const p = mp4Pakning(buf);
			linjer.push({
				navn: 'Filens pakning',
				status: p === 'bagerst' ? 'advarsel' : 'ok',
				vaerdi:
					p === 'bagerst'
						? 'indholdsfortegnelsen ligger bagerst, hele filen skal hentes før første billede'
						: p === 'forrest'
							? 'indholdsfortegnelsen ligger forrest, som den skal'
							: 'kunne ikke aflæses'
			});
		} catch (e) {
			linjer.push({
				navn: 'Filen hentet',
				status: 'fejl',
				vaerdi: `kunne ikke hentes (${e instanceof Error ? e.message : 'ukendt'})`
			});
		}

		// Selve afspilningen, paa den video der staar synligt paa skaermen.
		const v = visning;
		if (!v) return { titel: navn, linjer };

		v.muted = true;
		v.playsInline = true;
		v.loop = true;
		v.src = url;

		const t2 = performance.now();
		const klar = await medFrist(
			new Promise<boolean>((r) => {
				v.onloadeddata = () => r(true);
				v.onerror = () => r(false);
			}),
			15000,
			false
		);
		linjer.push({
			navn: 'Første billede klar',
			status: klar ? 'ok' : 'fejl',
			vaerdi: klar
				? `efter ${tal(performance.now() - t2)} ms`
				: medieFejlTekst(v.error?.code) || 'kom aldrig, ventede 15 sekunder'
		});

		let blokeret = '';
		try {
			await v.play();
		} catch (e) {
			blokeret = e instanceof Error ? e.name : 'ukendt';
		}
		linjer.push({
			navn: brugTryk ? 'Start med dit tryk' : 'Start af sig selv',
			status: blokeret ? 'fejl' : 'ok',
			vaerdi: blokeret
				? blokeret === 'NotAllowedError'
					? 'browseren sagde nej, den vil ikke starte af sig selv'
					: `afvist (${blokeret})`
				: 'gik i gang'
		});

		// Tikker uret. Det er DET spoergsmaal der skiller en sort skaerm fra
		// en video der slet ikke koerer.
		const foer = v.currentTime;
		await new Promise((r) => setTimeout(r, 1800));
		const rykkede = v.currentTime - foer;
		linjer.push({
			navn: 'Billedet bevæger sig',
			status: rykkede > 0.3 ? 'ok' : 'fejl',
			vaerdi:
				rykkede > 0.3
					? `ja, ${tal(rykkede)} sekunder på under to sekunder`
					: 'nej, uret står stille'
		});
		linjer.push({
			navn: 'Billedets størrelse',
			status: v.videoWidth > 0 ? 'ok' : 'fejl',
			vaerdi:
				v.videoWidth > 0 ? `${v.videoWidth} x ${v.videoHeight}` : 'telefonen fik intet billede'
		});
		return { titel: navn, linjer };
	}

	async function testLyden(brugTryk: boolean): Promise<Afsnit> {
		const linjer: Linje[] = [];
		let url: string;
		try {
			url = await getAudioUrl('baggrundsmusik.mp3');
			linjer.push({ navn: 'Musikfilen', status: 'ok', vaerdi: 'fundet' });
		} catch {
			linjer.push({
				navn: 'Musikfilen',
				status: 'fejl',
				vaerdi: 'kunne ikke hentes, og så er der ingen musik under træningen'
			});
			return { titel: 'Lyden', linjer };
		}

		const a = new Audio(url);
		a.volume = 0.2;
		let blokeret = '';
		try {
			await a.play();
		} catch (e) {
			blokeret = e instanceof Error ? e.name : 'ukendt';
		}
		linjer.push({
			navn: brugTryk ? 'Musik med dit tryk' : 'Musik af sig selv',
			status: blokeret ? 'fejl' : 'ok',
			vaerdi: blokeret
				? blokeret === 'NotAllowedError'
					? 'browseren sagde nej til lyd der starter af sig selv'
					: `afvist (${blokeret})`
				: 'gik i gang'
		});

		await new Promise((r) => setTimeout(r, 1500));
		const rykkede = a.currentTime;
		linjer.push({
			navn: 'Musikken kører',
			status: rykkede > 0.3 ? 'ok' : 'fejl',
			vaerdi: rykkede > 0.3 ? `ja, ${tal(rykkede)} sekunder spillet` : 'nej, den står stille'
		});
		a.pause();

		// DET HER KAN SIDEN IKKE MAALE, og derfor staar det som en linje man
		// skal svare paa selv. Kontakten paa siden af en iPhone slaar al lyd
		// fra paa en hjemmeside, mens alt andet ser helt rigtigt ud herinde.
		linjer.push({
			navn: 'Hørte du musikken',
			status: 'info',
			vaerdi:
				rykkede > 0.3
					? 'den spillede. Hørte du intet, er telefonen på lydløs'
					: 'den kom ikke i gang'
		});
		return { titel: 'Lyden', linjer };
	}

	async function koer(brugTryk: boolean) {
		if (koerer) return;
		koerer = true;
		medTryk = brugTryk;
		faerdig = false;
		kopieret = false;
		afsnit = [];
		try {
			afsnit = [await testTelefonen()];

			// To rigtige oevelsesvideoer, dem kunderne faktisk ser.
			const alle = await hentAlleExercises().catch(() => []);
			const stier = alle
				.map((e) => e.videoPath)
				.filter((s): s is string => !!s?.trim())
				.slice(0, 2);

			if (stier.length === 0) {
				afsnit = [
					...afsnit,
					{
						titel: 'Videoerne',
						linjer: [{ navn: 'Øvelser', status: 'fejl', vaerdi: 'kunne ikke hentes fra databasen' }]
					}
				];
			}
			for (const [i, sti] of stier.entries()) {
				afsnit = [...afsnit, await testFil(`Video ${i + 1}: ${sti}`, sti, brugTryk)];
			}
			afsnit = [...afsnit, await testLyden(brugTryk)];
		} catch (e) {
			console.error('[tjek-video] testen gik i staa', e);
			afsnit = [
				...afsnit,
				{
					titel: 'Testen',
					linjer: [
						{
							navn: 'Gik i stå',
							status: 'fejl',
							vaerdi: e instanceof Error ? e.message : 'ukendt fejl'
						}
					]
				}
			];
		} finally {
			koerer = false;
			faerdig = true;
		}
	}

	// FOERSTE KOERSEL SKER UDEN ET TRYK, praecis som traeningsskaermen. Er
	// den blokeret her og fin naar man trykker, er svaret fundet.
	onMount(() => {
		if (maaVaereHer) void koer(false);
	});

	function somTekst(): string {
		return afsnit
			.map((a) => `${a.titel}\n${a.linjer.map((l) => `  ${l.navn}: ${l.vaerdi}`).join('\n')}`)
			.join('\n\n');
	}

	async function kopier() {
		try {
			await navigator.clipboard.writeText(somTekst());
			kopieret = true;
		} catch {
			kopieret = false;
		}
	}
</script>

<svelte:head><title>Tjek video · Admin</title></svelte:head>

{#if !maaVaereHer}
	<p class="tv-kun">Siden er kun for admin.</p>
{:else}
	<AdmSide
		titel="Tjek video"
		under="Åbn siden på den telefon der driller. Den prøver at afspille en rigtig øvelsesvideo og skriver hvad telefonen svarer."
	>
		<AdmKort>
			<div class="tv-ramme">
				<!-- Videoen staar synligt, saa I kan sammenligne det I SER med
				     det tallene siger. Er ruden sort mens linjen nedenfor
				     siger at billedet bevaeger sig, ligger fejlen i det
				     telefonen tegner. -->
				<video bind:this={visning} class="tv-video" muted playsinline loop></video>
			</div>
			<p class="tv-under">
				Ser du billeder i ruden? Sammenlign det med linjen "Billedet bevæger sig" nedenfor.
			</p>

			<div class="tv-knapper">
				<AdmKnap slags="primaer" disabled={koerer} onclick={() => koer(true)}>
					{koerer ? 'Tjekker…' : 'Kør testen igen med mit tryk'}
				</AdmKnap>
				{#if faerdig}
					<AdmKnap onclick={kopier}>{kopieret ? 'Kopieret' : 'Kopier resultatet'}</AdmKnap>
				{/if}
			</div>
			<p class="tv-under">
				{medTryk
					? 'Sidste kørsel blev startet af dit tryk.'
					: 'Sidste kørsel startede af sig selv, ligesom træningsskærmen gør.'}
			</p>
		</AdmKort>

		{#if koerer && afsnit.length === 0}
			<AdmTom tekst="Tjekker telefonen…" />
		{/if}

		{#each afsnit as a (a.titel)}
			<AdmKort>
				<h2 class="tv-titel">{a.titel}</h2>
				{#each a.linjer as l (l.navn)}
					<div class="tv-linje">
						<span class="tv-navn">{l.navn}</span>
						<span class="tv-vaerdi {l.status}">{l.vaerdi}</span>
					</div>
				{/each}
			</AdmKort>
		{/each}
	</AdmSide>
{/if}

<style>
	.tv-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.tv-ramme {
		border-radius: 14px;
		overflow: hidden;
		background: #211b1e;
	}

	.tv-video {
		display: block;
		width: 100%;
		max-height: 240px;
		object-fit: contain;
		background: #211b1e;
	}

	.tv-under {
		margin: 10px 0 0;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-3, #a3948a);
		line-height: 1.5;
	}

	.tv-knapper {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 12px;
	}

	.tv-titel {
		margin: 0 0 10px;
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.tv-linje {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 0;
		border-top: 1px solid var(--line, #e8dfd1);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.tv-linje:first-of-type {
		border-top: 0;
	}

	.tv-navn {
		color: var(--ink-2, #6f5f57);
		flex-shrink: 0;
	}

	.tv-vaerdi {
		text-align: right;
		font-weight: 600;
	}

	.tv-vaerdi.ok {
		color: var(--sage-tekst, #46603f);
	}

	.tv-vaerdi.fejl {
		color: var(--ler-tekst, #8a5439);
	}

	.tv-vaerdi.advarsel {
		color: var(--honey-deep, #b47f3e);
	}

	.tv-vaerdi.info {
		color: var(--espresso, #382c2a);
		font-weight: 500;
	}
</style>
