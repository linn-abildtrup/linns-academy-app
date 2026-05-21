<script lang="ts">
	import { onMount } from 'svelte';
	import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import Icon from '$lib/components/Icon.svelte';
	import { alleProdukter } from '$lib/content/produkter';

	type Kunde = {
		uid: string;
		email: string;
		firstName: string;
		lastName: string;
		forlobIds: string[];
	};

	type Forlob = {
		id: string;
		navn: string;
		antalDeltagere: number;
	};

	let alleKunder = $state<Kunde[]>([]);
	let alleForlob = $state<Forlob[]>([]);
	let indlaeser = $state(true);
	let soeg = $state('');

	const forlobProdukter = alleProdukter().filter((p) => p.forlobId);

	const matches = $derived.by<Kunde[]>(() => {
		const q = soeg.trim().toLowerCase();
		if (q.length < 2) return [];
		return alleKunder
			.filter((k) => {
				const fuldt = `${k.firstName} ${k.lastName}`.trim().toLowerCase();
				return (
					k.email.toLowerCase().includes(q) ||
					k.firstName.toLowerCase().includes(q) ||
					k.lastName.toLowerCase().includes(q) ||
					fuldt.includes(q)
				);
			})
			.slice(0, 30);
	});

	onMount(async () => {
		try {
			// Hent alle kunder med uid (dem der har logget ind mindst én gang)
			const usersSnap = await getDocs(collection(db, 'users'));
			const kunder: Kunde[] = usersSnap.docs.map((d) => {
				const data = d.data() as {
					email?: string;
					firstName?: string;
					lastName?: string;
					forlobIds?: string[];
				};
				return {
					uid: d.id,
					email: (data.email ?? '').toLowerCase(),
					firstName: data.firstName ?? '',
					lastName: data.lastName ?? '',
					forlobIds: data.forlobIds ?? []
				};
			});
			alleKunder = kunder.sort((a, b) =>
				(a.firstName || a.email).localeCompare(b.firstName || b.email, 'da')
			);

			// Hent forløb fra produkter.ts (single source of truth) + tæl deltagere
			const forlobs: Forlob[] = [];
			for (const p of forlobProdukter) {
				if (!p.forlobId) continue;
				const forlobDoc = await getDoc(doc(db, 'forlob', p.forlobId));
				const navn = forlobDoc.exists()
					? ((forlobDoc.data() as { navn?: string }).navn ?? p.navn)
					: p.navn;
				const antal = kunder.filter((k) => k.forlobIds.includes(p.forlobId!)).length;
				forlobs.push({ id: p.forlobId, navn, antalDeltagere: antal });
			}
			alleForlob = forlobs;
		} catch (e) {
			console.error('Kunne ikke hente kunde- og forløbs-liste:', e);
		} finally {
			indlaeser = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Admin</span>
		</a>
		<div class="eyebrow">Admin</div>
		<h1>Kunde-tildeling</h1>
		<p class="page-sub">
			Tildel træningsprogrammer og custom-builder-adgang til kunder. Tildelinger kan
			gives til enkeltkunder eller hele forløb-grupper.
		</p>
	</header>

	<section class="card">
		<div class="card-titel">Forløb</div>
		<p class="card-sub">Tildel til alle kunder på et forløb. Klik for at se deltagere og tildelinger.</p>
		{#if indlaeser}
			<div class="status">Indlæser…</div>
		{:else if alleForlob.length === 0}
			<div class="status">Ingen forløb fundet.</div>
		{:else}
			<div class="liste">
				{#each alleForlob as f (f.id)}
					<a class="rad" href={`/app/admin/kunde-tildeling/forlob/${f.id}`}>
						<div class="rad-tekst">
							<div class="rad-navn">{f.navn}</div>
							<div class="rad-sub">
								{f.antalDeltagere} deltager{f.antalDeltagere === 1 ? '' : 'e'}
							</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<section class="card">
		<div class="card-titel">Enkeltkunder</div>
		<p class="card-sub">Søg på navn eller email. Klik for at se og redigere kundens tildelinger.</p>
		<label class="felt">
			<input
				type="text"
				class="felt-input"
				placeholder={indlaeser ? 'Indlæser kunder…' : 'Fx Maria, Pia, maria@…'}
				bind:value={soeg}
				disabled={indlaeser}
				autocomplete="off"
				autocapitalize="none"
				spellcheck="false"
			/>
		</label>

		{#if soeg.trim().length >= 2 && matches.length > 0}
			<div class="liste">
				{#each matches as k (k.uid)}
					{@const navn = `${k.firstName} ${k.lastName}`.trim()}
					<a class="rad" href={`/app/admin/kunde-tildeling/kunde/${k.uid}`}>
						<div class="rad-tekst">
							<div class="rad-navn">{navn || '(uden navn)'}</div>
							<div class="rad-sub">{k.email}</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
				{/each}
			</div>
		{:else if soeg.trim().length >= 2 && matches.length === 0 && !indlaeser}
			<div class="status">Ingen kunder matcher søgningen.</div>
		{:else if !indlaeser}
			<div class="status">{alleKunder.length} kunder i alt. Skriv mindst 2 tegn for at søge.</div>
		{/if}
	</section>
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 18px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
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
		font-size: calc(28px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.card-titel {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.card-sub {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 4px 0 12px;
		line-height: 1.4;
	}

	.felt {
		display: block;
	}

	.felt-input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: calc(16px * var(--fs-scale, 1));
		background: var(--bg2);
		color: var(--text);
		box-sizing: border-box;
	}

	.felt-input:focus {
		outline: 2px solid var(--accent, #B87B6E);
		outline-offset: -1px;
	}

	.liste {
		margin-top: 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		overflow: hidden;
	}

	.rad {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.rad:first-child {
		border-top: none;
	}

	.rad:hover {
		background: var(--bg2);
	}

	.rad-tekst {
		flex: 1;
		min-width: 0;
	}

	.rad-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.rad-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
	}

	.status {
		margin-top: 12px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		text-align: center;
		padding: 10px 0;
	}
</style>
