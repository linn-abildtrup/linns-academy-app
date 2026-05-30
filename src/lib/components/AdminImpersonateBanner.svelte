<script lang="ts">
	// Sticky banner der vises naar admin er i read-only impersonate-mode.
	// Visuelt tydeligt saa hun aldrig glemmer hun ser app'en som en anden bruger.
	interface Props {
		klientNavn: string;
		onForlad: () => void;
	}

	let { klientNavn, onForlad }: Props = $props();
</script>

<div class="banner">
	<div class="indhold">
		<span class="ikon" aria-hidden="true">👁</span>
		<span class="tekst">
			Du ser app'en som <strong>{klientNavn}</strong> — kun læseadgang
		</span>
	</div>
	<button type="button" class="forlad" onclick={onForlad}>Forlad</button>
</div>

<style>
	.banner {
		position: sticky;
		top: 0;
		z-index: 90;
		background: linear-gradient(135deg, var(--terra), var(--terra2));
		color: #fff;
		padding: 8px 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
	}

	.indhold {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
	}

	.ikon {
		font-size: calc(15px * var(--fs-scale, 1));
		line-height: 1;
	}

	.tekst {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tekst strong {
		font-weight: 700;
	}

	.forlad {
		background: rgba(255, 255, 255, 0.2);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.4);
		padding: 5px 12px;
		border-radius: 99px;
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
		font-family: var(--ff-b);
		touch-action: manipulation;
		flex-shrink: 0;
	}

	.forlad:hover {
		background: rgba(255, 255, 255, 0.3);
	}
</style>
