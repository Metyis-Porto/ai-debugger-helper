import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    toDataURL: () => 'data:image/png;base64,AAA'
  }))
}));

describe('captureScreenshot', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('passes document.documentElement.clientWidth/clientHeight, not window.innerWidth/innerHeight', async () => {
    // window.innerWidth can lag document.documentElement.clientWidth during a
    // live resize gesture in some browsers — see the comment in
    // screenshot.ts for why the layout-driven value is the correct source.
    Object.defineProperty(window, 'innerWidth', { value: 999, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 888, configurable: true });
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 640,
      configurable: true
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 480,
      configurable: true
    });

    const html2canvas = (await import('html2canvas')).default;
    const { captureScreenshot } = await import('./screenshot.js');
    await captureScreenshot();

    expect(html2canvas).toHaveBeenCalledWith(
      document.documentElement,
      expect.objectContaining({ windowWidth: 640, windowHeight: 480 })
    );
  });

  it('returns the PNG data URL produced by html2canvas', async () => {
    const { captureScreenshot } = await import('./screenshot.js');
    await expect(captureScreenshot()).resolves.toBe('data:image/png;base64,AAA');
  });
});
