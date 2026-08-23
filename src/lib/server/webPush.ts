// ============================================================
// Afsendelse af beskeder til telefonen. Ren protokol, ingen tjeneste.
//
// HVORFOR IKKE FIREBASE ELLER EN TREDJEPART. Web Push er en standard som
// alle browsere taler, ogsaa Safari paa iPhone. Vi sender direkte til
// den adresse telefonen selv har givet os. Der er ingen konto, ingen
// regning og ingen der skal have kundernes adresser at vide.
//
// KOERER I CLOUDFLARES WORKERS, hvor der ikke findes Node-biblioteker.
// Alt herunder bruger derfor kun browserens egen krypto, praecis som
// resten af server-koden gaar gennem firestoreRest af samme grund.
//
// TO TING SKER FOR HVER BESKED:
//
//  1. Vi UNDERSKRIVER os selv over for telefonens push-tjeneste, saa den
//     kan se at beskeden kommer fra os og ikke fra en fremmed. Det er de
//     to noegler i miljoeet, VAPID.
//  2. Vi LAASER indholdet med telefonens egen noegle. Hverken Google,
//     Apple eller vi kan laese det undervejs. Kun hendes telefon kan.
//
// Bygget 23. august 2026, se HANDOVER 9.39.
// ============================================================

/** Det telefonen gav os da hun sagde ja. */
export interface PushAdresse {
	endpoint: string;
	/** Telefonens offentlige noegle. */
	p256dh: string;
	/** Telefonens hemmelighed, 16 tegn. */
	auth: string;
}

export interface PushNoegler {
	offentlig: string;
	privat: string;
	/** Kontakt-adresse, kraevet af standarden. Bruges hvis noget driller. */
	kontakt: string;
}

// ── Smaa hjaelpere til den slags tal computere taler i ──────

/**
 * Bytes der ligger i en almindelig hukommelsesblok. Typen er ikke pynt:
 * browserens krypto naegter at arbejde med blokke der kan deles mellem
 * traade, og uden den her skelnen faar man en fejl der er svaer at laese.
 */
type Bytes = Uint8Array<ArrayBuffer>;

function fraB64u(s: string): Bytes {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
	const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
	const raa = atob(b64 + pad);
	const ud = new Uint8Array(new ArrayBuffer(raa.length));
	for (let i = 0; i < raa.length; i++) ud[i] = raa.charCodeAt(i);
	return ud;
}

function tilB64u(b: ArrayBuffer | Uint8Array): string {
	const u = b instanceof Uint8Array ? b : new Uint8Array(b);
	let s = '';
	for (const t of u) s += String.fromCharCode(t);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function saml(...dele: Uint8Array[]): Bytes {
	const ialt = dele.reduce((n, d) => n + d.length, 0);
	const ud = new Uint8Array(new ArrayBuffer(ialt));
	let i = 0;
	for (const d of dele) {
		ud.set(d, i);
		i += d.length;
	}
	return ud;
}

const tekst = (s: string): Bytes => new TextEncoder().encode(s) as Bytes;

/** Én enkelt byte. Standarden bruger dem som skilletegn flere steder. */
function byte(n: number): Bytes {
	const b = new Uint8Array(new ArrayBuffer(1));
	b[0] = n;
	return b;
}

async function hmac(noegle: Bytes, data: Bytes): Promise<Bytes> {
	const k = await crypto.subtle.importKey('raw', noegle, { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign'
	]);
	return new Uint8Array(await crypto.subtle.sign('HMAC', k, data)) as Bytes;
}

/** Standardens maade at lave én noegle om til en anden paa. */
async function udled(salt: Bytes, noegle: Bytes, info: Bytes, laengde: number): Promise<Bytes> {
	const prk = await hmac(salt, noegle);
	const ud = await hmac(prk, saml(info, byte(1)));
	return ud.slice(0, laengde) as Bytes;
}

// ── 1. Underskriften ────────────────────────────────────────

/**
 * Beviser at beskeden kommer fra os.
 *
 * Gyldig i 12 timer. Push-tjenesterne afviser noget der gaelder laengere,
 * saa den skal laves paa ny for hver omgang beskeder.
 */
async function underskrift(endpoint: string, n: PushNoegler): Promise<string> {
	const aud = new URL(endpoint).origin;
	const hoved = tilB64u(tekst(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
	const krav = tilB64u(
		tekst(
			JSON.stringify({
				aud,
				exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
				sub: n.kontakt
			})
		)
	);
	const data = tekst(`${hoved}.${krav}`);

	// Den private noegle staar som ét tal i miljoeet. Den offentlige er
	// de to koordinater, som vi pakker ud her, for browserens krypto vil
	// have dem hver for sig.
	const off = fraB64u(n.offentlig);
	const jwk: JsonWebKey = {
		kty: 'EC',
		crv: 'P-256',
		d: n.privat,
		x: tilB64u(off.slice(1, 33)),
		y: tilB64u(off.slice(33, 65)),
		ext: true
	};
	const k = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
		'sign'
	]);
	const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, data);
	return `${hoved}.${krav}.${tilB64u(sig)}`;
}

