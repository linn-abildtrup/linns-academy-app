<script lang="ts">
	// Banner der vises øverst i app-shellen når admin er i klient-mode.
	// Påminder Linn om hvilket forløb hun ser med klient-øjne, og giver et
	// hurtigt link tilbage til admin-mode.
	import { onMount } from 'svelte';
	import { hentForlob } from '$lib/firestore/forlob';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		forlobId: string;
		onAfslut: () => void;
	}

	let { forlobId, onAfslut }: Props = $props();

	let forlobNavn = $state<string>('');

	onMount(async () => {
		try {
			const f = await hentForlob(forlobId);
			forlobNavn = f?.navn ?? forlobId;
		} catch (e) {
			console.warn('Kunne ikke hente forløbsnavn:', e);
			forlobNavn = forlobId;
		}
	});
</script>

<div class="banner">
	<Icon name="user" size={14} color="#fff" />
	<span class="banner-tekst">Klient-mode: <strong>{forlobNavn || '...'}</strong></span>
	<button type="button" class="banner-knap" onclick={onAfslut}>Skift tilbage</button>
</div>

<style>
	.banner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px;
		background: var(--terra);
		color: #fff;
		flex-shrink: 0;
	}

	.banner-tekst {
		flex: 1;
		font-size: calc(12px * var(--fs-scale, 1));
		font-weight: 500;
	}

	.banner-tekst strong {
		font-weight: 700;
	}

	.banner-knap {
		background: rgba(255, 255, 255, 0.2);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.35);
		padding: 5px 12px;
		border-radius: 99px;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		font-family: var(--ff-b);
		cursor: pointer;
	}

	.banner-knap:hover {
		background: rgba(255, 255, 255, 0.3);
	}
</style>
