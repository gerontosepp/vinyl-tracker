import { TestBed } from '@angular/core/testing';
import { IMAGE_DOWNSCALER, LABEL_PHOTO_MAX_EDGE, downscaleImage, fitWithin } from './image';

describe('image utils', () => {
  it('fits large photos into the max edge keeping the aspect ratio', () => {
    expect(fitWithin(4000, 3000, 1568)).toEqual({ width: 1568, height: 1176 });
    expect(fitWithin(3000, 4000, 1568)).toEqual({ width: 1176, height: 1568 });
  });

  it('never upscales small photos', () => {
    expect(fitWithin(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  });

  describe('downscaleImage', () => {
    const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' });
    let drawImage: ReturnType<typeof vi.fn>;
    let close: ReturnType<typeof vi.fn>;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      drawImage = vi.fn();
      close = vi.fn();
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue({ width: 4000, height: 2000, close })
      );
      canvas = document.createElement('canvas');
      vi.spyOn(canvas, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
      vi.spyOn(canvas, 'toBlob').mockImplementation((callback, type) =>
        callback(type === 'image/jpeg' ? jpeg : null)
      );
      const createElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
        tag === 'canvas' ? canvas : createElement(tag)
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('draws the photo downscaled and encodes it as JPEG', async () => {
      const result = await downscaleImage(new Blob(['heic'], { type: 'image/heic' }));

      expect(result).toBe(jpeg);
      expect(canvas.width).toBe(LABEL_PHOTO_MAX_EDGE);
      expect(canvas.height).toBe(784);
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1568, 784);
      expect(close).toHaveBeenCalled();
    });

    it('fails when the photo cannot be encoded', async () => {
      vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => callback(null));
      await expect(downscaleImage(jpeg)).rejects.toThrow('Failed to encode photo');
      expect(close).toHaveBeenCalled();
    });

    it('is provided as the default image downscaler', async () => {
      const downscale = TestBed.inject(IMAGE_DOWNSCALER);
      await expect(downscale(jpeg)).resolves.toBe(jpeg);
    });

    it('fails without a 2D canvas context', async () => {
      vi.spyOn(canvas, 'getContext').mockReturnValue(null);
      await expect(downscaleImage(jpeg)).rejects.toThrow('Canvas 2D context not available');
    });
  });
});
