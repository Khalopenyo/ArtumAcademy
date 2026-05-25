'use client';

import { jsPDF } from 'jspdf';

import type { StoredCertificate } from '@/lib/store';

interface CertPdfInput {
  certificate: StoredCertificate;
  courseTitle: string;
  studentName: string;
}

/**
 * Генерирует PDF-сертификат Artum Academy на клиенте и возвращает blob.
 *
 * Дизайн (A4 landscape, тёмная тема ТЗ §2):
 *   - Фиолетовая рамка
 *   - ARTUM Academy лого (текстовое)
 *   - «СЕРТИФИКАТ» крупно
 *   - Имя студента
 *   - «успешно завершил курс»
 *   - Название курса
 *   - Дата выдачи
 *   - Номер для верификации
 */
export function generateCertificatePdf({
  certificate,
  courseTitle,
  studentName,
}: CertPdfInput): jsPDF {
  // A4 landscape: 297 × 210 mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Фон тёмный (palette ТЗ §2: #0D0D0F → почти чёрный)
  doc.setFillColor(13, 13, 15);
  doc.rect(0, 0, W, H, 'F');

  // Фиолетовая декоративная рамка
  doc.setDrawColor(168, 85, 247); // #A855F7
  doc.setLineWidth(1.5);
  doc.rect(10, 10, W - 20, H - 20);
  doc.setLineWidth(0.4);
  doc.rect(14, 14, W - 28, H - 28);

  // Brand — ARTUM Academy
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('ARTUM', W / 2 - 12, 32, { align: 'right' });
  doc.setTextColor(200, 132, 252); // светло-фиолетовый
  doc.setFont('helvetica', 'normal');
  doc.text('Academy', W / 2 - 8, 32);

  // Заголовок «СЕРТИФИКАТ»
  doc.setTextColor(168, 85, 247);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(52);
  doc.text('СЕРТИФИКАТ', W / 2, 70, { align: 'center' });

  // Подзаголовок
  doc.setTextColor(156, 163, 175); // muted-foreground
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('О ПРОХОЖДЕНИИ КУРСА', W / 2, 82, { align: 'center' });

  // Разделитель
  doc.setDrawColor(168, 85, 247);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 40, 90, W / 2 + 40, 90);

  // «Настоящим удостоверяется, что»
  doc.setTextColor(200, 200, 210);
  doc.setFontSize(13);
  doc.text('Настоящим удостоверяется, что', W / 2, 105, { align: 'center' });

  // Имя студента
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text(studentName, W / 2, 122, { align: 'center' });

  // Подчёркивание имени
  doc.setDrawColor(168, 85, 247);
  doc.setLineWidth(0.4);
  const nameWidth = doc.getTextWidth(studentName);
  doc.line(W / 2 - nameWidth / 2, 126, W / 2 + nameWidth / 2, 126);

  // «успешно завершил курс»
  doc.setTextColor(200, 200, 210);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('успешно завершил(а) курс', W / 2, 138, { align: 'center' });

  // Название курса
  doc.setTextColor(168, 85, 247);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  // Multi-line wrap if too long
  const titleLines = doc.splitTextToSize(`«${courseTitle}»`, W - 60);
  let cursorY = 155;
  for (const line of titleLines.slice(0, 2)) {
    doc.text(line, W / 2, cursorY, { align: 'center' });
    cursorY += 9;
  }

  // Дата + номер (футер)
  const issueDate = new Date(certificate.issuedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  doc.setTextColor(156, 163, 175);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Дата выдачи: ${issueDate}`, 30, H - 25);
  doc.text(`Номер: ${certificate.verificationNumber}`, W - 30, H - 25, { align: 'right' });

  // Линия в футере
  doc.setDrawColor(42, 42, 48);
  doc.setLineWidth(0.3);
  doc.line(30, H - 20, W - 30, H - 20);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text(
    'Artum Academy · artum.academy · Проверить подлинность можно по номеру',
    W / 2,
    H - 15,
    { align: 'center' },
  );

  return doc;
}

/**
 * Скачивает сертификат как файл `artum-cert-<номер>.pdf`.
 */
export function downloadCertificatePdf(input: CertPdfInput): void {
  const doc = generateCertificatePdf(input);
  doc.save(`artum-cert-${input.certificate.verificationNumber}.pdf`);
}
