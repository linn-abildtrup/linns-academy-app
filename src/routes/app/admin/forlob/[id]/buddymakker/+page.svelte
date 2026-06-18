<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import Icon from '$lib/components/Icon.svelte';
	import { hentForlob } from '$lib/firestore/forlob';
	import type { Forlob } from '$lib/content/forlobAdgang';

	type Deltager = {
		uid: string;
		email: string;
		firstName: string;
		lastName: string;
		kropsroBuddyOensker: boolean | undefined;
	};

	const forlobId = $derived(page.params.id ?? '');

	let forlob = $state<Forlob | null>(null);
	let deltagere = $state<Deltager[]>([]);
	let loading = $state(true);
	let fejl = $state<string | null>(null);

	onMount(async () => {
		try {
			forlob = await hentForlob(forlobId);
			const usersSnap = await getDocs(collection(db, 'users'));
			deltagere = usersSnap.docs
				.filter((d) => {
					const data = d.data() as { forlobIds?: string[] };
					return (data.forlobIds ?? []).includes(forlobId);
				})
				.map((d) => {
					const data = d.data() as {
						email?: string;
						firstName?: string;
						lastName?: string;
						kropsroBuddyOensker?: boolean;
					};
					return {
						uid: d.id,
						email: data.email ?? '',
						firstName: data.firstName ?? '',
						lastName: data.lastName ?? '',
						kropsroBuddyOensker: data.kropsroBuddyOensker
					};
				})
				.sort((a, b) => (a.firstName || a.email).localeCompare(b.firstName || b.email, 'da'));
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente data.';
		} finally {
			loading = false;
		}
	});

	const onskerBuddy = $derived(deltagere.filter((d) => d.kropsroBuddyOensker === true));
	const onskerIkke = $derived(deltagere.filter((d) => d.kropsroBuddyOensker === false));
	const ikkeSpurgt = $derived(deltagere.filter((d) => d.kropsroBuddyOensker === undefined));
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/admin/forlob/{forlobId}">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Forløb</span>
		</a>
		<div class="eyebrow">Admin · Buddy-gruppe</div>
		<h1>Buddy-gruppe-matches</h1>
		<p class="page-sub">
			Liste over deltagere på {forlob?.navn ?? 'forløbet'} der vil være med i en buddy-gruppe på 4-5 personer.
			Ved første login bliver kunderne spurgt, og svaret gemmes på deres userDoc. Du sætter grupperne
			sammen manuelt og kontakter dem på mail.
		</p>
	</header>

	{#if fejl}
		<div class="status-besked fejl">{fejl}</div>
	{:else if loading}
		<div class="status-besked">Henter…</div>
	{:else}
		<section class="card">
			<div class="card-titel">Vil være med i buddy-gruppe ({onskerBuddy.length})</div>
			{#if onskerBuddy.length === 0}
				<p class="hint">
					Ingen deltagere har sagt ja til en buddy-gruppe endnu. De skal være logget ind mindst én
					gang for at have svaret.
				</p>
			{:else}
				<div class="liste">
					{#each onskerBuddy as d (d.uid)}
						{@const navn = `${d.firstName} ${d.lastName}`.trim()}
						<div class="rad">
							<div class="rad-tekst">
								<div class="rad-navn">{navn || '(uden navn)'}</div>
								<div class="rad-sub">
									<a href="mailto:{d.email}">{d.email}</a>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section class="card sekundaer">
			<div class="card-titel sub">Status for hele forløbet</div>
			<div class="stat-grid">
				<div class="stat">
					<div class="stat-tal">{onskerBuddy.length}</div>
					<div class="stat-label">Vil have</div>
				</div>
				<div class="stat">
					<div class="stat-tal">{onskerIkke.length}</div>
					<div class="stat-label">Vil ikke</div>
				</div>
				<div class="stat">
					<div class="stat-tal">{ikkeSpurgt.length}</div>
					<div class="stat-label">Endnu ikke svaret</div>
				</div>
			</div>
			{#if ikkeSpurgt.length > 0}
				<details class="ikke-spurgt-detail">
					<summary>Vis deltagere der endnu ikke har svaret</summary>
					<div class="liste sekundaer-liste">
						{#each ikkeSpurgt as d (d.uid)}
							{@const navn = `${d.firstName} ${d.lastName}`.trim()}
							<div class="rad">
								<div class="rad-tekst">
									<div class="rad-navn">{navn || '(uden navn)'}</div>
									<div class="rad-sub">{d.email}</div>
								</div>
							</div>
						{/each}
					</div>
				</details>
			{/if}
		</section>
	{/if}
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
		line-height: 1.05;
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

	.card {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 14px;
	}

	.card.sekundaer {
		background: var(--bg2);
	}

	.card-titel {
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 12px;
	}

	.card-titel.sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
	}

	.hint {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0;
		line-height: 1.5;
	}

	.liste {
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
		background: var(--white);
	}

	.rad:first-child {
		border-top: none;
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

	.rad-sub a {
		color: var(--terra);
		text-decoration: none;
	}

	.rad-sub a:hover {
		text-decoration: underline;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}

	.stat {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px 8px;
		text-align: center;
	}

	.stat-tal {
		font-family: var(--ff-d);
		font-size: calc(24px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1;
	}

	.stat-label {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 4px;
		letter-spacing: 0.04em;
	}

	.ikke-spurgt-detail {
		margin-top: 14px;
	}

	.ikke-spurgt-detail summary {
		cursor: pointer;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--terra);
		font-weight: 500;
		padding: 4px 0;
	}

	.sekundaer-liste {
		margin-top: 8px;
	}

	.sekundaer-liste .rad {
		background: var(--bg2);
	}
</style>
