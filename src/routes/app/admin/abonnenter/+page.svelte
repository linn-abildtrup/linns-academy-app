<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import { hentAbonnentAllowedEmails } from '$lib/firestore/forlob';
	import type { AllowedEmail } from '$lib/content/forlobAdgang';
	import type { UserDoc } from '$lib/types';
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';

	type RowData = {
		allowed: AllowedEmail;
		userDoc: UserDoc | null;
		uid: string | null;
	};

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	let rows = $state<RowData[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let filter = $state<'alle' | 'basis' | 'premium' | 'kun-aktive'>('alle');
	let soegeord = $state('');
	let aabnetEmail = $state<string | null>(null);

	// State til "Ny kode"-flow
	let bekraeftEmail = $state<string | null>(null);
	let bekraeftNavn = $state<string>('');
	let opretter = $state(false);
	let opretFejl = $state<string | null>(null);
	let tempPassword = $state<string | null>(null);
	let tempNavn = $state<string>('');
	let kopieret = $state(false);

	async function startNyKode(email: string, navn: string) {
		bekraeftEmail = email;
		bekraeftNavn = navn;
		opretFejl = null;
	}

	function annullerBekraeft() {
		bekraeftEmail = null;
		bekraeftNavn = '';
		opretFejl = null;
	}

	async function bekraeftNyKode() {
		const u = user;
		const email = bekraeftEmail;
		if (!u || !email || opretter) return;
		opretter = true;
		opretFejl = null;
		try {
			const idToken = await u.getIdToken(true);
			const res = await fetch('/api/admin/set-temp-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${idToken}`
				},
				body: JSON.stringify({ email })
			});
			if (!res.ok) {
				const errBody = await res.text();
				let melding = 'Kunne ikke sætte ny adgangskode.';
				try {
					const parsed = JSON.parse(errBody);
					if (parsed.message) melding = parsed.message;
				} catch {
					if (errBody) melding = errBody;
				}
				opretFejl = melding;
				return;
			}
			const data = (await res.json()) as { tempPassword: string };
			tempPassword = data.tempPassword;
			tempNavn = bekraeftNavn || email;
			bekraeftEmail = null;
			bekraeftNavn = '';
		} catch (e) {
			console.error(e);
			opretFejl = 'Kunne ikke kontakte serveren. Prøv igen.';
		} finally {
			opretter = false;
		}
	}

	async function kopierKode() {
		if (!tempPassword) return;
		try {
			await navigator.clipboard.writeText(tempPassword);
			kopieret = true;
			setTimeout(() => (kopieret = false), 2000);
		} catch (e) {
			console.warn('Clipboard fejlede:', e);
		}
	}

	function lukKodeModal() {
		tempPassword = null;
		tempNavn = '';
		kopieret = false;
	}

	onMount(async () => {
		try {
			const allowed = await hentAbonnentAllowedEmails();

			// Forsøg at hente users-collection — vi har brug for matching userDoc
			// for at vise UID + bonusPeriodEndsAt. Hvis rules forhindrer det (admin
			// har ikke read på alle users), fortsætter vi med kun allowedEmail-data.
			const docsByEmail = new Map<string, { uid: string; data: UserDoc }>();
			try {
				const usersSnap = await getDocs(collection(db, 'users'));
				for (const d of usersSnap.docs) {
					const data = d.data() as UserDoc;
					if (data.email) docsByEmail.set(data.email.toLowerCase(), { uid: d.id, data });
				}
			} catch (userFejl) {
				console.warn('Kunne ikke hente users-collection (rules?):', userFejl);
			}

			rows = allowed.map((a) => {
				const match = docsByEmail.get(a.email.toLowerCase());
				return {
					allowed: a,
					userDoc: match?.data ?? null,
					uid: match?.uid ?? null
				};
			});
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente abonnenter.';
		} finally {
			loading = false;
		}
	});

	const filtreret = $derived.by(() => {
		const q = soegeord.trim().toLowerCase();
		return rows.filter((r) => {
			const a = r.allowed;
			if (filter === 'basis' && a.accessLevel !== 'basis') return false;
			if (filter === 'premium' && a.accessLevel !== 'premium') return false;
			if (filter === 'kun-aktive' && !a.activeSubscription) return false;
			if (!q) return true;
			const fornavn = (r.userDoc?.firstName ?? a.firstName ?? '').toLowerCase();
			const efternavn = (a.lastName ?? '').toLowerCase();
			return a.email.toLowerCase().includes(q) || fornavn.includes(q) || efternavn.includes(q);
		});
	});

	const aktiveBasis = $derived(
		rows.filter((r) => r.allowed.accessLevel === 'basis' && r.allowed.activeSubscription).length
	);
	const aktivePremium = $derived(
		rows.filter((r) => r.allowed.accessLevel === 'premium' && r.allowed.activeSubscription).length
	);

	function visDato(ts?: number | null): string {
		if (!ts) return '—';
		const d = new Date(ts);
		return d.toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	function produktLabel(a: AllowedEmail): string {
		const map: Record<string, string> = {
			basisabo: 'Basis-abo',
			premiumabo: 'Premium-abo',
			kickstart: 'Kickstart',
			premiumforløb: 'Kropsro'
		};
		return a.activeProduct ? (map[a.activeProduct] ?? a.activeProduct) : '—';
	}

	function fuldtNavn(r: RowData): string {
		const f = r.userDoc?.firstName ?? r.allowed.firstName ?? '';
		const l = r.allowed.lastName ?? '';
		const samlet = [f, l].filter(Boolean).join(' ');
		return samlet || '(uden navn)';
	}

	function toggleDetaljer(email: string) {
		aabnetEmail = aabnetEmail === email ? null : email;
	}
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin</div>
		<h1>Abonnenter</h1>
		<p class="page-sub">
			Brugere med basis- eller premium-abonnement fra Simplero. Klik et kort for at
			se hele kunde-profilen.
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter abonnenter..." />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		<div class="kpi-rad">
			<div class="kpi">
				<div class="kpi-tal">{aktiveBasis}</div>
				<div class="kpi-lbl">Aktive basis</div>
			</div>
			<div class="kpi">
				<div class="kpi-tal">{aktivePremium}</div>
				<div class="kpi-lbl">Aktive premium</div>
			</div>
			<div class="kpi">
				<div class="kpi-tal">{rows.length}</div>
				<div class="kpi-lbl">I alt</div>
			</div>
		</div>

		<input
			type="search"
			class="search"
			placeholder="Søg på navn eller email…"
			bind:value={soegeord}
		/>

		<div class="chips">
			{#each [{ id: 'alle' as const, l: 'Alle' }, { id: 'kun-aktive' as const, l: 'Kun aktive' }, { id: 'basis' as const, l: 'Basis' }, { id: 'premium' as const, l: 'Premium' }] as f (f.id)}
				<button
					type="button"
					class="chip"
					class:aktiv={filter === f.id}
					onclick={() => (filter = f.id)}
				>
					{f.l}
				</button>
			{/each}
		</div>

		{#if filtreret.length === 0}
			<div class="status-besked">Ingen abonnenter matcher søgningen.</div>
		{:else}
			<div class="liste">
				{#each filtreret as r (r.allowed.email)}
					{@const a = r.allowed}
					{@const u = r.userDoc}
					{@const erAaben = aabnetEmail === a.email}
					<button
						class="kort"
						type="button"
						onclick={() => toggleDetaljer(a.email)}
						aria-expanded={erAaben}
					>
						<div class="kort-top">
							<div class="kort-tekst">
								<div class="kort-navn">{fuldtNavn(r)}</div>
								<div class="kort-email">{a.email}</div>
							</div>
							<span
								class="badge"
								class:badge-aktiv={a.activeSubscription}
								class:badge-inaktiv={!a.activeSubscription}
								title={a.activeSubscription
									? 'Simplero rapporterer at abonnementet stadig løber'
									: 'Simplero rapporterer at abonnementet er stoppet'}
							>
								{a.activeSubscription ? 'Betaler' : 'Stoppet'}
							</span>
						</div>
						<div class="kort-meta">
							<span class="meta-tag" class:tag-premium={a.accessLevel === 'premium'}>
								{produktLabel(a)}
							</span>
							<span>
								{r.uid || a.status === 'registered' ? 'Tilmeldt ✓' : 'Ikke logget ind'}
							</span>
						</div>
					</button>

					{#if erAaben}
						<div class="detaljer">
							<div class="detalje-grid">
								<div class="detalje">
									<div class="detalje-lbl">Email</div>
									<div class="detalje-val">{a.email}</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Navn</div>
									<div class="detalje-val">{fuldtNavn(r)}</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Produkt</div>
									<div class="detalje-val">{produktLabel(a)}</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Adgangsniveau</div>
									<div class="detalje-val">{a.accessLevel ?? '—'}</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Abonnement</div>
									<div class="detalje-val">
										{a.activeSubscription ? 'Aktivt' : 'Stoppet'}
									</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Tilmeldt appen</div>
									<div class="detalje-val">
										{r.uid || a.status === 'registered' ? 'Ja' : 'Nej (kun whitelisted)'}
									</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Udløber</div>
									<div class="detalje-val">{visDato(a.expiresAt ?? u?.expiresAt)}</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Bibliotek-bonus indtil</div>
									<div class="detalje-val">{visDato(u?.bonusPeriodEndsAt)}</div>
								</div>
								{#if a.simpleroCustomerId}
									<div class="detalje detalje-fuld">
										<div class="detalje-lbl">Simplero customer-id</div>
										<div class="detalje-val mono">{a.simpleroCustomerId}</div>
									</div>
								{/if}
								{#if r.uid}
									<div class="detalje detalje-fuld">
										<div class="detalje-lbl">Firebase Auth UID</div>
										<div class="detalje-val mono">{r.uid}</div>
									</div>
								{/if}
							</div>
							{#if r.uid}
								<div class="detalje-handlinger">
									<button
										class="ny-kode-knap"
										type="button"
										onclick={() => startNyKode(a.email, fuldtNavn(r))}
									>
										🔑 Sæt ny midlertidig adgangskode
									</button>
								</div>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	{/if}
</div>

<svelte:window
	onkeydown={(e) => {
		if (e.key !== 'Escape') return;
		if (tempPassword) lukKodeModal();
		else if (bekraeftEmail) annullerBekraeft();
	}}
/>

{#if bekraeftEmail}
	<div class="modal-overlay" role="presentation" onclick={annullerBekraeft}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="bekraeft-titel"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 id="bekraeft-titel" class="modal-titel">Sæt midlertidig adgangskode?</h2>
			<p class="modal-tekst">
				Der oprettes en ny midlertidig adgangskode for
				<strong>{bekraeftEmail}</strong>.
			</p>
			<p class="modal-tekst">
				Hendes nuværende kode bliver overskrevet. Du får den nye kode vist på skærmen
				og skal sende den til hende manuelt (fx Messenger eller SMS).
			</p>
			<p class="modal-tekst muted">
				Hun bør skifte koden under <em>Profil → Skift adgangskode</em> så snart hun er
				logget ind.
			</p>
			{#if opretFejl}
				<div class="modal-fejl">{opretFejl}</div>
			{/if}
			<div class="modal-knapper">
				<button class="modal-knap ghost" type="button" onclick={annullerBekraeft} disabled={opretter}>
					Annullér
				</button>
				<button class="modal-knap primary" type="button" onclick={bekraeftNyKode} disabled={opretter}>
					{opretter ? 'Opretter…' : 'Generér ny kode'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if tempPassword}
	<div class="modal-overlay" role="presentation" onclick={lukKodeModal}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="kode-titel"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 id="kode-titel" class="modal-titel">Midlertidig adgangskode oprettet 🔑</h2>
			<p class="modal-tekst">Send denne kode til <strong>{tempNavn}</strong> via Messenger eller SMS:</p>

			<div class="kode-kort">
				<div class="kode-label">Midlertidig kode</div>
				<div class="kode-vaerdi">{tempPassword}</div>
				<button class="kopier-knap" type="button" onclick={kopierKode}>
					{kopieret ? '✓ Kopieret!' : '📋 Kopiér kode'}
				</button>
			</div>

			<div class="instruktioner-titel">Husk at fortælle hende:</div>
			<ul class="instruktioner">
				<li>Log ind med denne kode på <strong>app.linnsacademy.dk</strong></li>
				<li>Gå derefter til Profil → Skift adgangskode og lav sin egen kode</li>
				<li>Den midlertidige kode bør ikke gemmes nogen steder</li>
			</ul>

			<div class="modal-knapper">
				<button class="modal-knap primary" type="button" onclick={lukKodeModal}>Luk</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 16px 18px 80px;
	}
	.page-header {
		margin-bottom: 18px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--text2);
		font-size: calc(12px * var(--fs-scale, 1));
		text-decoration: none;
		margin-bottom: 8px;
	}
	.eyebrow {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
	}
	h1 {
		font-family: var(--ff-d);
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 4px 0 6px;
	}
	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.4;
	}
	.kpi-rad {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 14px;
	}
	.kpi {
		padding: 10px 12px;
		background: var(--bg2);
		border-radius: 12px;
		text-align: center;
	}
	.kpi-tal {
		font-family: var(--ff-d);
		font-size: calc(20px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}
	.kpi-lbl {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}
	.search {
		width: 100%;
		padding: 11px 14px;
		font-size: calc(16px * var(--fs-scale, 1));
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--bg2);
		color: var(--text);
		font-family: var(--ff-b);
		outline: none;
		margin-bottom: 10px;
	}
	.chips {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 14px;
	}
	.chip {
		padding: 6px 12px;
		font-size: calc(12px * var(--fs-scale, 1));
		border-radius: 99px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-family: var(--ff-b);
		cursor: pointer;
	}
	.chip.aktiv {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}
	.liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.kort {
		display: block;
		width: 100%;
		text-align: left;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		font-family: inherit;
	}
	.kort:hover {
		background: var(--bg2);
	}
	.kort-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 4px;
	}
	.kort-tekst {
		min-width: 0;
		flex: 1;
	}
	.kort-navn {
		font-family: var(--ff-b);
		font-weight: 600;
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text);
	}
	.kort-email {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-top: 1px;
	}
	.badge {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 3px 8px;
		border-radius: 99px;
		flex-shrink: 0;
	}
	.badge-aktiv {
		background: #eef5ef;
		color: #406a4e;
	}
	.badge-inaktiv {
		background: var(--bg2);
		color: var(--text3);
	}
	.kort-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
	}
	.meta-tag {
		padding: 2px 8px;
		border-radius: 99px;
		background: var(--bg2);
		color: var(--text2);
		font-weight: 500;
	}
	.tag-premium {
		background: rgba(157, 99, 88, 0.12);
		color: var(--terra);
	}
	.detaljer {
		margin-top: -4px;
		margin-bottom: 4px;
		padding: 14px 16px;
		background: var(--bg2);
		border: 1px solid var(--border);
		border-top: none;
		border-radius: 0 0 12px 12px;
	}
	.detalje-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.detalje-fuld {
		grid-column: 1 / -1;
	}
	.detalje-lbl {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 2px;
	}
	.detalje-val {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text);
	}
	.detalje-val.mono {
		font-family: 'SF Mono', Menlo, monospace;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text2);
	}
	.status-besked {
		padding: 12px 14px;
		background: var(--bg2);
		border-radius: 10px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
	}
	.status-besked.fejl {
		background: #fbeeea;
		color: #8a4a3e;
	}

	.detalje-handlinger {
		display: flex;
		justify-content: flex-end;
		margin-top: 12px;
	}

	.ny-kode-knap {
		padding: 10px 14px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		border-radius: 10px;
		border: 1px solid var(--terra);
		background: var(--white);
		color: var(--terra);
		cursor: pointer;
	}

	.ny-kode-knap:hover {
		background: var(--terra);
		color: #fff;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px;
		z-index: 100;
	}

	.modal {
		background: var(--white);
		border-radius: 14px;
		padding: 22px;
		max-width: 460px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}

	.modal-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		margin: 0 0 12px;
		color: var(--text);
	}

	.modal-tekst {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0 0 10px;
	}

	.modal-tekst.muted {
		color: var(--text3);
	}

	.modal-fejl {
		padding: 10px 14px;
		background: #fbeeea;
		color: #8a4a3e;
		border-radius: 8px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		margin: 10px 0;
	}

	.modal-knapper {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
		margin-top: 16px;
	}

	.modal-knap {
		padding: 11px 16px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		border-radius: 10px;
		cursor: pointer;
		border: 1px solid var(--border);
	}

	.modal-knap.ghost {
		background: var(--white);
		color: var(--text2);
	}

	.modal-knap.primary {
		background: var(--terra);
		color: #fff;
		border-color: var(--terra);
	}

	.modal-knap:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.kode-kort {
		background: var(--bg2);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px;
		margin: 14px 0;
		text-align: center;
	}

	.kode-label {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 8px;
	}

	.kode-vaerdi {
		font-family: 'SF Mono', Menlo, monospace;
		font-size: calc(22px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.05em;
		color: var(--terra);
		user-select: all;
		margin-bottom: 12px;
		word-break: break-all;
	}

	.kopier-knap {
		padding: 9px 16px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		border-radius: 8px;
		background: var(--terra);
		color: #fff;
		border: none;
		cursor: pointer;
	}

	.instruktioner-titel {
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-top: 14px;
		margin-bottom: 6px;
	}

	.instruktioner {
		list-style: disc inside;
		padding: 0;
		margin: 0 0 8px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.6;
	}
</style>
