// Klient-side billede-komprimering.
//
// Kunde-billeder fra kamera/galleri kan være 3-5 MB. Sendt direkte til AI-
// vision (analyser-opskrift) gør det kaldet langsomt og dyrt, og som
// thumbnail i Storage er det spild af plads. Vi skalerer ned til maxDim på
// længste side og re-encoder som JPEG — markant mindre uden synligt
// kvalitetstab til formålet (aflæse en opskrift / vise et lille kort).

/** Indlæser en data-URL i et Image-element. */
function indlaesBillede(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Kunne ikke indlæse billede'));
		img.src = src;
	});
}

/** Læser en Blob/File som data-URL. */
function blobTilDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

/**
 * Komprimerer et billede til en JPEG-Blob, skaleret så længste side højst er
 * maxDim px. Falder tilbage til original-filen hvis canvas ikke er
 * tilgængeligt, eller hvis komprimering ikke gjorde filen mindre.
 */
export async function komprimerBillede(fil: File, maxDim = 1200, kvalitet = 0.8): Promise<Blob> {
	if (typeof document === 'undefined') return fil; // SSR-guard
	try {
		const dataUrl = await blobTilDataUrl(fil);
		const img = await indlaesBillede(dataUrl);

		let width = img.width;
		let height = img.height;
		if (width > maxDim || height > maxDim) {
			if (width >= height) {
				height = Math.round((height / width) * maxDim);
				width = maxDim;
			} else {
				width = Math.round((width / height) * maxDim);
				height = maxDim;
			}
		}

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return fil;
		ctx.drawImage(img, 0, 0, width, height);

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', kvalitet)
		);
		// Behold original hvis komprimering fejlede eller gjorde filen større.
		return blob && blob.size < fil.size ? blob : fil;
	} catch (e) {
		console.warn('Billede-komprimering fejlede, bruger original:', e);
		return fil;
	}
}

/** Ren base64 (uden "data:...;base64,"-præfix) af en Blob/File. */
export function blobTilBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const r = reader.result as string;
			const komma = r.indexOf(',');
			resolve(komma >= 0 ? r.slice(komma + 1) : r);
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}
