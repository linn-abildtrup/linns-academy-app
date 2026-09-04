// ============================================================
// Find det element der FAKTISK ruller.
//
// PROBLEMET, 4. september. Beskeder skulle staa i bunden naar den blev
// aabnet, og gjorde det ikke. Jeg brugte tre forsoeg paa timing, foer
// det gik op for mig at aarsagen var en helt anden: der blev sat
// scrollTop paa et element der aldrig ruller.
//
// Boble-listen har selv `overflow-y: auto`, men den ligger inde i
// skallens `.ny-scroll`, som ikke er en flex-container. Derfor bider
// `flex: 1` og `min-height: 0` paa listen ikke, den vokser med sit
// indhold, og rullet sker i `.ny-scroll` udenfor.
//
// HVORFOR VI IKKE BARE RETTER LAYOUTET. Det kunne loeses ved at give
// beskedsiden fast hoejde, som den gamle app goer med .page.chat. Men
// det roerer ved hoejden paa hele siden, og bundmenuen ligger lige
// under. Den maa aldrig gynge, se overdragelsen. At rulle det rigtige
// element er den mindste aendring der virker.
//
// DEN HER LETER OPAD i stedet for at gaette paa en klasse. Aendrer
// layoutet sig igen, finder den bare den nye container.
// ============================================================

/** Kan elementet overhovedet rulle lodret, og er der noget at rulle. */
function ruller(el: HTMLElement): boolean {
	const overflow = getComputedStyle(el).overflowY;
	if (overflow !== 'auto' && overflow !== 'scroll') return false;
	// Et element med overflow:auto men uden overskydende indhold ruller
	// ikke. Uden den her ville vi stoppe ved boble-listen og tro vi var
	// i maal. Én pixels slack, fordi hoejder kan vaere broekdele.
	return el.scrollHeight > el.clientHeight + 1;
}

/**
 * Det naermeste element der ruller, talt fra `start` og opad.
 *
 * `start` selv taeller med: er det listen der ruller, er det den vi vil
 * have. Null naar ingenting kan rulle, og saa er der heller ikke noget
 * at rulle til.
 */
export function rullendeElement3(start: HTMLElement | null): HTMLElement | null {
	let n: HTMLElement | null = start;
	while (n) {
		if (ruller(n)) return n;
		n = n.parentElement;
	}
	return null;
}

/**
 * Sætter samtalen i bunden, uden animation.
 *
 * Uden animation med vilje: den skal allerede VAERE i bunden, ikke rulle
 * derned mens hun kigger paa det.
 */
export function tilBunden3(start: HTMLElement | null): void {
	const el = rullendeElement3(start);
	if (el) el.scrollTop = el.scrollHeight;
}
