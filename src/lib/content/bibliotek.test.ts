import { describe, it, expect } from 'vitest';
import {
	sorterKategorier,
	sorterItems,
	kunUdgivne,
	grupperEfterKategori,
	naesteOrden,
	detekterGuideType,
	youtubeId,
	vimeoId,
	videoEmbedUrl,
	sorterGuides,
	formatDanskDato
} from './bibliotek';

describe('sorterKategorier', () => {
	it('sorterer efter orden først', () => {
		const ud = sorterKategorier([
			{ navn: 'B', orden: 2 },
			{ navn: 'A', orden: 1 },
			{ navn: 'C', orden: 3 }
		]);
		expect(ud.map((k) => k.navn)).toEqual(['A', 'B', 'C']);
	});

	it('falder tilbage til alfabetisk dansk sortering ved samme orden', () => {
		const ud = sorterKategorier([
			{ navn: 'Æbler', orden: 0 },
			{ navn: 'Agurker', orden: 0 },
			{ navn: 'Bananer', orden: 0 }
		]);
		expect(ud.map((k) => k.navn)).toEqual(['Agurker', 'Bananer', 'Æbler']);
	});

	it('muterer ikke input-arrayet', () => {
		const input = [
			{ navn: 'B', orden: 2 },
			{ navn: 'A', orden: 1 }
		];
		sorterKategorier(input);
		expect(input.map((k) => k.navn)).toEqual(['B', 'A']);
	});
});

describe('sorterItems', () => {
	it('sorterer efter orden', () => {
		const ud = sorterItems([{ orden: 3 }, { orden: 1 }, { orden: 2 }]);
		expect(ud.map((i) => i.orden)).toEqual([1, 2, 3]);
	});

	it('bevarer rækkefølge ved samme orden (stabil)', () => {
		const ud = sorterItems([
			{ orden: 1, id: 'a' },
			{ orden: 1, id: 'b' },
			{ orden: 1, id: 'c' }
		]);
		expect(ud.map((i) => i.id)).toEqual(['a', 'b', 'c']);
	});
});

describe('kunUdgivne', () => {
	it('filtrerer kladder fra', () => {
		const ud = kunUdgivne([
			{ id: 1, udgivet: true },
			{ id: 2, udgivet: false },
			{ id: 3, udgivet: true }
		]);
		expect(ud.map((i) => i.id)).toEqual([1, 3]);
	});

	it('returnerer tom liste hvis intet er udgivet', () => {
		expect(kunUdgivne([{ udgivet: false }, { udgivet: false }])).toEqual([]);
	});
});

describe('grupperEfterKategori', () => {
	it('grupperer items efter kategoriId', () => {
		const ud = grupperEfterKategori([
			{ id: 1, kategoriId: 'a' },
			{ id: 2, kategoriId: 'b' },
			{ id: 3, kategoriId: 'a' }
		]);
		expect(ud).toEqual({
			a: [
				{ id: 1, kategoriId: 'a' },
				{ id: 3, kategoriId: 'a' }
			],
			b: [{ id: 2, kategoriId: 'b' }]
		});
	});

	it('returnerer tomt objekt for tom liste', () => {
		expect(grupperEfterKategori([])).toEqual({});
	});
});

describe('naesteOrden', () => {
	it('returnerer 0 for tom liste', () => {
		expect(naesteOrden([])).toBe(0);
	});

	it('returnerer max+1', () => {
		expect(naesteOrden([{ orden: 0 }, { orden: 5 }, { orden: 2 }])).toBe(6);
	});
});

