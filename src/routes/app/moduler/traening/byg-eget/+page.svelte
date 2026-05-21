<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler/traening">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Træning</span>
		</a>
		<div class="eyebrow">Custom-builder</div>
		<h1>Byg dit eget program</h1>
		<p class="page-sub">
			Vælg øvelser, sæt, reps og pause selv. Dit program gemmes så du kan vende tilbage til det.
		</p>
	</header>

	<div class="kommer-snart">
		<div class="kommer-snart-titel">Custom-builder kommer snart</div>
		<p>
			Du har adgang til at bygge dit eget træningsprogram, men selve byggeren er endnu ikke
			færdig. Den bygges som det næste skridt.
		</p>
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

	.kommer-snart {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 18px;
	}

	.kommer-snart-titel {
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 8px;
	}

	.kommer-snart p {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0;
	}
</style>
