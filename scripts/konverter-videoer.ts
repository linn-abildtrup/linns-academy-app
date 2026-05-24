// Batch-konverter .mov-filer til .mp4 med samme indstillinger som de
// eksisterende oevelses-videoer paa Firebase Storage:
//   - 1280px bredde (HD), aspect ratio bevares
//   - H.264 (libx264), CRF 25
//   - Ingen lyd (oevelses-videoerne har ikke lyd)
//
// Output: .mp4-fil i samme mappe som input, lowercase snake_case-navn.
// Eksisterende .mp4 med samme navn overskrives.
//
// Brug:
//   npx tsx scripts/konverter-videoer.ts "videos-to-upload/Ny øvelser"

import { execFileSync } from 'child_process';
import { readdirSync, statSync, existsSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FFMPEG = join(__dirname, 'bin', 'ffmpeg');

function tilSnakeCase(navn: string): string {
	return navn
		.toLowerCase()
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.replace(/\s+/g, '_')
		.replace(/[^a-z0-9._-]/g, '_')
		.replace(/_+/g, '_');
}

function formatStorrelse(bytes: number): string {
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function main() {
	const mappe = process.argv[2];
	if (!mappe) {
		console.error('Brug: npx tsx scripts/konverter-videoer.ts <mappe>');
		process.exit(1);
	}
	if (!existsSync(mappe)) {
		console.error(`Mappe findes ikke: ${mappe}`);
		process.exit(1);
	}

	if (!existsSync(FFMPEG)) {
		console.error(`ffmpeg ikke fundet paa ${FFMPEG}`);
		process.exit(1);
	}

	const filer = readdirSync(mappe)
		.filter((f) => extname(f).toLowerCase() === '.mov')
		.sort();

	if (filer.length === 0) {
		console.log(`Ingen .mov-filer i ${mappe}`);
		return;
	}

	console.log(`Konverterer ${filer.length} .mov-fil(er) i ${mappe}\n`);

	let ok = 0;
	let fejl = 0;
	const resultater: { input: string; output: string; foerMb: number; efterMb: number }[] = [];

	for (let i = 0; i < filer.length; i++) {
		const inputNavn = filer[i];
		const inputSti = join(mappe, inputNavn);
		const outputNavn = tilSnakeCase(basename(inputNavn, extname(inputNavn))) + '.mp4';
		const outputSti = join(mappe, outputNavn);

		const inputBytes = statSync(inputSti).size;
		console.log(`[${i + 1}/${filer.length}] ${inputNavn} (${formatStorrelse(inputBytes)}) → ${outputNavn}`);

		try {
			execFileSync(
				FFMPEG,
				[
					'-i', inputSti,
					'-vcodec', 'libx264',
					'-crf', '25',
					'-preset', 'slow',
					'-vf', 'scale=1280:-2',
					'-an',
					'-y',
					'-loglevel', 'error',
					outputSti
				],
				{ stdio: ['ignore', 'inherit', 'inherit'] }
			);
			const outputBytes = statSync(outputSti).size;
			const reduktion = (100 - (outputBytes / inputBytes) * 100).toFixed(1);
			console.log(`        ${formatStorrelse(outputBytes)} (${reduktion}% mindre)\n`);
			resultater.push({
				input: inputNavn,
				output: outputNavn,
				foerMb: inputBytes / 1024 / 1024,
				efterMb: outputBytes / 1024 / 1024
			});
			ok++;
		} catch (e) {
			console.error(`        FEJL: ${(e as Error).message}\n`);
			fejl++;
		}
	}

	console.log('='.repeat(60));
	console.log(`Sammenfatning: ${ok} ok, ${fejl} fejl`);
	if (resultater.length > 0) {
		const foer = resultater.reduce((s, r) => s + r.foerMb, 0);
		const efter = resultater.reduce((s, r) => s + r.efterMb, 0);
		console.log(`Total: ${foer.toFixed(1)} MB → ${efter.toFixed(1)} MB`);
	}
}

main();
