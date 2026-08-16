// AI-vaerktoejet til at bygge traeningsprogrammer. 16. august 2026.
// Koerer paa Cloudflare Pages Workers runtime, saa firebase-admin virker
// ikke. Firestore naas gennem $lib/server/firestoreRest.
//
// Nyt endpoint ved siden af. /api/ny-ai og /api/linn-ai er uroerte.
//
// DEN REGEL DER BAERER DET HELE: AI'en maa aldrig finde paa en oevelse.
// Oevelserne sendes med som en pulje, prompten siger at der kun maa
// vaelges derfra, og svaret valideres i rensSvar3 paa vej ud. Alt der
// ikke findes, smides vaek. Samme moenster som foreslaa-madplan.
//
// Auth: Firebase ID-token, og emailen skal staa i ADMIN_EMAILS. Kunden
// faar ikke vaerktoejet endnu, se SPEC 29.10.
//
// Graense: 60 om dagen for admin. Kundernes AI-funktioner har 20, og de
// deler ikke taeller med den her. Et program tager fem til ti beskeder,
// saa 20 ville kun raekke til to eller tre programmer om dagen. Spaerren
// mod en loebsk fejl er der stadig. Linns valg 16. august.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { ADMIN_EMAILS } from '$lib/admin';
import { hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import { quotaNoegle } from '$lib/content/linnAi';
import type { TrainingDay } from '$lib/content/mikrotraening';
import {
	MAX_AI_DAGE,
	MAX_AI_PR_DAG,
	MAX_BESKEDER,
	MAX_BESKED_TEGN,
	MAX_RET_DAGE,
	rensSvar3,
	type AiBesked3,
	type AiSvarRaa3
} from '$lib/content/traeningAi3';

const MODEL = 'claude-opus-5';
const MAX_TOKENS = 8000;
/** Samtalerne gemmes en maaned, saa et maerkeligt program kan opklares. */
const MAANED = 30 * 86400000;

async function verificerAdminToken(idToken: string): Promise<string | null> {
	if (!PUBLIC_FIREBASE_API_KEY) return null;
	try {
		const res = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${PUBLIC_FIREBASE_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken })
			}
		);
		if (!res.ok) return null;
		const data = (await res.json()) as { users?: Array<{ localId: string; email?: string }> };
		const bruger = data.users?.[0];
		const email = bruger?.email?.toLowerCase() ?? null;
		if (!email || !bruger?.localId) return null;
		const adminListe = (ADMIN_EMAILS as readonly string[]).map((e) => e.toLowerCase());
		return adminListe.includes(email) ? bruger.localId : null;
	} catch {
		return null;
	}
}

interface AiRequest {
	/** 'nyt' laver et program. 'ret' aendrer dage i et der findes. */
	tilstand?: 'nyt' | 'ret';
	beskeder?: AiBesked3[];
	/** Skriver AI'en ogsaa titler og en kort tekst. Linns flueben. */
	medTekst?: boolean;
	kategoriNavn?: string;
	/** Oevelserne AI'en maa vaelge fra. Filtreret paa kategorien. */
	oevelser?: Array<{ id: string; name: string; catLabel: string; udstyr: string[] }>;
	oensketAntalDage?: number;
	/** Kun ved 'ret'. */
	programNavn?: string;
	programAntalDage?: number;
	dage?: TrainingDay[];
	/** Samtalens id, saa den kan findes igen hvis noget gaar galt. */
	samtaleId?: string;
}

