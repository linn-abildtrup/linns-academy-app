<script lang="ts">
	// Fullscreen lyd-afspiller i terra-design.
	// Mønstret følger fullscreen-overlay-konventionen i appen (portalToBody +
	// position: fixed; inset: 0). Den native <audio>-tag er skjult internt;
	// vi tegner egne kontroller (play/pause, ±15s, progress).
	import { onDestroy, onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		url: string;
		titel: string;
		sub?: string;
		kategori?: string;
		onClose: () => void;
	}

	let { url, titel, sub = '', kategori = 'Spiller nu', onClose }: Props = $props();

	let audio = $state<HTMLAudioElement | null>(null);
	let playing = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let fejl = $state<string | null>(null);

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode === document.body) {
					document.body.removeChild(node);
				}
			}
		};
	}

	onMount(() => {
		const original = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = original;
		};
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});

	function toggle() {
		if (!audio) return;
		if (audio.paused) {
			audio.play().catch((e) => {
				console.warn('Kunne ikke afspille:', e);
				fejl = 'Kunne ikke afspille lyden.';
			});
		} else {
			audio.pause();
		}
	}

	function spool(deltaSec: number) {
		if (!audio) return;
		const ny = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + deltaSec));
		audio.currentTime = ny;
	}

	function onProgressClick(e: MouseEvent) {
		if (!audio || !duration) return;
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		audio.currentTime = ratio * duration;
	}

	function format(s: number): string {
		if (!Number.isFinite(s) || s < 0) return '0:00';
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	const progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
	const tilbage = $derived(duration > 0 ? duration - currentTime : 0);
</script>

<div class="player" role="dialog" aria-modal="true" aria-label="Lydafspiller" use:portalToBody>
	<audio
		bind:this={audio}
		src={url}
		autoplay
		preload="metadata"
		onplay={() => (playing = true)}
		onpause={() => (playing = false)}
		ontimeupdate={() => audio && (currentTime = audio.currentTime)}
		onloadedmetadata={() => audio && (duration = audio.duration)}
		ondurationchange={() => audio && (duration = audio.duration)}
		onended={() => (playing = false)}
		onerror={() => (fejl = 'Kunne ikke indlæse lyden.')}
	>
		Din browser kan ikke afspille lyd.
	</audio>

	<header class="head">
		<button class="head-knap" type="button" onclick={onClose} aria-label="Luk afspiller">
			<Icon name="chevron-d" size={22} color="#fff" />
		</button>
		<div class="head-titel">
			<div class="eyebrow">{kategori}</div>
			<div class="kategori">{titel}</div>
		</div>
		<div class="head-knap head-knap-spacer" aria-hidden="true"></div>
	</header>

	<div class="art" class:playing>
		<div class="ring ring-3" aria-hidden="true"></div>
		<div class="ring ring-2" aria-hidden="true"></div>
		<div class="ring ring-1" aria-hidden="true"></div>
		<div class="cirkel">
			<Icon name="flower" size={48} color="var(--terra)" filled />
		</div>
	</div>

	<div class="info">
		<h1 class="titel">{titel}</h1>
		{#if sub}
			<div class="sub">{sub}</div>
		{/if}
	</div>

	{#if fejl}
		<div class="fejl">{fejl}</div>
	{/if}

	<div class="progress-wrap">
		<button class="progress" type="button" onclick={onProgressClick} aria-label="Spol">
			<div class="progress-fyld" style:width="{progress}%"></div>
			<div class="progress-knop" style:left="{progress}%"></div>
		</button>
		<div class="tider">
			<span>{format(currentTime)}</span>
			<span>-{format(tilbage)}</span>
		</div>
	</div>

	<div class="kontroller">
		<button class="kontrol-knap sek" type="button" onclick={() => spool(-15)} aria-label="-15 sekunder">
			<span class="sek-tekst">-15</span>
		</button>
		<button class="kontrol-knap pil" type="button" onclick={() => spool(-30)} aria-label="Tilbage">
			<Icon name="arrow-l" size={18} color="#fff" />
		</button>
		<button class="play-knap" type="button" onclick={toggle} aria-label={playing ? 'Pause' : 'Afspil'}>
			<Icon name={playing ? 'pause' : 'play'} size={26} color="var(--terra)" filled />
		</button>
		<button class="kontrol-knap pil" type="button" onclick={() => spool(30)} aria-label="Frem">
			<Icon name="arrow" size={18} color="#fff" />
		</button>
		<button class="kontrol-knap sek" type="button" onclick={() => spool(15)} aria-label="+15 sekunder">
			<span class="sek-tekst">+15</span>
		</button>
	</div>
</div>

<style>
	.player {
		position: fixed;
		inset: 0;
		z-index: 300;
		background: linear-gradient(180deg, #b87b6e 0%, #a06b60 100%);
		color: #fff;
		display: flex;
		flex-direction: column;
		padding: calc(20px + env(safe-area-inset-top)) 24px calc(28px + env(safe-area-inset-bottom));
		box-sizing: border-box;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-shrink: 0;
	}

	.head-knap {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.18);
		border: none;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.head-knap-spacer {
		background: transparent;
		pointer-events: none;
	}

	.head-titel {
		flex: 1;
		text-align: center;
		min-width: 0;
	}

	.eyebrow {
		font-family: var(--ff-b);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.7);
	}

	.kategori {
		font-family: var(--ff-d);
		font-style: italic;
		font-size: 16px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.95);
		margin-top: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.art {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		min-height: 0;
	}

	.ring {
		position: absolute;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.25);
		opacity: 0.9;
	}

	.ring-1 {
		width: 180px;
		height: 180px;
	}

	.ring-2 {
		width: 240px;
		height: 240px;
		opacity: 0.6;
	}

	.ring-3 {
		width: 300px;
		height: 300px;
		opacity: 0.35;
	}

	.art.playing .ring {
		animation: pulse 3s ease-in-out infinite;
	}

	.art.playing .ring-2 {
		animation-delay: 1s;
	}

	.art.playing .ring-3 {
		animation-delay: 2s;
	}

	@keyframes pulse {
		0% {
			transform: scale(0.95);
			opacity: 0.4;
		}
		50% {
			transform: scale(1.05);
			opacity: 0.7;
		}
		100% {
			transform: scale(0.95);
			opacity: 0.4;
		}
	}

	.cirkel {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.95);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
		position: relative;
		z-index: 2;
	}

	.info {
		text-align: center;
		margin: 12px 0 18px;
		flex-shrink: 0;
	}

	.titel {
		font-family: var(--ff-d);
		font-weight: 500;
		font-size: 22px;
		letter-spacing: -0.01em;
		margin: 0;
		color: #fff;
	}

	.sub {
		font-family: var(--ff-b);
		font-size: 13px;
		color: rgba(255, 255, 255, 0.75);
		margin-top: 6px;
	}

	.fejl {
		text-align: center;
		font-size: 12px;
		color: #fbeeea;
		margin-bottom: 12px;
	}

	.progress-wrap {
		flex-shrink: 0;
		margin-bottom: 18px;
	}

	.progress {
		position: relative;
		width: 100%;
		height: 18px;
		background: transparent;
		border: none;
		padding: 6px 0;
		cursor: pointer;
		display: block;
	}

	.progress::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 2px;
		background: rgba(255, 255, 255, 0.25);
		transform: translateY(-50%);
		border-radius: 2px;
	}

	.progress-fyld {
		position: absolute;
		left: 0;
		top: 50%;
		height: 2px;
		background: #fff;
		border-radius: 2px;
		transform: translateY(-50%);
		z-index: 1;
	}

	.progress-knop {
		position: absolute;
		top: 50%;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #fff;
		transform: translate(-50%, -50%);
		z-index: 2;
	}

	.tider {
		display: flex;
		justify-content: space-between;
		font-family: var(--ff-b);
		font-size: 11px;
		color: rgba(255, 255, 255, 0.7);
		margin-top: 4px;
	}

	.kontroller {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		flex-shrink: 0;
	}

	.kontrol-knap {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: transparent;
		border: none;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.kontrol-knap:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	.kontrol-knap.sek {
		background: rgba(255, 255, 255, 0.14);
	}

	.sek-tekst {
		font-family: var(--ff-b);
		font-size: 11px;
		font-weight: 600;
		color: #fff;
		letter-spacing: 0.02em;
	}

	.play-knap {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: #fff;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
	}

	.play-knap:active {
		transform: scale(0.96);
	}
</style>
