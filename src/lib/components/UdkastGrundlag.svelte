<script lang="ts">
	// Viser hvad et AI-svar-udkast blev bygget paa. Ren information til admin,
	// saa det er til at se HVORFOR udkastet blev som det blev. Foldet sammen
	// som standard: overskriften er kontakten, > lukket og v aaben.
	import type { GrundlagPost, UdkastGrundlag } from '$lib/content/svarUdkast';

	// Valgfri, saa kalderen ikke behoever at indsnaevre typen foerst.
	let { grundlag }: { grundlag?: UdkastGrundlag } = $props();

	let aaben = $state(false);

	const opsummering = $derived(
		grundlag
			? [
					`${grundlag.kundeHistorik.length} fra denne kunde`,
					`${grundlag.lignende.length} lignende`,
					`${grundlag.holdSvar.length} fra holdet`
				].join(', ')
			: ''
	);

	const grupper = $derived(
		!grundlag
			? []
			: [
					{
						titel: 'Tidligere svar til denne kunde',
						forklaring: 'Alt hvad hun selv har spurgt om før, på tværs af forløb.',
						poster: grundlag.kundeHistorik
					},
					{
						titel: 'Svar på lignende spørgsmål',
						forklaring: 'Fundet i hele arkivet, uanset hvilket hold de kom fra.',
						poster: grundlag.lignende
					},
					{
						titel: 'Nyeste svar fra dette hold',
						forklaring: 'Følger med hver gang og bruges mest som forbillede for tonen.',
						poster: grundlag.holdSvar
					}
				]
	);

	function etiket(p: GrundlagPost): string {
		const dele = [p.dato, p.forlobId].filter(Boolean);
		return dele.join(' · ');
	}
</script>

{#if grundlag}
	<div class="grundlag">
		<button type="button" class="grundlag-kontakt" onclick={() => (aaben = !aaben)}>
			<span class="pil">{aaben ? '⌄' : '›'}</span>
			Bygget på {opsummering}
		</button>

		{#if aaben}
			<div class="grundlag-indhold">
				<p class="grundlag-note">
					Søgt i {grundlag.korpusStoerrelse} besvarede spørgsmål. Derudover {grundlag.antalFaq} punkter
					fra forløbets FAQ og {grundlag.antalVidenbase} fra videnbasen.
				</p>

				{#each grupper as gruppe (gruppe.titel)}
					<div class="gruppe">
						<div class="gruppe-titel">{gruppe.titel} ({gruppe.poster.length})</div>
						<p class="gruppe-forklaring">{gruppe.forklaring}</p>
						{#if gruppe.poster.length === 0}
							<p class="tom">Ingen.</p>
						{:else}
							<ol class="poster">
								{#each gruppe.poster as post, i (i)}
									<li>
										{#if etiket(post)}<span class="etiket">{etiket(post)}</span>{/if}
										<span class="spm">{post.spoergsmaal}</span>
										<span class="svar">{post.svar}</span>
									</li>
								{/each}
							</ol>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.grundlag {
		margin-top: 6px;
	}

	.grundlag-kontakt {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		font-size: calc(12px * var(--fs-scale, 1));
		color: inherit;
		opacity: 0.7;
		text-align: left;
	}

	.grundlag-kontakt:hover {
		opacity: 1;
	}

	.pil {
		display: inline-block;
		width: 10px;
	}

	.grundlag-indhold {
		margin-top: 8px;
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.03);
	}

	.grundlag-note {
		margin: 0 0 10px;
		font-size: calc(12px * var(--fs-scale, 1));
		opacity: 0.7;
	}

	.gruppe + .gruppe {
		margin-top: 14px;
	}

	.gruppe-titel {
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.gruppe-forklaring {
		margin: 2px 0 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		opacity: 0.6;
	}

	.tom {
		margin: 0;
		font-size: calc(12px * var(--fs-scale, 1));
		opacity: 0.6;
	}

	.poster {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.poster li {
		font-size: calc(12px * var(--fs-scale, 1));
		line-height: 1.45;
	}

	.etiket {
		display: block;
		opacity: 0.55;
	}

	.spm {
		display: block;
		font-weight: 600;
	}

	.svar {
		display: block;
		opacity: 0.8;
	}
</style>
