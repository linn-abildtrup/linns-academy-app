// Bibliotek-modul — typer og pure-funktioner.
//
// Bibliotek samler FAQ og guides for et givet forløb. Alt ligger som
// sub-collections under forlob/{forlobId}/... så indholdet er forløbs-
// specifikt og kopieres med kopierForlobIndhold når Linn opretter et nyt
// forløb baseret på et tidligere.
//
// Firestore-stier:
//   forlob/{forlobId}/faqKategorier/{id}    { navn, orden, oprettet }
//   forlob/{forlobId}/faqItems/{id}         { kategoriId, spoergsmaal, svar,
//                                              orden, udgivet, oprettet, opdateret }
//   forlob/{forlobId}/guideKategorier/{id}  { navn, orden, oprettet }
//   forlob/{forlobId}/guideItems/{id}       { kategoriId, type, titel,
//                                              beskrivelse, url, dato, orden,
//                                              udgivet, oprettet, opdateret }

import type { Timestamp } from 'firebase/firestore';

// ==============================================
// FAQ-typer
// ==============================================

export interface FaqKategori {
	id: string;
	navn: string;
	orden: number;
	oprettet: Timestamp;
}

export interface FaqItem {
	id: string;
	kategoriId: string;
	spoergsmaal: string;
	svar: string;
	orden: number;
	udgivet: boolean;
	oprettet: Timestamp;
	opdateret: Timestamp;
}

// ==============================================
// Guide-typer
// ==============================================

export type GuideType = 'video' | 'pdf' | 'link' | 'audio' | 'html';

export const GUIDE_TYPER: GuideType[] = ['video', 'pdf', 'link', 'audio', 'html'];

export const GUIDE_TYPE_LABELS: Record<GuideType, string> = {
	video: 'Video',
	pdf: 'PDF',
	link: 'Link',
	audio: 'Lyd',
	html: 'HTML'
};

export interface GuideKategori {
	id: string;
	navn: string;
	orden: number;
	oprettet: Timestamp;
}

export interface GuideItem {
	id: string;
	kategoriId: string;
	type: GuideType;
	titel: string;
	beskrivelse: string;
	url: string;
	dato: string; // YYYY-MM-DD eller tom streng
	orden: number;
	udgivet: boolean;
	oprettet: Timestamp;
	opdateret: Timestamp;
}

// ==============================================
// Sortering og filtrering
// ==============================================

/**
 * Sorterer kategorier efter orden, derefter navn alfabetisk som fallback.
 */
export function sorterKategorier<T extends { orden: number; navn: string }>(kategorier: T[]): T[] {
	return [...kategorier].sort((a, b) => {
		if (a.orden !== b.orden) return a.orden - b.orden;
		return a.navn.localeCompare(b.navn, 'da');
	});
}

/**
 * Sorterer items efter orden indenfor deres egen kategori. Stabil mht
 * input-rækkefølge når orden er identisk.
 */
export function sorterItems<T extends { orden: number }>(items: T[]): T[] {
	return [...items].sort((a, b) => a.orden - b.orden);
}

/**
 * Filtrerer items så kun udgivne returneres. Bruges på klient-siden,
 * hvor admin ser både kladder og udgivne.
 */
export function kunUdgivne<T extends { udgivet: boolean }>(items: T[]): T[] {
	return items.filter((it) => it.udgivet);
}

/**
 * Grupperer items pr kategori-id.
 */
export function grupperEfterKategori<T extends { kategoriId: string }>(
	items: T[]
): Record<string, T[]> {
	const ud: Record<string, T[]> = {};
	for (const it of items) {
		if (!ud[it.kategoriId]) ud[it.kategoriId] = [];
		ud[it.kategoriId].push(it);
	}
	return ud;
}

/**
 * Returnerer den næste ledige orden-værdi i en kategori. Tager max+1 så
 * nyoprettede items lander i bunden uden at kollidere med eksisterende.
 */
export function naesteOrden<T extends { orden: number }>(eksisterende: T[]): number {
	if (eksisterende.length === 0) return 0;
	const max = eksisterende.reduce((m, it) => (it.orden > m ? it.orden : m), 0);
	return max + 1;
}

// ==============================================
// Guide URL-helpers
// ==============================================

/**
 * Forsøger at gætte type ud fra URL'en. Bruges som forhåndsvalg når Linn
 * klistrer en URL ind i admin — hun kan altid overskrive valget manuelt.
 */
export function detekterGuideType(url: string): GuideType {
	if (!url) return 'link';
	const u = url.toLowerCase();
	if (u.includes('youtube.com/') || u.includes('youtu.be/')) return 'video';
	if (u.includes('vimeo.com/')) return 'video';
	if (u.endsWith('.pdf') || u.includes('.pdf?')) return 'pdf';
	if (u.endsWith('.mp3') || u.endsWith('.m4a') || u.endsWith('.wav')) return 'audio';
	if (u.endsWith('.html') || u.endsWith('.htm') || u.includes('.html?') || u.includes('.htm?')) return 'html';
	return 'link';
}

