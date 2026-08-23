import { describe, expect, it } from 'vitest';
import { laas, type PushAdresse } from './webPush';

// Vi spiller telefonens rolle: laver et noeglepar, faar en besked laast,
// og laaser den op igen med opskriften fra RFC 8291. Kan vi det, kan
// hendes telefon ogsaa.

const b64u = (b: ArrayBuffer | Uint8Array) => {
	const u = b instanceof Uint8Array ? b : new Uint8Array(b);
	let s = '';
	for (const t of u) s += String.fromCharCode(t);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const saml = (...dele: Uint8Array[]) => {
	const ud = new Uint8Array(new ArrayBuffer(dele.reduce((n, d) => n + d.length, 0)));
	let i = 0;
	for (const d of dele) {
		ud.set(d, i);
		i += d.length;
	}
	return ud;
};

const tekst = (s: string) => new TextEncoder().encode(s);

async function hmac(n: Uint8Array, d: Uint8Array) {
	const k = await crypto.subtle.importKey('raw', n, { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign'
	]);
	return new Uint8Array(await crypto.subtle.sign('HMAC', k, d));
}

async function udled(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
	const prk = await hmac(salt, ikm);
	return (await hmac(prk, saml(info, new Uint8Array([1])))).slice(0, len);
}

/** En telefon: noeglepar, hemmelighed, og evnen til at laase op. */
async function lavTelefon() {
	const kp = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits'
	])) as CryptoKeyPair;
	const raa = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
	const auth = crypto.getRandomValues(new Uint8Array(16));

	const adresse: PushAdresse = {
		endpoint: 'https://push.eksempel.dk/abc',
		p256dh: b64u(raa),
		auth: b64u(auth)
	};

	async function laasOp(pakke: Uint8Array): Promise<string> {
		const salt = pakke.slice(0, 16);
		const idlen = pakke[20];
		const afsender = pakke.slice(21, 21 + idlen);
		const laast = pakke.slice(21 + idlen);

		const afsenderNoegle = await crypto.subtle.importKey(
			'raw',
			afsender,
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			[]
		);
		const faelles = new Uint8Array(
			await crypto.subtle.deriveBits({ name: 'ECDH', public: afsenderNoegle }, kp.privateKey, 256)
		);
		const info = saml(tekst('WebPush: info'), new Uint8Array([0]), raa, afsender);
		const ikm = await udled(auth, faelles, info, 32);
		const cek = await udled(
			salt,
			ikm,
			saml(tekst('Content-Encoding: aes128gcm'), new Uint8Array([0])),
			16
		);
		const nonce = await udled(
			salt,
			ikm,
			saml(tekst('Content-Encoding: nonce'), new Uint8Array([0])),
			12
		);
		const n = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
		const aaben = new Uint8Array(
			await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, n, laast)
		);
		// Sidste byte er skilletegnet, ikke indhold.
		return new TextDecoder().decode(aaben.slice(0, -1));
	}

	return { adresse, laasOp };
}

describe('laas', () => {
	it('TELEFONEN KAN LAASE OP IGEN, og der staar det samme', async () => {
		const t = await lavTelefon();
		const besked = JSON.stringify({
			titel: 'Linn har svaret dig',
			tekst: 'Prøv at spise lidt mere protein til morgenmad',
			sti: '/ny/beskeder',
			slags: 'svar'
		});
		const pakke = await laas(besked, t.adresse);
		expect(await t.laasOp(pakke)).toBe(besked);
	});

	it('æ, ø og å overlever turen', async () => {
		const t = await lavTelefon();
		const besked = 'Så er dagen klar — æblegrød, blødkogte æg og en gåtur';
		const pakke = await laas(besked, t.adresse);
		expect(await t.laasOp(pakke)).toBe(besked);
	});

	it('hovedet ser ud som standarden kraever', async () => {
		const t = await lavTelefon();
		const pakke = await laas('hej', t.adresse);
		// 16 salt + 4 stoerrelse + 1 laengde + 65 noegle = 86, saa indhold.
		expect(pakke.length).toBeGreaterThan(86);
		expect(pakke[20]).toBe(65);
		const stoerrelse = new DataView(pakke.buffer, pakke.byteOffset + 16, 4).getUint32(0);
		expect(stoerrelse).toBe(4096);
	});

	it('to beskeder ligner ikke hinanden, selv med samme indhold', async () => {
		const t = await lavTelefon();
		const a = await laas('hej', t.adresse);
		const b = await laas('hej', t.adresse);
		expect(b64u(a)).not.toBe(b64u(b));
	});

	it('en anden telefon kan IKKE laase op', async () => {
		const en = await lavTelefon();
		const anden = await lavTelefon();
		const pakke = await laas('hemmeligt', en.adresse);
		await expect(anden.laasOp(pakke)).rejects.toThrow();
	});
});
