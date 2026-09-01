import { describe, expect, it } from 'vitest';
import {
	beskedFilSti,
	erVoresBeskedFil,
	filStoerrelse,
	formaterSekunder
} from './beskedFil3';

describe('beskedFilSti', () => {
	it('laegger filen i kundens egen mappe', () => {
		expect(beskedFilSti('abc123', 'billede', 'webp', 1_700_000_000_000)).toBe(
			'beskeder/abc123/1700000000000-billede.webp'
		);
	});

	it('renser endelsen, saa en filtype ikke kan lave om paa stien', () => {
		expect(beskedFilSti('abc', 'lyd', '../../andet', 1)).toBe('beskeder/abc/1-lyd.andet');
	});

	it('kraever et uid', () => {
		expect(() => beskedFilSti('', 'billede', 'webp')).toThrow();
	});
});

describe('erVoresBeskedFil', () => {
	const url =
		'https://firebasestorage.googleapis.com/v0/b/linns-academy-app.firebasestorage.app/o/beskeder%2Fabc123%2F1-billede.webp?alt=media&token=x';

	it('godtager kundens egen fil', () => {
		expect(erVoresBeskedFil(url, 'abc123')).toBe(true);
	});

	it('afviser en anden kundes mappe', () => {
		expect(erVoresBeskedFil(url, 'xyz789')).toBe(false);
	});

	it('afviser en adresse et andet sted i verden', () => {
		expect(erVoresBeskedFil('https://andetsted.dk/beskeder%2Fabc123%2Ffil.webp', 'abc123')).toBe(
			false
		);
	});

	it('afviser tomme adresser', () => {
		expect(erVoresBeskedFil('', 'abc123')).toBe(false);
	});
});

describe('filStoerrelse', () => {
	it('skriver KB og MB som Linn laeser dem', () => {
		expect(filStoerrelse(61_000)).toBe('60 KB');
		expect(filStoerrelse(2_500_000)).toBe('2,4 MB');
	});
});

describe('formaterSekunder', () => {
	it('skriver minutter og sekunder', () => {
		expect(formaterSekunder(72)).toBe('1:12');
		expect(formaterSekunder(5)).toBe('0:05');
		expect(formaterSekunder(-3)).toBe('0:00');
	});
});
