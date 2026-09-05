<script lang="ts">
	// Byggeklods 5. Soegefeltet, som naesten alle admin-sider har brug for.
	interface Props {
		vaerdi: string;
		placeholder?: string;
	}
	let { vaerdi = $bindable(), placeholder = 'Søg…' }: Props = $props();
</script>

<input class="asg" type="search" {placeholder} bind:value={vaerdi} />

<style>
	.asg {
		display: block;
		width: 100%;
		padding: 11px 16px;
		background: var(--paper-2, #f6f0e7);
		border: 1px solid var(--line, #e8dfd1);
		border-radius: 99px;
		color: var(--espresso, #382c2a);
		font-size: calc(14px * var(--fs-scale, 1) * var(--adm-skala, 1));
		font-family: inherit;
		box-sizing: border-box;
	}
</style>
