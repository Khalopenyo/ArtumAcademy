'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface KinescopeUploadButtonProps {
  /** Название видео в Kinescope (обычно — заголовок урока). */
  title: string;
  /** Вызывается с videoId после успешной загрузки. */
  onUploaded: (videoId: string) => void;
  label?: string;
}

/**
 * Кнопка «Загрузить видео»: выбор файла → POST /api/admin/videos (стримом) →
 * прогресс через XHR (fetch не отдаёт прогресс аплоада) → onUploaded(videoId).
 * Сам файл уходит на наш сервер, оттуда — в Kinescope; токен в браузер не идёт.
 */
export function KinescopeUploadButton({
  title,
  onUploaded,
  label = 'Загрузить видео',
}: KinescopeUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // позволяем выбрать тот же файл снова
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Выберите видео-файл');
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/videos');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-Video-Title', encodeURIComponent(title || file.name));

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      let res: { ok?: boolean; videoId?: string; error?: string } | null = null;
      try {
        res = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300 && res?.ok && res.videoId) {
        toast.success('Видео загружено в Kinescope');
        onUploaded(res.videoId);
      } else {
        toast.error(res?.error ?? `Ошибка загрузки (${xhr.status})`);
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      toast.error('Сеть прервалась при загрузке');
    };

    setProgress(0);
    xhr.send(file);
  }

  const uploading = progress !== null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
            {progress}%
          </>
        ) : (
          <>
            <Upload className="mr-1 size-4" aria-hidden />
            {label}
          </>
        )}
      </Button>
    </>
  );
}
