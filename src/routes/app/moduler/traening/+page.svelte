<script lang="ts">
	import { getContext } from 'svelte';
	import type { UserDoc } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import { erForlobsklient } from '$lib/utils/userAdgang';

	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const userDoc = $derived(getUserDoc());

	const programmer = [
		{
			id: 'mikrotraening',
			navn: 'Mikrotræning',
			beskrivelse: 'Daglig træning',
			rute: '/app/moduler/traening/mikrotraening',
			tilgaengelig: true
		}
	];
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">Modul</div>
		<h1>Træning</h1>
		<p class="page-sub">
			{#if erForlobsklient(userDoc)}
				Dit aktive træningsprogram fra forløbet.
			{:else}
				Træningsprogrammer du har adgang til.
			{/if}
		</p>
	</header>

	<div class="program-liste">
		{#each programmer as program (program.id)}
			<a class="program-row" href={program.rute}>
				<div class="program-icon">
					<Icon name="flame" size={18} color="#fff" />
				</div>

				<div class="program-tekst">
					<div class="program-navn">{program.navn}</div>
					<div class="program-sub">{program.beskrivelse}</div>
				</div>

				<div class="program-pil">
					<Icon name="chevron-r" size={14} color="var(--text3)" />
				</div>
			</a>
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

	.back:hover {
		color: var(--text);
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

	.program-liste {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
	}

	.program-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 14px;
		border-top: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
	}

	.program-row:first-child {
		border-top: none;
	}

	.program-row:hover {
		background: var(--bg2);
	}

	.program-icon {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: #b87b6e;
	}

	.program-tekst {
		flex: 1;
		min-width: 0;
	}

	.program-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
	}

	.program-sub {
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--text3);
		margin-top: 2px;
		line-height: 1.35;
	}

	.program-pil {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}
</style>
