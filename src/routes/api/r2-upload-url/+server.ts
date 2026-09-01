// API-endpoint der genererer en pre-signed PUT-URL til Cloudflare R2.
// Klienten kalder hertil med filnavn + content-type, og får en URL hun kan
// uploade direkte til. Det er den smarte måde — file-data passerer aldrig
// gennem vores server, kun selve URL-genereringen.
//
// Authentication-flow:
//   1. Klient: POST /api/r2-upload-url med { filename, contentType } og
//      sit login-bevis i Authorization-linjen
//   2. Server: slaar beviset op og tjekker at det ER admin
//   3. Server: returnerer { uploadUrl, publicUrl }
//   4. Klient: PUT filen direkte til uploadUrl (binær body)
//   5. Klient: gemmer publicUrl i Firestore-feltet
//
// LAASEN KOM PAA 1. SEPTEMBER 2026. Noten ovenfor sagde allerede at
// serveren tjekkede admin, men koden gjorde det ikke: doeren stod aaben
// for alle der kendte adressen, og enhver kunne laegge filer i lageret.
// Fundet under diagnosen af lydbeskeder til én kunde.

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hvemErDet3 } from '$lib/server/notiSend';

interface RequestBody {
	filename: string;
	contentType: string;
}

function sluggify(navn: string): string {
	// Behold danske tegn og mellemrum, men erstat tegn der bryder URLs
	return navn
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const kalder = await hvemErDet3(auth.slice(7), PUBLIC_FIREBASE_API_KEY);
	if (!kalder?.erAdmin) throw error(403, 'Kun admin kan uploade filer');

	const accessKeyId = env.R2_ACCESS_KEY_ID;
	const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
	const endpoint = env.R2_ENDPOINT;
	const bucket = env.R2_BUCKET_NAME;
	const publicBaseUrl = env.R2_PUBLIC_URL;

	if (!accessKeyId || !secretAccessKey || !endpoint || !bucket || !publicBaseUrl) {
		console.error('R2-konfiguration mangler i environment variables');
		throw error(500, 'R2-konfiguration mangler');
	}

	let body: RequestBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const filename = sluggify(body.filename ?? '');
	const contentType = body.contentType ?? 'application/octet-stream';

	if (!filename) throw error(400, 'filename mangler');
	if (filename.length > 200) throw error(400, 'filename for langt');

	// Tilføj timestamp-prefix så samme filnavn ikke overskriver tidligere
	// uploads ved et uheld. Format: 1778312345-Min-fil.m4a
	const objectKey = `${Date.now()}-${filename}`;

	const client = new S3Client({
		region: 'auto',
		endpoint,
		credentials: {
			accessKeyId,
			secretAccessKey
		}
	});

	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: objectKey,
		ContentType: contentType
	});

	// URL'en gælder i 10 minutter — rigeligt til at uploade selv store filer
	const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });

	const publicUrl = `${publicBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(objectKey)}`;

	return json({ uploadUrl, publicUrl, objectKey });
};