/**
 * Udtrækker YouTube-video-id fra forskellige URL-formater.
 * Returnerer null hvis URL'en ikke kan parses som YouTube.
 */
export function youtubeId(url: string): string | null {
	if (!url) return null;
	const m1 = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
	if (m1) return m1[1];
	const m2 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
	if (m2) return m2[1];
	const m3 = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
	if (m3) return m3[1];
	const m4 = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
	if (m4) return m4[1];
	return null;
}

/**
 * Udtrækker Vimeo-video-id fra URL.
 */
export function vimeoId(url: string): string | null {
	if (!url) return null;
	const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
	return m ? m[1] : null;
}

/**
 * Bygger embed-URL til iframe-afspilning. Returnerer null hvis URL'en
 * hverken er YouTube eller Vimeo (så klienten kan fallback til ekstern
 * åbning).
 */
export function videoEmbedUrl(url: string): string | null {
	const yt = youtubeId(url);
	if (yt) return `https://www.youtube.com/embed/${yt}`;
	const vm = vimeoId(url);
	if (vm) return `https://player.vimeo.com/video/${vm}`;
	return null;
}

/**
 * Returnerer URL til et thumbnail-billede for en video. Bruges som forhåndsvisning
 * på lektion-cards. Returnerer null hvis URL'en ikke er en kendt video-platform
 * eller (for Zoom) ikke kan auto-genereres.
 *
 * - YouTube: officiel CDN (img.youtube.com)
 * - Vimeo: vumbnail.com — statisk proxy så vi ikke skal lave async fetch
 *   mod Vimeos oEmbed-API. Kvalitet er god nok til preview.
 */
export function videoThumbnail(url: string): string | null {
	if (!url) return null;
	const yt = youtubeId(url);
	if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
	const vm = vimeoId(url);
	if (vm) return `https://vumbnail.com/${vm}.jpg`;
	return null;
}

/**
 * True hvis URL'en peger på en video-lektion (YouTube, Vimeo eller Zoom-
 * optagelse). Bruges til at vise thumbnail-plads på lektion-cards selv
 * hvis vi ikke kan hente et faktisk billede (fx Zoom).
 */
export function erVideoLektion(url: string): boolean {
	if (!url) return false;
	const u = url.toLowerCase();
	if (u.includes('youtube.com/') || u.includes('youtu.be/')) return true;
	if (u.includes('vimeo.com/')) return true;
	if (u.includes('zoom.us/rec/')) return true;
	return false;
}

/**
 * True hvis URL'en peger på en lyd-lektion (mp3, m4a, wav osv.). Bruges til
 * at vise et generisk lyd-thumbnail på lektion-cards så klienter kan se
 * det er en podcast/audio og ikke en video.
 */
export function erLydLektion(url: string): boolean {
	if (!url) return false;
	const u = url.toLowerCase().split('?')[0];
	return /\.(mp3|m4a|wav|aac|ogg)$/.test(u);
}

/**
 * True hvis URL'en peger på en HTML-side (uploaded fra admin). Bruges til
 * at vise et "Inspiration"-thumbnail med bog-ikon på lektion-cards.
 */
export function erInspirationLektion(url: string): boolean {
	if (!url) return false;
	const u = url.toLowerCase().split('?')[0];
	if (/\.(html|htm)$/.test(u)) return true;
	// Firebase Storage uploads har content-type i URL'en men ikke nødvendigvis
	// .html-suffix. Tjek path-segmentet for /html/ som vores upload-helper bruger.
	return /\/forlob\/[^/]+\/html\//.test(url);
}

/**
 * Sorterer guides så nyeste dato vises øverst. Items uden dato falder
 * nederst og sorteres internt efter orden.
 */
export function sorterGuides<T extends { dato: string; orden: number }>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		const aHar = !!a.dato;
		const bHar = !!b.dato;
		if (aHar && bHar) {
			if (a.dato !== b.dato) return a.dato < b.dato ? 1 : -1;
		} else if (aHar !== bHar) {
			return aHar ? -1 : 1;
		}
		return a.orden - b.orden;
	});
}

/**
 * Formaterer YYYY-MM-DD til dansk dato (fx "8. maj 2026"). Returnerer
 * tom streng hvis input ikke er en gyldig dato.
 */
export function formatDanskDato(iso: string): string {
	if (!iso) return '';
	const d = new Date(iso + 'T12:00:00');
	if (isNaN(d.getTime())) return '';
	const maaneder = [
		'januar', 'februar', 'marts', 'april', 'maj', 'juni',
		'juli', 'august', 'september', 'oktober', 'november', 'december'
	];
	return `${d.getDate()}. ${maaneder[d.getMonth()]} ${d.getFullYear()}`;
}