const REGLER = `Du er dansk træningsvejleder og hjælper Linn med at bygge et træningsprogram til kvinder i overgangsalderen.

DEN VIGTIGSTE REGEL: du må KUN bruge øvelser fra den øvelsesliste du får i den næste system-blok. Du må ALDRIG finde på en øvelse eller skrive et navn der ikke står på listen. Hver øvelse i listen har et id, og du skal bruge id'et præcis som det står. En øvelse der ikke findes har ingen video, og så står kunden med en tom skærm midt i en træning.

Mangler der øvelser til det hun beder om, så SIG DET og foreslå en vej videre. Find aldrig på noget for at fylde et hul.

Du opretter ikke kategorier. Beder hun om udstyr der ikke er i listen, siger du at kategorien mangler.

Sådan svarer du: kun ét JSON-objekt, ingen tekst udenom, ingen kodeblok.

{
  "svar": "det du siger til hende, i almindeligt dansk, kort",
  "navn": "programmets navn",
  "beskrivelse": "en linje om hvad programmet er",
  "antalDage": 14,
  "dage": [
    {
      "titel": "",
      "indledning": "",
      "oevelser": [
        { "exerciseId": "id-fra-listen", "sets": 3, "workSec": 30, "restSec": 10, "bonus": false }
      ]
    }
  ]
}

Regler for felterne:
- "svar" skal ALTID stå. Det er det eneste hun læser i samtalen.
- Mangler du noget for at kunne foreslå, så stil ET spørgsmål i "svar" og lad "dage" stå som en tom liste. Gæt aldrig.
- "dage" må højst indeholde ${MAX_AI_DAGE} dage. Skal programmet være længere, så design de første ${MAX_AI_DAGE} som en skabelon og sæt "antalDage" til det fulde tal. Koden fordeler skabelonen ud over hele programmet.
- 3 til 5 øvelser pr dag med mindre hun beder om andet.
- Fordel benøvelser, overkropsøvelser og core jævnt over ugen.
- "sets" 1 til 20, "workSec" 5 til 600, "restSec" 0 til 600.
- Sæt "bonus" til true på en øvelse hun må springe over.`;

const TEKST_TIL = `\n\nHun har bedt om titler: skriv en kort "titel" på hver dag og en "indledning" på højst to sætninger.`;
const TEKST_FRA = `\n\nHun har IKKE bedt om titler: lad "titel" og "indledning" stå tomme.`;

function oevelsesKatalog(
	oevelser: NonNullable<AiRequest['oevelser']>,
	kategoriNavn: string
): string {
	const linjer = oevelser.map((e) => {
		const udstyr =
			e.udstyr.length === 0 || e.udstyr.every((u) => u === 'ingen')
				? 'ingen redskaber'
				: e.udstyr.join(', ');
		return `${e.id} | ${e.name} | ${e.catLabel} | ${udstyr}`;
	});
	return `ØVELSESLISTEN${kategoriNavn ? ` for kategorien "${kategoriNavn}"` : ''}. Format: id | navn | gruppe | udstyr.
Du må kun vælge herfra, og du skal bruge id'et præcis som det står.

${linjer.join('\n')}`;
}