// ── 2. Laasen om indholdet ──────────────────────────────────

/**
 * Laaser beskeden, saa kun hendes telefon kan aabne den.
 *
 * Eksporteret alene for testens skyld. Den laaser op igen og tjekker at
 * der staar det samme, for den her slags fejler LYDLOEST: en byte galt
 * giver en besked telefonen bare smider vaek uden at sige noget.
 *
 * Fremgangsmaaden er skrevet ned i standarden RFC 8291. Roer den ikke
 * uden at have den ved siden af: hvert eneste skridt indgaar i noeglen,
 * og en enkelt byte forkert giver en besked telefonen bare smider vaek,
 * uden en fejl vi kan se.
 */
export async function laas(besked: string, adresse: PushAdresse): Promise<Bytes> {
	const modtagerRaa = fraB64u(adresse.p256dh);
	const hemmelighed = fraB64u(adresse.auth);

	// Et nyt noeglepar til netop den her besked.
	const mit = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits'
	]);
	const mitOffentligt = new Uint8Array(await crypto.subtle.exportKey('raw', mit.publicKey)) as Bytes;

	const modtager = await crypto.subtle.importKey(
		'raw',
		modtagerRaa,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[]
	);
	const faelles = new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: modtager }, mit.privateKey, 256)
	) as Bytes;

	const info = saml(tekst('WebPush: info'), byte(0), modtagerRaa, mitOffentligt);
	const ikm = await udled(hemmelighed, faelles, info, 32);

	const salt = crypto.getRandomValues(new Uint8Array(16));
	const cek = await udled(salt, ikm, saml(tekst('Content-Encoding: aes128gcm'), byte(0)), 16);
	const nonce = await udled(salt, ikm, saml(tekst('Content-Encoding: nonce'), byte(0)), 12);

	const n = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
	// 2-tallet til sidst betyder "det var den sidste bid".
	const indhold = saml(tekst(besked), byte(2));
	const laast = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, n, indhold)
	) as Bytes;

	// Hovedet telefonen laeser: salt, stoerrelse, og min offentlige noegle.
	const stoerrelse = new Uint8Array(new ArrayBuffer(4));
	new DataView(stoerrelse.buffer).setUint32(0, 4096);
	return saml(salt, stoerrelse, byte(mitOffentligt.length), mitOffentligt, laast);
}

/** Hvad der skete, saa kalderen kan rydde op i doede adresser. */
export interface PushResultat {
	ok: boolean;
	status: number;
	/** Telefonen findes ikke mere. Adressen skal slettes. */
	doed: boolean;
}

/**
 * Sender én besked til én telefon.
 *
 * Kaster ikke. En doed adresse er ikke en fejl, det er en kunde der har
 * slettet appen, og den skal bare ryddes vaek.
 */
export async function sendPush(
	adresse: PushAdresse,
	besked: unknown,
	noegler: PushNoegler
): Promise<PushResultat> {
	try {
		const krop = await laas(JSON.stringify(besked), adresse);
		const jwt = await underskrift(adresse.endpoint, noegler);
		const svar = await fetch(adresse.endpoint, {
			method: 'POST',
			headers: {
				Authorization: `vapid t=${jwt}, k=${noegler.offentlig}`,
				'Content-Encoding': 'aes128gcm',
				'Content-Type': 'application/octet-stream',
				// Fire timer. Er telefonen slukket laengere end det, er
				// "dagen er klar" ikke sand mere.
				TTL: '14400'
			},
			body: krop
		});
		return {
			ok: svar.ok,
			status: svar.status,
			// 404 og 410 betyder at tilmeldingen ikke findes mere.
			doed: svar.status === 404 || svar.status === 410
		};
	} catch (e) {
		console.error('[noti] kunne ikke sende', e);
		return { ok: false, status: 0, doed: false };
	}
}
