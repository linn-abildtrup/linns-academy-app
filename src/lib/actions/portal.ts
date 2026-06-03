// Svelte-action der flytter noden til document.body. Bruges paa modal-
// og overlay-rod-elementer saa de bryder ud af scrollable parents (fx
// vores <main class="content"> som har -webkit-overflow-scrolling: touch
// og dermed fanger position: fixed-boern paa iOS Safari).

export function portal(node: HTMLElement) {
	if (typeof document === 'undefined') return {};
	document.body.appendChild(node);
	return {
		destroy() {
			if (node.parentNode === document.body) {
				document.body.removeChild(node);
			}
		}
	};
}
