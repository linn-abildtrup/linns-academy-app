// Storage helpers for Linn's Academy
// Wraps Firebase Storage operations so the rest of the app can stay simple.
// Videos live in /exercises/, audio files live in /audio/.

import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { storage } from '$lib/firebase';

/**
 * Returns a download URL for an exercise video.
 * Videos are stored at /exercises/{filename} in Firebase Storage.
 *
 * The URL is signed and short-lived. Cache it in the consumer if needed.
 *
 * @example
 * const url = await getVideoUrl('incline_pushup.mp4');
 * videoElement.src = url;
 */
export async function getVideoUrl(filename: string): Promise<string> {
	if (!filename) {
		throw new Error('getVideoUrl: filename is required');
	}
	const storageRef = ref(storage, `exercises/${filename}`);
	return getDownloadURL(storageRef);
}

/**
 * Returns a download URL for an audio file.
 * Audio files are stored at /audio/{filename} in Firebase Storage.
 *
 * @example
 * const url = await getAudioUrl('baggrundsmusik.mp3');
 * audioElement.src = url;
 */
export async function getAudioUrl(filename: string): Promise<string> {
	if (!filename) {
		throw new Error('getAudioUrl: filename is required');
	}
	const storageRef = ref(storage, `audio/${filename}`);
	return getDownloadURL(storageRef);
}

/**
 * Returns a download URL for a file at an arbitrary path in Storage.
 * Use this for paths outside /exercises/ and /audio/.
 *
 * @example
 * const url = await getStorageUrl('admin/manual.pdf');
 */
export async function getStorageUrl(path: string): Promise<string> {
	if (!path) {
		throw new Error('getStorageUrl: path is required');
	}
	const storageRef = ref(storage, path);
	return getDownloadURL(storageRef);
}

/**
 * Uploader en HTML-fil til Firebase Storage og returnerer download-URL'en.
 * Filen gemmes på /forlob/{forlobId}/html/{timestamp}-{filename} så vi
 * undgår navne-kollisioner hvis Linn uploader samme filnavn flere gange.
 *
 * Content-type sættes eksplicit til text/html så browsere åbner filen
 * som HTML i stedet for at downloade den.
 *
 * @example
 * const url = await uploadHtmlFil('kickstart_maj_2026', file);
 * lektion.url = url;
 */
export async function uploadHtmlFil(forlobId: string, fil: File): Promise<string> {
	if (!forlobId) throw new Error('uploadHtmlFil: forlobId er påkrævet');
	if (!fil) throw new Error('uploadHtmlFil: fil er påkrævet');
	const safe = fil.name.replace(/[^a-zA-Z0-9._-]/g, '_');
	const path = `forlob/${forlobId}/html/${Date.now()}-${safe}`;
	const storageRef = ref(storage, path);
	await uploadBytes(storageRef, fil, { contentType: 'text/html; charset=utf-8' });
	return getDownloadURL(storageRef);
}

/**
 * Uploader en lydfil til Cloudflare R2 og returnerer den public URL.
 * Bruger /api/r2-upload-url-endpointet til at få en pre-signed URL og
 * uploader så filen direkte til R2 derfra (file-data passerer ikke gennem
 * vores Cloudflare Pages Function).
 *
 * Lydfiler er typisk store (10-50 MB) — pre-signed-flowet undgår at vi
 * skal håndtere store filer i serverless-funktioner.
 *
 * @example
 * const url = await uploadLydFil(file);
 * lektion.url = url;
 */
export async function uploadLydFil(fil: File): Promise<string> {
	if (!fil) throw new Error('uploadLydFil: fil er påkrævet');

	// 1. Hent pre-signed URL fra vores API
	const res = await fetch('/api/r2-upload-url', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			filename: fil.name,
			contentType: fil.type || 'audio/mpeg'
		})
	});
	if (!res.ok) {
		const tekst = await res.text().catch(() => '');
		throw new Error(`Kunne ikke få upload-URL (${res.status}): ${tekst}`);
	}
	const { uploadUrl, publicUrl } = (await res.json()) as {
		uploadUrl: string;
		publicUrl: string;
	};

	// 2. Upload filen direkte til R2 via PUT
	const upload = await fetch(uploadUrl, {
		method: 'PUT',
		headers: {
			'Content-Type': fil.type || 'audio/mpeg'
		},
		body: fil
	});
	if (!upload.ok) {
		throw new Error(`R2-upload fejlede (${upload.status})`);
	}

	return publicUrl;
}
