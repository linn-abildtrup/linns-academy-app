<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import { hentAbonnentAllowedEmails } from '$lib/firestore/forlob';
	import type { AllowedEmail } from '$lib/content/forlobAdgang';
	import type { UserDoc } from '$lib/types';
	import { collection, getDocs, query, where } from 'firebase/firestore';
	import { auth, db } from '$lib/firebase';
	import { sendPasswordResetEmail } from 'firebase/auth';

	type RowData = {
		allowed: AllowedEmail;
		userDoc: UserDoc | null;
		uid: string | null;
	};

	let rows = $state<RowData[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let filter = $state<'alle' | 'basis' | 'premium' | 'kun-aktive'>('alle');
	let soegeord = $state('');
	let aabnetEmail = $state<string | null>(null);
	let resetTilstand = $state<Record<string, 'sender' | 'ok' | 'fejl' | null>>({});

	onMount(async () => {
		try {
			const allowed = await hentAbonnentAllowedEmails();
			// Hent userDoc for hver email via where-query (allowedEmail har ikke uid).
			const usersSnap = await getDocs(collection(db, 'users'));
			const docsByEmail = new Map<string, { uid: string; data: UserDoc }>();
			for (const d of usersSnap.docs) {
				const data = d.data() as UserDoc;
				if (data.email) docsByEmail.set(data.email.toLowerCase(), { uid: d.id, data });
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
			const u = r.userDoc;
			if (filter === 'basis' && a.accessLevel !== 'basis') return false;
			if (filter === 'premium' && a.accessLevel !== 'premium') return false;
			if (filter === 'kun-aktive' && !a.activeSubscription) return false;
			if (!q) return true;
			const navn = (u?.firstName ?? a.firstName ?? '').toLowerCase();
			const efternavn = (a.lastName ?? '').toLowerCase();
			return a.email.toLowerCase().includes(q) || navn.includes(q) || efternavn.includes(q);
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
		return d.toLocaleString('da-DK', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function visDatoKort(ts?: number | null): string {
		if (!ts) return '—';
		const d = new Date(ts);
		return d.toLocaleDateString('da-DK', { day: '2-digit', month: 'short', year: '2-digit' });
	}

	function produktLabel(a: AllowedEmail): string {
		const map: Record<string, string> = {
			basisabo: 'Basis-abo',
			premiumabo: 'Premium-abo',
			kickstart: 'Kickstart',
			premiumforløb: 'Premium-forløb'
		};
		return a.activeProduct ? (map[a.activeProduct] ?? a.activeProduct) : '—';
	}

	function fuldtNavn(r: RowData): string {
		const f = r.userDoc?.firstName ?? r.allowed.firstName ?? '';
		const l = r.allowed.lastName ?? '';
		const samlet = [f, l].filter(Boolean).join(' ');
		return samlet || '(uden navn)';
	}

	async function sendReset(email: string) {
		resetTilstand = { ...resetTilstand, [email]: 'sender' };
		try {
			await sendPasswordResetEmail(auth, email);
			resetTilstand = { ...resetTilstand, [email]: 'ok' };
			setTimeout(() => {
				resetTilstand = { ...resetTilstand, [email]: null };
			}, 4000);
		} catch (e) {
			console.error(e);
			resetTilstand = { ...resetTilstand, [email]: 'fejl' };
		}
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
			se hele kunde-profilen og nulstille password.
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
					{@const resetStatus = resetTilstand[a.email]}
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
							>
								{a.activeSubscription ? 'Aktiv' : 'Stoppet'}
							</span>
						</div>
						<div class="kort-meta">
							<span class="meta-tag" class:tag-premium={a.accessLevel === 'premium'}>
								{produktLabel(a)}
							</span>
							<span>
								{a.status === 'registered' ? 'Tilmeldt ✓' : 'Ikke logget ind'}
							</span>
							{#if u?.lastLoginAt}
								<span>· Sidst aktiv {visDatoKort(u.lastLoginAt)}</span>
							{/if}
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
										{a.activeSubscription ? 'Aktivt' : 'Ikke aktivt'}
									</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Whitelisted</div>
									<div class="detalje-val">Ja (i allowedEmails)</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Tilmeldt appen</div>
									<div class="detalje-val">
										{a.status === 'registered' ? 'Ja' : 'Nej (ikke logget ind endnu)'}
									</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Oprettet</div>
									<div class="detalje-val">{visDato(u?.createdAt)}</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Seneste login</div>
									<div class="detalje-val">{visDato(u?.lastLoginAt)}</div>
								</div>
								<div class="detalje">
									<div class="detalje-lbl">Udløber</div>
									<div class="detalje-val">{visDato(a.expiresAt ?? u?.expiresAt)}</div>
								</div>
								{#if u?.bonusPeriodEndsAt}
									<div class="detalje">
										<div class="detalje-lbl">Bibliotek-bonus indtil</div>
										<div class="detalje-val">{visDato(u.bonusPeriodEndsAt)}</div>
									</div>
								{/if}
								{#if u?.forlobIds && u.forlobIds.length > 0}
									<div class="detalje detalje-fuld">
										<div class="detalje-lbl">Tidligere forløb</div>
										<div class="detalje-val">{u.forlobIds.join(', ')}</div>
									</div>
								{/if}
								{#if a.simpleroCustomerId}
									<div class="detalje detalje-fuld">
										<div class="detalje-lbl">Simplero-id</div>
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

							<div class="handling">
								<button
									class="primary-knap"
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										sendReset(a.email);
									}}
									disabled={resetStatus === 'sender'}
								>
									{#if resetStatus === 'sender'}
										Sender reset-mail…
									{:else if resetStatus === 'ok'}
										✓ Reset-mail sendt til {a.email}
									{:else if resetStatus === 'fejl'}
										✗ Kunne ikke sende — prøv igen
									{:else}
										Send password-reset-mail
									{/if}
								</button>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	{/if}
</div>

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
		margin-bottom: 14px;
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
	.handling {
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
	.primary-knap {
		width: 100%;
		padding: 12px;
		background: var(--terra);
		color: #fff;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-family: var(--ff-b);
	}
	.primary-knap:disabled {
		opacity: 0.7;
		cursor: wait;
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
</style>
