// Tests for storage helpers
// These tests verify input validation and path construction.
// We mock Firebase Storage so tests run without network access.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/firebase', () => ({
	storage: { mock: 'storage-instance' }
}));

const refMock = vi.fn();
const getDownloadURLMock = vi.fn();

vi.mock('firebase/storage', () => ({
	ref: (...args: unknown[]) => refMock(...args),
	getDownloadURL: (...args: unknown[]) => getDownloadURLMock(...args)
}));

import { getVideoUrl, getAudioUrl, getStorageUrl } from './storage';

describe('getVideoUrl', () => {
	beforeEach(() => {
		refMock.mockReset();
		getDownloadURLMock.mockReset();
		refMock.mockReturnValue({ fullPath: 'mocked-ref' });
		getDownloadURLMock.mockResolvedValue('https://example.com/video.mp4');
	});

	it('builds a path under /exercises/', async () => {
		await getVideoUrl('incline_pushup.mp4');
		expect(refMock).toHaveBeenCalledWith(
			{ mock: 'storage-instance' },
			'exercises/incline_pushup.mp4'
		);
	});

	it('returns the download URL from Firebase', async () => {
		const url = await getVideoUrl('squat.mp4');
		expect(url).toBe('https://example.com/video.mp4');
	});

	it('throws if filename is empty', async () => {
		await expect(getVideoUrl('')).rejects.toThrow('filename is required');
	});
});

describe('getAudioUrl', () => {
	beforeEach(() => {
		refMock.mockReset();
		getDownloadURLMock.mockReset();
		refMock.mockReturnValue({ fullPath: 'mocked-ref' });
		getDownloadURLMock.mockResolvedValue('https://example.com/audio.mp3');
	});

	it('builds a path under /audio/', async () => {
		await getAudioUrl('baggrundsmusik.mp3');
		expect(refMock).toHaveBeenCalledWith({ mock: 'storage-instance' }, 'audio/baggrundsmusik.mp3');
	});

	it('returns the download URL from Firebase', async () => {
		const url = await getAudioUrl('nedtaelling-go.mp3');
		expect(url).toBe('https://example.com/audio.mp3');
	});

	it('throws if filename is empty', async () => {
		await expect(getAudioUrl('')).rejects.toThrow('filename is required');
	});
});

describe('getStorageUrl', () => {
	beforeEach(() => {
		refMock.mockReset();
		getDownloadURLMock.mockReset();
		refMock.mockReturnValue({ fullPath: 'mocked-ref' });
		getDownloadURLMock.mockResolvedValue('https://example.com/file');
	});

	it('passes the full path through unchanged', async () => {
		await getStorageUrl('admin/manual.pdf');
		expect(refMock).toHaveBeenCalledWith({ mock: 'storage-instance' }, 'admin/manual.pdf');
	});

	it('throws if path is empty', async () => {
		await expect(getStorageUrl('')).rejects.toThrow('path is required');
	});
});