function retKontekst(body: AiRequest): string {
	const dage = body.dage ?? [];
	const linjer = dage.map((d) => {
		const oev = d.exercises
			.map((o) => `${o.exerciseId} (${o.sets}x${o.workSec}s, pause ${o.restSec}s)`)
			.join('; ');
		return `Dag ${d.dagNummer}: ${oev}`;
	});
	return `DU RETTER ET PROGRAM DER FINDES: "${body.programNavn ?? ''}" på ${body.programAntalDage ?? dage.length} dage.

Du får KUN de dage hendes sætning handler om. Rør ikke andet, og foreslå ikke ændringer til dage du ikke har fået. Svar med de samme dagnumre du fik, i "dage", i samme rækkefølge.

${linjer.join('\n')}`;
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare env');

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const uid = await verificerAdminToken(auth.slice(7));
	if (!uid) throw error(403, 'Ikke autoriseret som admin');

	let body: AiRequest;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const beskeder = Array.isArray(body.beskeder) ? body.beskeder : [];
	if (beskeder.length === 0) throw error(400, 'Der er ingen besked at svare på');
	if (beskeder.length > MAX_BESKEDER) throw error(400, 'Samtalen er for lang. Start en ny.');
	if (beskeder.some((b) => typeof b.tekst !== 'string' || b.tekst.length > MAX_BESKED_TEGN)) {
		throw error(400, 'En besked er for lang');
	}
	const oevelser = Array.isArray(body.oevelser) ? body.oevelser : [];
	if (oevelser.length === 0) throw error(400, 'Der er ingen øvelser at vælge imellem');

	const erRet = body.tilstand === 'ret';
	if (erRet && (body.dage ?? []).length > MAX_RET_DAGE) {
		throw error(400, `Der kan højst rettes ${MAX_RET_DAGE} dage ad gangen`);
	}

	// Admin har sin egen taeller. Kundernes 20 er uroerte.
	const noegle = quotaNoegle();
	const quotaPath = `users/${uid}/traeningAiQuotaer/${noegle}`;
	const quotaDoc = (await hentDoc(quotaPath)) as { antal?: number } | null;
	const antalIDag = quotaDoc?.antal ?? 0;
	if (antalIDag >= MAX_AI_PR_DAG) {
		throw error(
			429,
			`Du har brugt AI-samtalen ${MAX_AI_PR_DAG} gange i dag. Den åbner igen i morgen.`
		);
	}

	const system = [
		{ type: 'text', text: REGLER + (body.medTekst ? TEKST_TIL : TEKST_FRA) },
		{
			type: 'text',
			text: oevelsesKatalog(oevelser, body.kategoriNavn ?? ''),
			// Oevelseslisten er den samme hele samtalen igennem, saa den
			// caches. Den er den dyre del af hvert kald.
			cache_control: { type: 'ephemeral' }
		}
	];
	if (erRet) system.push({ type: 'text', text: retKontekst(body) });

	const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: MODEL,
			max_tokens: MAX_TOKENS,
			thinking: { type: 'adaptive' },
			system,
			messages: beskeder.map((b) => ({
				role: b.rolle === 'bruger' ? 'user' : 'assistant',
				content: b.tekst
			}))
		})
	});

	if (!anthropicRes.ok) {
		const errText = await anthropicRes.text();
		console.error('[traening-ai] Anthropic svarede ikke:', anthropicRes.status, errText);
		throw error(502, 'AI-tjenesten svarede ikke. Prøv igen.');
	}
	const anthropicData = (await anthropicRes.json()) as {
		content: Array<{ type: string; text?: string }>;
	};
	const tekst = anthropicData.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('');

	let jsonTekst = tekst.trim();
	if (jsonTekst.startsWith('```')) {
		jsonTekst = jsonTekst.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
	}
	let raa: AiSvarRaa3;
	try {
		raa = JSON.parse(jsonTekst) as AiSvarRaa3;
	} catch {
		console.error('[traening-ai] kunne ikke laese svaret:', tekst.slice(0, 500));
		throw error(502, 'AI gav et svar i forkert format. Prøv igen.');
	}

	// Her smides alt vaek der ikke findes i banken. Se traeningAi3.
	// Puljen er den samme liste som blev sendt til AI'en, saa der kan
	// ikke slippe en oevelse igennem som den ikke maatte vaelge.
	const svar = rensSvar3(
		raa,
		oevelser.map((e) => ({ id: e.id, aktiv: true })),
		body.medTekst === true,
		erRet ? (body.dage ?? []).length : (body.oensketAntalDage ?? MAX_AI_DAGE)
	);

	// Ved 'ret' faar dagene deres rigtige numre tilbage. AI'en svarer i
	// den raekkefoelge den fik dem, og numrene er dem der blev sendt.
	if (erRet && svar.forslag) {
		const numre = (body.dage ?? []).map((d) => d.dagNummer);
		svar.forslag.dage = svar.forslag.dage
			.slice(0, numre.length)
			.map((d, i) => ({ ...d, dagNummer: numre[i] }));
	}

	await gemDocMerge(quotaPath, { antal: antalIDag + 1, sidste: Date.now() });

	// Samtalen gemmes, saa det kan opklares hvad der gik galt hvis et
	// program bliver maerkeligt. Der ligger ingen kundedata i den.
	if (body.samtaleId) {
		try {
			await gemDocMerge(`traeningAiSamtaler3/${body.samtaleId}`, {
				uid,
				tilstand: erRet ? 'ret' : 'nyt',
				beskeder: [...beskeder, { rolle: 'ai', tekst: svar.svar }],
				sidsteForslag: svar.forslag ? JSON.stringify(svar.forslag).slice(0, 20000) : '',
				opdateretAt: Date.now(),
				udloeberAt: Date.now() + MAANED
			});
		} catch (e) {
			// Samtalen er en log, ikke funktionen. Kan den ikke gemmes,
			// skal hun stadig faa sit svar.
			console.warn('[traening-ai] kunne ikke gemme samtalen', e);
		}
	}

	return json(svar);
};
