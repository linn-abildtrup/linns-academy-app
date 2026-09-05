// ============================================================
// Tager skaermbillederne til onboardingens rundvisning.
//
// DET HER SCRIPT SLETTES IKKE. Det er ikke en engangs-opgave, det er et
// vaerktoej: hver gang en af de skaerme aendrer sig, koeres det igen, og
// saa er billederne friske. Det var hele grunden til at bygge det frem
// for at tage billederne i haanden.
//
// Brug:  npm run skaermbilleder
//
// Det er alt. Scriptet starter selv appen hvis den ikke koerer, og
// lukker den ned igen bagefter.
//
// Koderne til de to testkonti staar i .env, som er i .gitignore og
// derfor ALDRIG kommer paa GitHub:
//
//   LA_FORLOB_KODE=...      test-forlob@linnsacademy.dk
//   LA_MEDLEM_KODE=...      test-medlem@linnsacademy.dk
//
// Billederne lander i static/onboarding/ som webp. Filnavnene er dem der
// staar i rundvisningskort3, se content/onboarding3.ts, saa de to lister
// ikke kan drive fra hinanden.
// ============================================================

import { mkdir, rm } from 'fs/promises';
import { existsSync, readFileSync, statSync } from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UD = join(__dirname, '..', 'static', 'onboarding');

const ROD = join(__dirname, '..');
const BASIS = process.env.LA_BASIS_URL ?? 'http://localhost:5173';

/**
 * Laeser .env selv. Scripts koeres med tsx og ikke gennem Vite, saa de
 * faar ikke SvelteKits env-haandtering med. Kun linjer vi mangler
 * saettes, saa noget der allerede staar i miljoeet vinder.
 */