describe('detekterGuideType', () => {
	it('genkender YouTube-URLs som video', () => {
		expect(detekterGuideType('https://www.youtube.com/watch?v=abc123')).toBe('video');
		expect(detekterGuideType('https://youtu.be/abc123')).toBe('video');
	});

	it('genkender Vimeo-URLs som video', () => {
		expect(detekterGuideType('https://vimeo.com/123456')).toBe('video');
	});

	it('genkender PDF-URLs', () => {
		expect(detekterGuideType('https://example.com/dokument.pdf')).toBe('pdf');
		expect(detekterGuideType('https://example.com/dokument.pdf?id=1')).toBe('pdf');
	});

	it('genkender lyd-filer', () => {
		expect(detekterGuideType('https://example.com/lyd.mp3')).toBe('audio');
		expect(detekterGuideType('https://example.com/lyd.m4a')).toBe('audio');
	});

	it('genkender HTML-filer', () => {
		expect(detekterGuideType('https://example.com/side.html')).toBe('html');
		expect(detekterGuideType('https://example.com/side.htm')).toBe('html');
		expect(detekterGuideType('https://example.com/side.html?token=abc')).toBe('html');
	});

	it('returnerer link som fallback', () => {
		expect(detekterGuideType('https://example.com')).toBe('link');
		expect(detekterGuideType('')).toBe('link');
	});
});

describe('youtubeId', () => {
	it('udtrækker id fra ?v=-format', () => {
		expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('udtrækker id fra youtu.be-format', () => {
		expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('udtrækker id fra embed-format', () => {
		expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('udtrækker id fra shorts-format', () => {
		expect(youtubeId('https://www.youtube.com/shorts/abc123def')).toBe('abc123def');
	});

	it('returnerer null for ikke-YouTube-URLs', () => {
		expect(youtubeId('https://vimeo.com/123')).toBeNull();
		expect(youtubeId('')).toBeNull();
	});
});

describe('vimeoId', () => {
	it('udtrækker id fra vimeo.com/N-format', () => {
		expect(vimeoId('https://vimeo.com/123456789')).toBe('123456789');
	});

	it('udtrækker id fra vimeo.com/video/N-format', () => {
		expect(vimeoId('https://vimeo.com/video/123456789')).toBe('123456789');
	});

	it('returnerer null for ikke-Vimeo-URLs', () => {
		expect(vimeoId('https://youtube.com/watch?v=abc')).toBeNull();
	});
});

describe('videoEmbedUrl', () => {
	it('bygger YouTube embed-URL', () => {
		expect(videoEmbedUrl('https://youtu.be/abc123')).toBe(
			'https://www.youtube.com/embed/abc123'
		);
	});

	it('bygger Vimeo embed-URL', () => {
		expect(videoEmbedUrl('https://vimeo.com/123')).toBe('https://player.vimeo.com/video/123');
	});

	it('returnerer null for ukendte URL-formater', () => {
		expect(videoEmbedUrl('https://example.com/video.mp4')).toBeNull();
	});
});

describe('sorterGuides', () => {
	it('sorterer nyeste dato øverst', () => {
		const ud = sorterGuides([
			{ id: 'a', dato: '2026-01-01', orden: 0 },
			{ id: 'b', dato: '2026-05-01', orden: 0 },
			{ id: 'c', dato: '2026-03-01', orden: 0 }
		]);
		expect(ud.map((i) => i.id)).toEqual(['b', 'c', 'a']);
	});

	it('items uden dato lander nederst', () => {
		const ud = sorterGuides([
			{ id: 'a', dato: '', orden: 0 },
			{ id: 'b', dato: '2026-05-01', orden: 0 }
		]);
		expect(ud.map((i) => i.id)).toEqual(['b', 'a']);
	});

	it('items uden dato sorteres efter orden indbyrdes', () => {
		const ud = sorterGuides([
			{ id: 'a', dato: '', orden: 2 },
			{ id: 'b', dato: '', orden: 0 },
			{ id: 'c', dato: '', orden: 1 }
		]);
		expect(ud.map((i) => i.id)).toEqual(['b', 'c', 'a']);
	});
});

describe('formatDanskDato', () => {
	it('formaterer ISO til dansk', () => {
		expect(formatDanskDato('2026-05-08')).toBe('8. maj 2026');
		expect(formatDanskDato('2026-01-01')).toBe('1. januar 2026');
		expect(formatDanskDato('2026-12-24')).toBe('24. december 2026');
	});

	it('returnerer tom streng for ugyldigt input', () => {
		expect(formatDanskDato('')).toBe('');
		expect(formatDanskDato('ikke-en-dato')).toBe('');
	});
});
