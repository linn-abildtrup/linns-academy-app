<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import Icon from '$lib/components/Icon.svelte';
	import { hentMineProgrammer } from '$lib/firestore/mineProgrammer';
	import { anslaaetVarighedMinutter, type CustomProgram } from '$lib/content/mineProgrammer';

	const getUser = getContext<() => User | null>('user');
	const user = $derived(getUser());

	let programmer = $state<CustomProgram[]>([]);
	let indlaeser = $state(true);
	let fejl = $state<string | null>(null);

	onMount(async () => {
		if (!user) return;
		try {
			programmer = await hentMineProgrammer(user.uid);
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente dine programmer.';
		} finally {
			indlaeser = false;
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Træning</span>
		</a>
		<div class="eyebrow">Custom-builder</div>
		<h1>Mine programmer</h1>
		<p class="page-sub">
			Programmer du selv har bygget — vælg øvelser, sæt, reps og pause.
		</p>
	</header>

	{#if fejl}
		<div class="besked fejl">{fejl}</div>
	{:else if indlaeser}
		<div class="besked">Henter dine programmer…</div>
	{:else}
		{#if programmer.length === 0}
			<div class="tom-tilstand">
				<div class="tom-titel">Endnu ingen programmer</div>
				<p>Byg dit første træningsprogram nedenfor.</p>
			</div>
		{:else}
			<div class="liste">
				{#each programmer as p (p.id)}
					<a class="rad" href={`/app/moduler/traening/byg-eget/${p.id}`}>
						<div class="rad-icon">
							<Icon name="flame" size={18} color="#fff" />
						</div>
						<div class="rad-tekst">
							<div class="rad-navn">{p.navn}</div>
							<div class="rad-sub">
								{p.oevelser.length} øvelser · ca. {anslaaetVarighedMinutter(p)} min
							</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</a>
				{/each}
			</div>
		{/if}

		<a class="primary-link" href="/app/moduler/traening/byg-eget/nyt">
			<Icon name="flame" size={16} color="#fff" />
			<span>Byg nyt program</span>
		</a>
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
		line-height: 1.4;
	}

	.besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
		margin-bottom: 14px;
	}

	.besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.tom-tilstand {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 20px;
		text-align: center;
		margin-bottom: 14px;
	}

	.tom-titel {
		font-family: var(--ff-d);
		font-size: calc(17px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 6px;
	}

	.tom-tilstand p {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 0;
	}

	.liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		margin-bottom: 14px;
	}

	.rad {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
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

	.rad-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: #b87b6e;
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

	.primary-link {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		background: var(--terra);
		color: white;
		border-radius: 12px;
		text-decoration: none;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		box-sizing: border-box;
	}

	.primary-link:hover {
		opacity: 0.92;
	}
</style>
