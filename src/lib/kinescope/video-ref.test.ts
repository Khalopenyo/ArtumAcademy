import { describe, expect, it } from 'vitest';

import { parseLessonVideo } from './video-ref';

const UUID = '0e7a3f1c-2b4d-4e6a-8c9f-1a2b3c4d5e6f';

describe('parseLessonVideo', () => {
  it('возвращает none для пустых значений', () => {
    expect(parseLessonVideo(null)).toEqual({ kind: 'none' });
    expect(parseLessonVideo(undefined)).toEqual({ kind: 'none' });
    expect(parseLessonVideo('')).toEqual({ kind: 'none' });
    expect(parseLessonVideo('   ')).toEqual({ kind: 'none' });
  });

  it('распознаёт голый UUID как Kinescope', () => {
    expect(parseLessonVideo(UUID)).toEqual({ kind: 'kinescope', videoId: UUID });
  });

  it('распознаёт короткий голый id как Kinescope', () => {
    expect(parseLessonVideo('qB8xKzLm7')).toEqual({ kind: 'kinescope', videoId: 'qB8xKzLm7' });
  });

  it('поддерживает явный префикс kinescope:<id>', () => {
    expect(parseLessonVideo(`kinescope:${UUID}`)).toEqual({ kind: 'kinescope', videoId: UUID });
    expect(parseLessonVideo('KINESCOPE:qB8xKzLm7')).toEqual({
      kind: 'kinescope',
      videoId: 'qB8xKzLm7',
    });
  });

  it('извлекает id из kinescope.io URL (разные пути)', () => {
    expect(parseLessonVideo(`https://kinescope.io/${UUID}`)).toEqual({
      kind: 'kinescope',
      videoId: UUID,
    });
    expect(parseLessonVideo(`https://kinescope.io/embed/${UUID}`)).toEqual({
      kind: 'kinescope',
      videoId: UUID,
    });
    expect(parseLessonVideo('https://kinescope.io/watch/qB8xKzLm7')).toEqual({
      kind: 'kinescope',
      videoId: 'qB8xKzLm7',
    });
  });

  it('обычный http(s) URL (demo-моки) трактует как file', () => {
    const mock = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    expect(parseLessonVideo(mock)).toEqual({ kind: 'file', url: mock });
    expect(parseLessonVideo('https://example.com/lesson.webm')).toEqual({
      kind: 'file',
      url: 'https://example.com/lesson.webm',
    });
  });

  it('мусорные не-URL значения → none', () => {
    expect(parseLessonVideo('video.mp4')).toEqual({ kind: 'none' }); // точка → не голый id
    expect(parseLessonVideo('kinescope:')).toEqual({ kind: 'none' }); // префикс без id
    expect(parseLessonVideo('a b c')).toEqual({ kind: 'none' });
  });

  it('обрезает пробелы вокруг значения', () => {
    expect(parseLessonVideo(`  ${UUID}  `)).toEqual({ kind: 'kinescope', videoId: UUID });
  });
});
