import { describe, expect, it } from 'vitest';

import { caseVideoEmbedUrl } from './cases';

describe('caseVideoEmbedUrl', () => {
  it('RuTube video → embed', () => {
    expect(caseVideoEmbedUrl('https://rutube.ru/video/abc123def4567890abcdef1234567890/')).toBe(
      'https://rutube.ru/play/embed/abc123def4567890abcdef1234567890',
    );
  });

  it('RuTube embed link тоже распознаётся', () => {
    expect(caseVideoEmbedUrl('https://rutube.ru/play/embed/deadbeef')).toBe(
      'https://rutube.ru/play/embed/deadbeef',
    );
  });

  it('YouTube watch → embed', () => {
    expect(caseVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('youtu.be → embed', () => {
    expect(caseVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('YouTube shorts → embed', () => {
    expect(caseVideoEmbedUrl('https://youtube.com/shorts/abc123XYZ')).toBe(
      'https://www.youtube.com/embed/abc123XYZ',
    );
  });

  it('Vimeo → embed', () => {
    expect(caseVideoEmbedUrl('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789',
    );
  });

  it('VK Video → embed', () => {
    expect(caseVideoEmbedUrl('https://vk.com/video-12345_67890')).toBe(
      'https://vk.com/video_ext.php?oid=-12345&id=67890&hd=2',
    );
  });

  it('vkvideo.ru → embed', () => {
    expect(caseVideoEmbedUrl('https://vkvideo.ru/video12345_67890')).toBe(
      'https://vk.com/video_ext.php?oid=12345&id=67890&hd=2',
    );
  });

  it('неизвестный провайдер → null (не встраиваем чужой iframe)', () => {
    expect(caseVideoEmbedUrl('https://example.com/video/123')).toBeNull();
    expect(caseVideoEmbedUrl('https://evil.com/rutube.ru/video/abc')).toBeNull();
  });

  it('пусто / не-URL → null', () => {
    expect(caseVideoEmbedUrl(null)).toBeNull();
    expect(caseVideoEmbedUrl('')).toBeNull();
    expect(caseVideoEmbedUrl('   ')).toBeNull();
    expect(caseVideoEmbedUrl('просто текст')).toBeNull();
  });
});
