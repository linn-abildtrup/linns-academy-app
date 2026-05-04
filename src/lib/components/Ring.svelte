<script lang="ts">
	let {
		value,
		size = 28,
		stroke = 3,
		color = 'currentColor',
		trackColor = 'var(--border2)'
	}: {
		value: number;
		size?: number;
		stroke?: number;
		color?: string;
		trackColor?: string;
	} = $props();

	const radius = $derived((size - stroke) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const clampedValue = $derived(Math.max(0, Math.min(1, value)));
	const dashOffset = $derived(circumference * (1 - clampedValue));
	const center = $derived(size / 2);
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" class="ring">
	<circle
		cx={center}
		cy={center}
		r={radius}
		fill="none"
		stroke={trackColor}
		stroke-width={stroke}
	/>
	<circle
		cx={center}
		cy={center}
		r={radius}
		fill="none"
		stroke={color}
		stroke-width={stroke}
		stroke-dasharray={circumference}
		stroke-dashoffset={dashOffset}
		stroke-linecap="round"
		transform="rotate(-90 {center} {center})"
	/>
</svg>

<style>
	.ring {
		flex-shrink: 0;
		display: block;
	}
</style>
