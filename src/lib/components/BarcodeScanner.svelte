<script lang="ts">
	// Fullscreen stregkode-scanner. Bruger @zxing/browser til at læse EAN/UPC
	// fra bagside-kameraet. Virker i iOS Safari og PWA.
	import { onMount, onDestroy } from 'svelte';
	import { BrowserMultiFormatReader } from '@zxing/browser';
	import type { IScannerControls } from '@zxing/browser';
	import { BarcodeFormat, DecodeHintType } from '@zxing/library';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		onDetected: (barcode: string) => void;
		onClose: () => void;
	}

	let { onDetected, onClose }: Props = $props();

	let video = $state<HTMLVideoElement | null>(null);
	let fejl = $state<string | null>(null);
	let started = $state(false);
	let controls: IScannerControls | null = null;

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

	let original = '';

	onMount(() => {
		original = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		startKamera();
		return () => {
			document.body.style.overflow = original;
		};
	});

	async function startKamera() {
		try {
			const hints = new Map();
			hints.set(DecodeHintType.POSSIBLE_FORMATS, [
				BarcodeFormat.EAN_13,
				BarcodeFormat.EAN_8,
				BarcodeFormat.UPC_A,
				BarcodeFormat.UPC_E,
				BarcodeFormat.CODE_128,
				BarcodeFormat.CODE_39,
				BarcodeFormat.ITF
			]);
			// TRY_HARDER faar ZXing til at bruge mere CPU per frame, hvilket
			// markant forbedrer chancen for at laese skaeve eller lidt
			// uskarpe stregkoder paa iOS-kameraer.
			hints.set(DecodeHintType.TRY_HARDER, true);
			const reader = new BrowserMultiFormatReader(hints);

			if (!video) return;
			// Brug constraints i stedet for deviceId-lookup: facingMode:'environment'
			// vaelger bagside-kamera robust paa iOS Safari (hvor device-labels er
			// tomme foer kamera-permission er givet).
			//
			// Opl0sning: ideal 1280x720 med max 1920x1080. Tidligere bad vi om
			// ideal 1920x1080 - det gjorde at decoderen paa mid-tier Android-
			// telefoner ikke kunne naar at processe frames hurtigt nok, hvilket
			// betoed at kunderne saa kameraet kore men aldrig fik et scan-hit.
			// 1280x720 giver decoderen 3-4x flere frames/sek at arbejde med.
			controls = await reader.decodeFromConstraints(
				{
					video: {
						facingMode: { ideal: 'environment' },
						width: { ideal: 1280, max: 1920 },
						height: { ideal: 720, max: 1080 }
					}
				},
				video,
				(result, _err, scanner) => {
					if (result) {
						scanner.stop();
						onDetected(result.getText());
					}
				}
			);
			started = true;
		} catch (e) {
			console.error(e);
			fejl =
				e instanceof Error && e.name === 'NotAllowedError'
					? 'Kamera-adgang blev afvist. Giv adgang i indstillinger og prøv igen.'
					: 'Kunne ikke starte kameraet. Prøv at lukke og åbne igen.';
		}
	}

	onDestroy(() => {
		controls?.stop();
		if (typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});
</script>

<div class="scanner" use:portalToBody>
	<video bind:this={video} playsinline muted></video>

	<div class="overlay">
		<header class="head">
			<button class="luk" type="button" onclick={onClose} aria-label="Luk scanner">
				<Icon name="arrow-l" size={18} color="#fff" />
			</button>
			<div class="titel">Scan stregkode</div>
			<div class="luk-spacer" aria-hidden="true"></div>
		</header>

		<div class="ramme">
			<div class="ramme-hjornet hjornet-tv"></div>
			<div class="ramme-hjornet hjornet-th"></div>
			<div class="ramme-hjornet hjornet-bv"></div>
			<div class="ramme-hjornet hjornet-bh"></div>
			{#if started && !fejl}
				<div class="scanlinje" aria-hidden="true"></div>
			{/if}
		</div>

		<div class="footer">
			{#if fejl}
				<div class="fejl">{fejl}</div>
			{:else if !started}
				<div class="hint">Starter kamera...</div>
			{:else}
				<div class="hint">Hold telefonen så stregkoden er i feltet</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.scanner {
		position: fixed;
		inset: 0;
		z-index: 400;
		background: #0a0908;
	}

	video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		padding: calc(20px + env(safe-area-inset-top)) 20px calc(28px + env(safe-area-inset-bottom));
		box-sizing: border-box;
		background: linear-gradient(
			180deg,
			rgba(0, 0, 0, 0.5) 0%,
			transparent 18%,
			transparent 70%,
			rgba(0, 0, 0, 0.55) 100%
		);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-shrink: 0;
	}

	.luk {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.luk-spacer {
		width: 38px;
		height: 38px;
	}

	.titel {
		flex: 1;
		text-align: center;
		font-family: var(--ff-d);
		font-style: italic;
		font-size: calc(16px * var(--fs-scale, 1));
		color: #fff;
	}

	.ramme {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		min-height: 0;
	}

	.ramme::after {
		content: '';
		display: block;
		width: 75vw;
		max-width: 320px;
		aspect-ratio: 4 / 3;
		border-radius: 16px;
	}

	.ramme-hjornet {
		position: absolute;
		width: 32px;
		height: 32px;
		border: 3px solid #fff;
	}

	.hjornet-tv {
		top: calc(50% - 37.5vw * 0.375);
		left: calc(50% - 37.5vw);
		border-right: none;
		border-bottom: none;
		border-top-left-radius: 12px;
	}

	.hjornet-th {
		top: calc(50% - 37.5vw * 0.375);
		right: calc(50% - 37.5vw);
		border-left: none;
		border-bottom: none;
		border-top-right-radius: 12px;
	}

	.hjornet-bv {
		bottom: calc(50% - 37.5vw * 0.375);
		left: calc(50% - 37.5vw);
		border-right: none;
		border-top: none;
		border-bottom-left-radius: 12px;
	}

	.hjornet-bh {
		bottom: calc(50% - 37.5vw * 0.375);
		right: calc(50% - 37.5vw);
		border-left: none;
		border-top: none;
		border-bottom-right-radius: 12px;
	}

	.scanlinje {
		position: absolute;
		left: calc(50% - 37.5vw + 8px);
		right: calc(50% - 37.5vw + 8px);
		height: 2px;
		background: var(--terra);
		box-shadow: 0 0 12px rgba(184, 123, 110, 0.8);
		animation: scan 1.8s ease-in-out infinite;
	}

	@keyframes scan {
		0%,
		100% {
			top: calc(50% - 37.5vw * 0.375 + 12px);
		}
		50% {
			top: calc(50% + 37.5vw * 0.375 - 12px);
		}
	}

	.footer {
		flex-shrink: 0;
		text-align: center;
	}

	.hint {
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		color: rgba(255, 255, 255, 0.85);
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.5);
		border-radius: 12px;
		display: inline-block;
	}

	.fejl {
		font-family: var(--ff-b);
		font-size: calc(13px * var(--fs-scale, 1));
		color: #fff;
		padding: 14px 18px;
		background: rgba(184, 70, 70, 0.85);
		border-radius: 12px;
		display: inline-block;
		max-width: 320px;
	}
</style>
