<script lang="ts">
	import { onMount } from 'svelte';
	import { arrayRemove, arrayUnion, collection, doc, getDocs, updateDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { klientSoegeMatch } from '$lib/utils/klientSoegning';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import BekraeftModal from '$lib/components/BekraeftModal.svelte';
	import { TEST_FEATURES } from '$lib/content/testFeatures';
	import type { UserDoc } from '$lib/types';

	type BrugerRow = {
		uid: string;
		email: string;
		firstName: string;
		lastName: string;
		testerFeatures: string[];
	};

	let brugere = $state<BrugerRow[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let arbejder = $state<string | null>(null); // "uid:feature" key

	// Pop-up til at tilføje en tester til en specifik feature
	let valgtFeature = $state<string | null>(null);
	let tilfoejSoeg = $state('');

	// Fjern-bekræftelse
	let fjernModal = $state<{ uid: string; feature: string; email: string } | null>(null);

	onMount(async () => {
		try {
			const snap = await getDocs(collection(db, 'users'));
			brugere = snap.docs
				.map((d) => {
					const data = d.data() as UserDoc;
					return {
						uid: d.id,
						email: data.email ?? '',
						firstName: data.firstName ?? '',
						lastName: (data as UserDoc & { lastName?: string }).lastName ?? '',
						testerFeatures: data.testerFeatures ?? []
					};
				})
				.sort((a, b) => (a.firstName || a.email).localeCompare(b.firstName || b.email, 'da'));
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente brugere.';
		} finally {
			loading = false;
		}
	});

	function navnFor(b: BrugerRow): string {
		const fulde = `${b.firstName} ${b.lastName}`.trim();
		return fulde || b.email || '(uden navn)';
	}

	function testereFor(feature: string): BrugerRow[] {
		return brugere.filter((b) => b.testerFeatures.includes(feature));
	}

	async function tilfoejTester(uid: string, feature: string) {
		const key = `${uid}:${feature}`;
		if (arbejder === key) return;
		arbejder = key;
		try {
			await updateDoc(doc(db, 'users', uid), {
				testerFeatures: arrayUnion(feature)
			});
			brugere = brugere.map((b) =>
				b.uid === uid ? { ...b, testerFeatures: [...b.testerFeatures, feature] } : b
			);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke tilføje tester.';
		} finally {
			arbejder = null;
		}
	}

	function aabnFjernBekraeft(uid: string, feature: string, email: string) {
		fjernModal = { uid, feature, email };
	}

	async function fjernTester() {
		const f = fjernModal;
		if (!f) return;
		const key = `${f.uid}:${f.feature}`;
		arbejder = key;
		try {
			await updateDoc(doc(db, 'users', f.uid), {
				testerFeatures: arrayRemove(f.feature)
			});
			brugere = brugere.map((b) =>
				b.uid === f.uid
					? { ...b, testerFeatures: b.testerFeatures.filter((x) => x !== f.feature) }
					: b
			);
			fjernModal = null;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke fjerne tester.';
		} finally {
			arbejder = null;
		}
	}

	const matchendeBrugere = $derived.by(() => {
		const feat = valgtFeature;
		if (!tilfoejSoeg.trim() || !feat) return [];
		return brugere
			.filter((b) => !b.testerFeatures.includes(feat))
			.filter((b) => klientSoegeMatch(`${b.firstName} ${b.lastName} ${b.email}`, tilfoejSoeg))
			.slice(0, 20);
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin · Testere</div>
		<h1>Tester-adgang</h1>
		<p class="page-sub">
			Giv specifikke kunder adgang til funktioner under udvikling. Når funktionen er klar til alle,
			fjernes adgangs-tjekken fra koden — listen her bevares til næste test-runde.
		</p>
	</header>

	{#if loading}
		<Loading tekst="Henter brugere…" kompakt />
	{:else if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else}
		{#each TEST_FEATURES as f (f.key)}
			{@const testere = testereFor(f.key)}
			<section class="feature-card">
				<div class="feature-head">
					<div>
						<div class="feature-navn">
							{f.navn}
							{#if f.udrullet}
								<span class="badge-udrullet">Udrullet</span>
							{/if}
						</div>
						<div class="feature-key">{f.key}</div>
					</div>
					<button
						type="button"
						class="primary-knap tilfoej-knap"
						onclick={() => {
							valgtFeature = f.key;
							tilfoejSoeg = '';
						}}
					>
						+ Tilføj tester
					</button>
				</div>
				<p class="feature-beskrivelse">{f.beskrivelse}</p>

				{#if testere.length === 0}
					<div class="tom">Ingen testere endnu.</div>
				{:else}
					<div class="tester-liste">
						{#each testere as b (b.uid)}
							<div class="tester-row">
								<div class="tester-tekst">
									<div class="tester-navn">{navnFor(b)}</div>
									<div class="tester-email">{b.email}</div>
								</div>
								<button
									type="button"
									class="fjern-knap"
									onclick={() => aabnFjernBekraeft(b.uid, f.key, b.email)}
									disabled={arbejder === `${b.uid}:${f.key}`}
									title="Fjern tester-adgang"
								>
									<Icon name="trash" size={14} color="currentColor" />
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/each}

		{#if TEST_FEATURES.length === 0}
			<div class="status-besked">
				Ingen test-features defineret endnu. Tilføj dem i
				<code>src/lib/content/testFeatures.ts</code>.
			</div>
		{/if}

		<section class="info-card">
			<div class="info-titel">Sådan virker det</div>
			<ol class="info-liste">
				<li>Tilføj en feature-key i <code>src/lib/content/testFeatures.ts</code></li>
				<li>
					Tjek <code>harTestAdgang(userDoc, 'din-feature-key')</code> i koden hvor funktionen vises
				</li>
				<li>Tildel test-adgang til kunder her på siden</li>
				<li>Når den er klar: fjern <code>harTestAdgang</code>-tjekken fra koden</li>
			</ol>
		</section>
	{/if}
</div>

{#if valgtFeature}
	<div
		class="modal-bag"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) valgtFeature = null;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') valgtFeature = null;
		}}
		tabindex="-1"
	>
		<div class="modal">
			<div class="modal-head">
				<div class="modal-titel">Tilføj tester</div>
				<button
					class="modal-luk"
					type="button"
					onclick={() => (valgtFeature = null)}
					aria-label="Luk">×</button
				>
			</div>
			<p class="modal-sub">
				Søg efter en kunde og giv hende test-adgang til <strong>{valgtFeature}</strong>.
			</p>
			<input
				type="search"
				class="soeg-input"
				placeholder="Søg på navn eller email…"
				bind:value={tilfoejSoeg}
			/>
			<div class="match-liste">
				{#if tilfoejSoeg.trim() === ''}
					<div class="tom">Skriv mindst ét tegn for at søge.</div>
				{:else if matchendeBrugere.length === 0}
					<div class="tom">Ingen kunder matcher (eller de er allerede testere).</div>
				{:else}
					{#each matchendeBrugere as b (b.uid)}
						<button
							type="button"
							class="match-row"
							onclick={() => {
								void tilfoejTester(b.uid, valgtFeature ?? '');
								valgtFeature = null;
							}}
						>
							<div class="match-navn">{navnFor(b)}</div>
							<div class="match-email">{b.email}</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if fjernModal}
	<BekraeftModal
		titel="Fjern tester-adgang?"
		beskrivelse={fjernModal.email +
			' mister adgang til funktionen og ser den ikke længere i appen.'}
		bekraeftTekst="Fjern"
		destruktiv
		arbejder={arbejder === `${fjernModal.uid}:${fjernModal.feature}`}
		onBekraeft={() => void fjernTester()}
		onAnnuller={() => (fjernModal = null)}
	/>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 640px;
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

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(26px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.5;
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.feature-card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.feature-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 6px;
	}

	.feature-navn {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.feature-key {
		font-family: monospace;
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.feature-beskrivelse {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0 0 12px;
		line-height: 1.4;
	}

	.badge-udrullet {
		display: inline-block;
		margin-left: 6px;
		padding: 2px 8px;
		background: #7fa37b;
		color: #fff;
		border-radius: 99px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 600;
		vertical-align: middle;
		letter-spacing: 0.04em;
	}

	.tilfoej-knap {
		flex-shrink: 0;
		width: auto;
		padding: 8px 14px;
		font-size: calc(12px * var(--fs-scale, 1));
		border-radius: 99px;
		background: var(--terra);
		color: #fff;
		border: none;
		font-family: var(--ff-b);
		font-weight: 600;
		cursor: pointer;
	}

	.tom {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		font-style: italic;
		padding: 8px 0;
	}

	.tester-liste {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.tester-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--bg2);
		border-radius: 10px;
	}

	.tester-tekst {
		flex: 1;
		min-width: 0;
	}

	.tester-navn {
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.tester-email {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.fjern-knap {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: #2a1f17;
		color: #fff;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.fjern-knap:hover:not(:disabled) {
		background: #4a3a2d;
	}

	.fjern-knap:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.info-card {
		background: var(--bg2);
		border-radius: 12px;
		padding: 14px 16px;
		margin-top: 18px;
	}

	.info-titel {
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text3);
		margin-bottom: 8px;
	}

	.info-liste {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.6;
		padding-left: 20px;
		margin: 0;
	}

	.info-liste code {
		background: var(--white);
		padding: 1px 6px;
		border-radius: 4px;
		font-size: 0.95em;
	}

	/* Tilføj-modal */
	.modal-bag {
		position: fixed;
		inset: 0;
		z-index: 700;
		background: rgba(42, 31, 23, 0.55);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	@media (min-width: 600px) {
		.modal-bag {
			align-items: center;
		}
	}

	.modal {
		width: 100%;
		max-width: 520px;
		max-height: 80dvh;
		background: var(--bg, #f6f3ee);
		border-radius: 18px 18px 0 0;
		padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow: hidden;
	}

	@media (min-width: 600px) {
		.modal {
			border-radius: 18px;
		}
	}

	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.modal-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.modal-luk {
		background: none;
		border: none;
		font-size: 26px;
		color: var(--text3);
		cursor: pointer;
		line-height: 1;
		padding: 4px 8px;
	}

	.modal-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0;
	}

	.soeg-input {
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: var(--white);
		font-family: var(--ff-b);
		font-size: max(16px, calc(14px * var(--fs-scale, 1)));
		color: var(--text);
		outline: none;
	}

	.soeg-input:focus {
		border-color: var(--terra);
	}

	.match-liste {
		display: flex;
		flex-direction: column;
		gap: 4px;
		overflow-y: auto;
		min-height: 0;
		flex: 1;
	}

	.match-row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 10px 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		font-family: var(--ff-b);
		text-align: left;
	}

	.match-row:hover {
		border-color: var(--terra);
	}

	.match-navn {
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.match-email {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
	}
</style>
