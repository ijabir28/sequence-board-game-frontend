import { describe, expect, it, vi } from 'vitest';
import { shareOrDownload } from './shareFile';

const file = new File(['png'], 'result.png', { type: 'image/png' });
const details = { title: 'Sequence', text: 'Team Green wins' };

function domError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe('shareOrDownload', () => {
  it('opens the share sheet with the image where files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const download = vi.fn();
    const outcome = await shareOrDownload(file, details, { navigator: { share, canShare: () => true }, download });
    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Sequence', text: 'Team Green wins' });
    expect(download).not.toHaveBeenCalled();
  });

  it('treats a closed share sheet as cancelled, without downloading', async () => {
    const download = vi.fn();
    const share = vi.fn().mockRejectedValue(domError('AbortError'));
    expect(await shareOrDownload(file, details, { navigator: { share, canShare: () => true }, download })).toBe('cancelled');
    expect(download).not.toHaveBeenCalled();
  });

  it('downloads when the browser refuses the share', async () => {
    const download = vi.fn();
    const share = vi.fn().mockRejectedValue(domError('NotAllowedError'));
    expect(await shareOrDownload(file, details, { navigator: { share, canShare: () => true }, download })).toBe('downloaded');
    expect(download).toHaveBeenCalledWith(file);
  });

  it('downloads where files cannot be shared, or there is no Web Share at all', async () => {
    const download = vi.fn();
    const share = vi.fn();
    expect(await shareOrDownload(file, details, { navigator: { share, canShare: () => false }, download })).toBe('downloaded');
    expect(await shareOrDownload(file, details, { navigator: {} as Navigator, download })).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledTimes(2);
  });
});