function laesEnv() {
	const sti = join(ROD, '.env');
	if (!existsSync(sti)) return;
	for (const linje of readFileSync(sti, 'utf-8').split('\n')) {
		const m = linje.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
		if (!m) continue;
		const vaerdi = m[2].trim().replace(/^['"]|['"]$/g, '');
		if (!process.env[m[1]]) process.env[m[1]] = vaerdi;
	}
}
laesEnv();

/** iPhone 14. Appen er en telefon-app, saa billederne skal vaere det ogsaa. */
const TELEFON = { width: 390, height: 844, deviceScaleFactor: 3 };

/** Bredden billedet gemmes i. Kortet er hoejst 360 px bredt paa en telefon. */
const GEM_BREDDE = 720;

type Konto = 'forlob' | 'medlem';

interface Optagelse {
	/** Skal matche feltet `billede` paa kortet i onboarding3.ts. */
	fil: string;
	konto: Konto;
	sti: string;
	/**
	 * Det udsnit der skal fanges, som en CSS-vaelger. Playwright klipper
	 * selv praecis om elementet, saa der skal ikke beskaeres bagefter.
	 *
	 * 'skaerm' betyder den SYNLIGE skaerm, altsaa det man ser paa en
	 * telefon. Brug den til hele sider. Vaelgeren .ny-scroll blev proevet
	 * foerst og duer ikke: den daekker hele rulle-omraadet, saa halvdelen
	 * af billedet blev bar baggrund under indholdet.
	 */
	udsnit: string;
	/** Hvad billedet skal vise, saa en fejl kan opdages med oejnene. */
	hvad: string;
	/** Noget der skal goeres paa siden foer billedet tages. */
	forbered?: 'skridt' | 'samtale';
}

const OPTAGELSER: Optagelse[] = [
	{
		fil: 'rundt',
		konto: 'forlob',
		sti: '/ny',
		udsnit: '.ny-nav',
		hvad: 'Bundmenuens fem knapper'
	},
	{
		fil: 'forside-forlob',
		konto: 'forlob',
		sti: '/ny',
		udsnit: 'skaerm',
		forbered: 'skridt',
		hvad: 'Forsiden for en forloebskunde, med en foldet sektion'
	},
	{
		fil: 'forside-medlem',
		konto: 'medlem',
		sti: '/ny',
		udsnit: 'skaerm',
		hvad: 'Forsiden for et medlem'
	},
	{
		fil: 'mad',
		konto: 'medlem',
		sti: '/ny/30-30/frokost',
		udsnit: 'skaerm',
		hvad: 'Maaltidsskaermen med Tilfoej-knappen'
	},
	{
		fil: 'traening',
		konto: 'forlob',
		sti: '/ny/traening',
		udsnit: 'skaerm',
		hvad: 'Mikrotraening med programmerne'
	},
	{
		fil: 'linn',
		konto: 'forlob',
		sti: '/ny/beskeder',
		udsnit: 'skaerm',
		forbered: 'samtale',
		hvad: 'Beskeder med et svar og send-videre-linjen'
	},
	{
		fil: 'maaling',
		konto: 'forlob',
		sti: '/ny',
		udsnit: '.score',
		hvad: 'Kortet Dit overskud med kurven'
	}
];

const KONTI: Record<Konto, { email: string; kodeNoegle: string }> = {
	forlob: { email: 'test-forlob@linnsacademy.dk', kodeNoegle: 'LA_FORLOB_KODE' },
	medlem: { email: 'test-medlem@linnsacademy.dk', kodeNoegle: 'LA_MEDLEM_KODE' }
};

function kode(konto: Konto): string {
	const noegle = KONTI[konto].kodeNoegle;
	const v = process.env[noegle];
	if (!v) {
		console.error(`\nMangler ${noegle}. Skriv den i .env:\n  ${noegle}=...\n`);
		process.exit(1);
	}
	return v;
}

/** Svarer appen paa BASIS lige nu. */
async function appenKoerer(): Promise<boolean> {
	try {
		const svar = await fetch(BASIS, { method: 'HEAD' });
		return svar.ok;
	} catch {
		return false;
	}
}

/**
 * Starter dev-serveren hvis den ikke allerede koerer, og giver den
 * tilbage saa vi kan lukke den igen. Koerer den i forvejen, roerer vi
 * den ikke: saa er det Linns eget vindue, og det skal ikke doe.
 */
async function sikreAppen(): Promise<ChildProcess | null> {
	if (await appenKoerer()) {
		console.log('Appen koerer i forvejen. Bruger den.');
		return null;
	}

	console.log('Starter appen');
	const proces = spawn('npm', ['run', 'dev'], { cwd: ROD, stdio: 'ignore', detached: false });

	for (let i = 0; i < 60; i++) {
		await new Promise((r) => setTimeout(r, 1000));
		if (await appenKoerer()) {
			console.log('Appen er klar');
			return proces;
		}
	}

	proces.kill();
	console.error(`\nAppen svarede ikke paa ${BASIS} inden for et minut.\n`);
	process.exit(1);
}

/**
 * Testkontiene har ikke vaeret gennem onboarding, og porten paa forsiden
 * sender dem derfor til /ny/velkommen. Uden det her ville hvert eneste
 * billede vise opstarten i stedet for appen.
 *
 * Vi saetter feltet direkte, saa scriptet ikke skal klikke sig gennem
 * elleve skaerme hver gang. Det roerer KUN de to testkonti.
 */
async function sikreOnboardet() {
	const { initializeApp, cert, getApps } = await import('firebase-admin/app');
	const { getFirestore } = await import('firebase-admin/firestore');
	const { getAuth } = await import('firebase-admin/auth');

	const noegle = join(__dirname, 'service-account-key.json');
	if (!existsSync(noegle)) {
		console.log('Ingen service-account-key.json. Springer onboarding-flaget over.');
		return;
	}

	if (getApps().length === 0) {
		initializeApp({ credential: cert(JSON.parse(readFileSync(noegle, 'utf-8'))) });
	}
	const db = getFirestore();
	const auth = getAuth();

	for (const k of Object.values(KONTI)) {
		try {
			const bruger = await auth.getUserByEmail(k.email);
			const doc = db.collection('users').doc(bruger.uid);
			const snap = await doc.get();
			if (!snap.get('onboardet3')) {
				await doc.update({ onboardet3: Date.now() });
				console.log(`  ${k.email}: sat som onboardet`);
			}
		} catch (e) {
			console.warn(`  kunne ikke saette onboardet3 paa ${k.email}:`, String(e).split('\n')[0]);
		}
	}
}

/**
 * Venter til der ikke staar noget der henter paa skaermen.
 *
 * Uden den her fik vi et billede af forsiden hvor AI-hilsenen stod og
 * sagde "Et oejeblik". Billedet var teknisk korrekt og alligevel
 * ubrugeligt, og den slags opdages kun med oejnene.
 */
async function ventPaaFaerdig(side: import('playwright').Page) {
	for (let i = 0; i < 15; i++) {
		const venter = await side
			.getByText(/et øjeblik|henter|tænker/i)
			.count()
			.catch(() => 0);
		if (venter === 0) return;
		await side.waitForTimeout(1000);
	}
	// Giver den ikke slip, tager vi billedet alligevel og siger det ikke
	// her. Det staar i advarslerne naar mennesket kigger billedet igennem.
}

/**
 * Saetter flueben ved dagens smaa skridt, saa sektionen folder sig
 * sammen. Kortet lover netop at ting folder sig med et flueben, og uden
 * det viser billedet ikke det teksten siger.
 *
 * Skriver paa testkontoen. Linns ja 16. august.
 */
async function forberedSkridt(side: import('playwright').Page) {
	const bokse = side.locator('.skridt-liste .boks');
	const antal = await bokse.count().catch(() => 0);
	for (let i = 0; i < antal; i++) {
		const b = bokse.nth(i);
		if ((await b.getAttribute('aria-pressed')) === 'true') continue;
		await b.click().catch(() => {});
		await side.waitForTimeout(700);
	}
	// Foldningen sker foerst naar alle er klaret, saa siden hentes igen.
	if (antal > 0) {
		await side.reload({ waitUntil: 'domcontentloaded' });
		await side.waitForTimeout(3000);
	}
}

/**
 * Stiller AI'en ét spoergsmaal, saa samtalen og send-videre-linjen er
 * paa skaermen. Uden det viser billedet en tom side, og kortet handler
 * netop om at kunne sende svaret videre til Linn.
 *
 * Koster ét rigtigt AI-kald pr koersel. Linns ja 16. august.
 */
async function forberedSamtale(side: import('playwright').Page) {
	const alt = await side
		.locator('.boble')
		.count()
		.catch(() => 0);
	if (alt > 0) return; // Der ligger allerede en samtale fra sidst.

	const felt = side.locator('.skrivelinje textarea');
	if ((await felt.count()) === 0) return;
	await felt.fill('Hvor meget protein skal jeg have om morgenen?');
	await side
		.locator('.skrivelinje .send')
		.click()
		.catch(() => {});

	// AI'en tager et par sekunder. Vi venter paa selve svaret.
	await side
		.locator('.boble.svar')
		.first()
		.waitFor({ state: 'visible', timeout: 45_000 })
		.catch(() => {});
	await side.waitForTimeout(1500);
}

async function main() {
	// Playwright hentes foerst naar scriptet koeres, saa det ikke ligger og
	// fylder i projektet for alle andre.
	let chromium;
	try {
		({ chromium } = await import('playwright'));
	} catch {
		console.error(
			'\nPlaywright mangler. Installer det med:\n' +
				'  npm i -D playwright && npx playwright install chromium\n'
		);
		process.exit(1);
	}

	await sikreOnboardet();
	const dev = await sikreAppen();
	await mkdir(UD, { recursive: true });

	// Browseren hentes foerste gang scriptet koeres. Playwright siger selv
	// klart fra, saa vi oversaetter det til noget man kan handle paa.
	let browser;
	try {
		browser = await chromium.launch();
	} catch (e) {
		dev?.kill();
		console.error(
			'\nKunne ikke starte browseren. Foerste gang skal den hentes:\n' +
				'  npx playwright install chromium\n'
		);
		console.error(String(e).split('\n')[0]);
		process.exit(1);
	}
	let taget = 0;
	const advarsler: string[] = [];

	for (const konto of ['forlob', 'medlem'] as Konto[]) {
		const opgaver = OPTAGELSER.filter((o) => o.konto === konto);
		if (opgaver.length === 0) continue;

		const kontekst = await browser.newContext({
			viewport: { width: TELEFON.width, height: TELEFON.height },
			deviceScaleFactor: TELEFON.deviceScaleFactor,
			isMobile: true,
			hasTouch: true,
			locale: 'da-DK'
		});
		const side = await kontekst.newPage();

		console.log(`\nLogger ind som ${KONTI[konto].email}`);
		await side.goto(`${BASIS}/login`, { waitUntil: 'domcontentloaded' });

		// Foerst velkomst-skaermen, saa selve formularen. Der er INGEN
		// <form> paa siden, submit er en komponent med onclick, saa vi
		// klikker paa knappen inde i .form og ikke paa en submit-type.
		await side.getByRole('button', { name: 'Log ind' }).first().click();
		await side.locator('.form input[type="email"]').fill(KONTI[konto].email);
		await side.locator('.form input[type="password"]').fill(kode(konto));
		await side
			.locator('.form')
			.getByRole('button', { name: /log ind|vent/i })
			.first()
			.click();

		await side.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 });
		console.log('  logget ind');

		for (const o of opgaver) {
			// IKKE networkidle. Firestore holder en aaben forbindelse til
			// serveren, saa netvaerket bliver ALDRIG stille, og siden ville
			// vente til den gav op. Vi venter paa indholdet i stedet.
			await side.goto(`${BASIS}${o.sti}`, { waitUntil: 'domcontentloaded' });

			const helSkaerm = o.udsnit === 'skaerm';
			const maal = helSkaerm ? null : side.locator(o.udsnit).first();
			await maal?.waitFor({ state: 'visible', timeout: 25_000 }).catch(() => {});

			// Appen henter stadig data efter foerste optegning.
			await side.waitForTimeout(3000);

			if (o.forbered === 'skridt') await forberedSkridt(side);
			if (o.forbered === 'samtale') await forberedSamtale(side);

			// Ventetegnet er den fjende der er svaerest at se: billedet er
			// teknisk korrekt og viser bare "Et oejeblik". Vi bliver ved til
			// der ikke staar noget der venter paa skaermen.
			await ventPaaFaerdig(side);

			const findes = helSkaerm || (await maal!.count()) > 0;
			if (!findes) {
				advarsler.push(`${o.fil}: fandt ikke "${o.udsnit}", tog hele skaermen i stedet`);
			}

			const raa =
				findes && maal
					? await maal.screenshot({ type: 'png' })
					: await side.screenshot({ type: 'png' });

			const ud = join(UD, `${o.fil}.webp`);
			await sharp(raa)
				.resize({ width: GEM_BREDDE, withoutEnlargement: true })
				.webp({ quality: 82 })
				.toFile(ud);

			const kb = Math.round(statSync(ud).size / 1024);
			console.log(`  ${o.fil}.webp  ${kb} KB  ${o.hvad}`);
			taget += 1;
		}

		await kontekst.close();
	}

	await browser.close();
	// Kun hvis VI startede den. Var det Linns eget vindue, bliver det staaende.
	dev?.kill();

	console.log(`\n${taget} af ${OPTAGELSER.length} billeder i static/onboarding/`);
	if (advarsler.length > 0) {
		console.log('\nSe her:');
		advarsler.forEach((a) => console.log(`  ${a}`));
	}
	console.log('\nKig dem igennem foer du committer. Et billede kan sagtens vaere');
	console.log('teknisk korrekt og alligevel vise et ventetegn eller en tom liste.\n');
}

// Ryd op hvis nogen beder om det, fx foer en helt frisk optagelse.
if (process.argv.includes('--slet')) {
	if (existsSync(UD)) await rm(UD, { recursive: true });
	console.log('static/onboarding/ er ryddet.');
	process.exit(0);
}

await main();
