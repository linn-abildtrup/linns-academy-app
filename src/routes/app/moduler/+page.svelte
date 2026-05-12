<script lang="ts">
	import { getContext } from 'svelte';
	import type { UserDoc } from '$lib/types';
	import { getModulerForUser, type Modul } from '$lib/content/moduler';
	import Icon from '$lib/components/Icon.svelte';
	import { effektivState } from '$lib/utils/userAdgang';

	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const userDoc = $derived(getUserDoc());
	const userState = $derived(effektivState(userDoc));

	const moduler = $derived.by<Modul[]>(() => {
		if (!userState) return [];
		return getModulerForUser(userState);
	});

	// Modul-id til rute. Kun moduler der har en bygget side er klikbare.
	// De øvrige forbliver ikke-klikbare indtil deres sider er bygget.
	const RUTER: Record<string, string> = {
		forlob: '/app/moduler/forlob',
		traening: '/app/moduler/traening',
		vaner: '/app/moduler/vaner',
		kost: '/app/moduler/30-30-3',
		bibliotek: '/app/moduler/bibliotek'
	};

	function ruteFor(modul: Modul): string | null {
		if (modul.status !== 'aktiv' && modul.status !== 'laeseadgang') return null;
		return RUTER[modul.id] ?? null;
	}

	function erEkstern(rute: string | null): boolean {
		return rute !== null && /^https?:\/\//.test(rute);
	}

	const undertekst = $derived.by(() => {
		if (!userState) return '';
		if (userState === 'forlobskunde') {
			return 'Dit forløb og dine moduler samlet ét sted.';
		}
		if (userState === 'modulbruger') {
			return 'Dine moduler samlet ét sted.';
		}
		return 'Dit indhold med læseadgang.';
	});
</script>

<div class="page">
	<header class="page-header">
		<div class="eyebrow">Bibliotek</div>
		<h1>Moduler</h1>
		<p class="page-sub">{undertekst}</p>
	</header>

	<div class="search">
		<Icon name="search" size={14} color="var(--text3)" />
		<span>Søg i moduler</span>
	</div>

	<div class="modul-liste">
		{#each moduler as modul (modul.id)}
			{@const rute = ruteFor(modul) ?? modul.kobUrl ?? null}
			{@const ekstern = erEkstern(rute)}
			<svelte:element
				this={rute ? 'a' : 'article'}
				class="modul-row"
				class:laast={modul.status === 'laast'}
				class:laeseadgang={modul.status === 'laeseadgang'}
				class:klikbar={!!rute}
				href={rute ?? undefined}
				target={ekstern ? '_blank' : undefined}
				rel={ekstern ? 'noopener noreferrer' : undefined}
			>
				<div class="modul-icon" style="background: {modul.accent};">
					<Icon name={modul.icon} size={18} color="#fff" />
				</div>

				<div class="modul-tekst">
					<div class="modul-navn">{modul.navn}</div>
					<div class="modul-sub">{modul.subTekst}</div>
					{#if modul.laasTekst}
						<div class="modul-laas-tekst">{modul.laasTekst}</div>
					{/if}
				</div>

				<div class="modul-status">
					{#if modul.status === 'aktiv'}
						<span class="badge badge-aktiv">{modul.statusTekst}</span>
					{:else if modul.status === 'laast'}
						<Icon name="lock" size={14} color="var(--text3)" />
					{:else if modul.status === 'laeseadgang'}
						<span class="badge badge-laeseadgang">{modul.statusTekst}</span>
					{/if}
				</div>
			</svelte:element>
		{/each}
	</div>
</div>

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
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

	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--bg2);
		border: 1px solid var(--border);
		margin-bottom: 18px;
	}

	.search span {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.modul-liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
	}

	.modul-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.modul-row:first-child {
		border-top: none;
	}

	.modul-row.klikbar {
		cursor: pointer;
	}

	.modul-row.klikbar:hover {
		background: var(--bg2);
	}

	.modul-row.laast {
		opacity: 0.65;
	}

	.modul-row.laeseadgang {
		opacity: 0.85;
	}

	.modul-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.modul-tekst {
		flex: 1;
		min-width: 0;
	}

	.modul-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--text);
	}

	.modul-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
		line-height: 1.35;
	}

	.modul-laas-tekst {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--terra);
		margin-top: 4px;
		font-weight: 500;
	}

	.modul-status {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.badge {
		font-size: calc(9.5px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 4px 9px;
		border-radius: 99px;
	}

	.badge-aktiv {
		background: var(--bg2);
		color: var(--text2);
	}

	.badge-laeseadgang {
		background: #f1ede8;
		color: #8a7480;
	}
</style>
