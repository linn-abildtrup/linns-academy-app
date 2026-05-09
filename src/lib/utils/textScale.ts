// Tekst-skalering for hele appen.
// Sættes som data-text-scale="normal|large|xlarge" på <html> og driver
// CSS-variablen --fs-scale. Alle font-sizes i appen bruger calc(Xpx *
// var(--fs-scale, 1)) så de skalerer med brugerens valg på profilsiden.

export type TextScale = 'normal' | 'large' | 'xlarge';

const KEY = 'la_text_scale';

export function laesGemtScale(): TextScale {
	if (typeof localStorage === 'undefined') return 'normal';
	try {
		const v = localStorage.getItem(KEY);
		if (v === 'large' || v === 'xlarge') return v;
	} catch {
		// ignore
	}
	return 'normal';
}

export function gemScale(skala: TextScale) {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, skala);
	} catch {
		// ignore
	}
}

export function anvendScale(skala: TextScale) {
	if (typeof document === 'undefined') return;
	if (skala === 'normal') {
		document.documentElement.removeAttribute('data-text-scale');
	} else {
		document.documentElement.setAttribute('data-text-scale', skala);
	}
}

export function initTextScale(): TextScale {
	const skala = laesGemtScale();
	anvendScale(skala);
	return skala;
}
