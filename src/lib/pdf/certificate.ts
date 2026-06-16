'use client';

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

import { PT_SANS_BOLD_B64, PT_SANS_REGULAR_B64 } from './fonts/pt-sans';

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://artumacademy.ru';

interface CertPdfCertificate {
  verificationNumber: string;
  issuedAt: string;
}

interface CertPdfInput {
  certificate: CertPdfCertificate;
  courseTitle: string;
  studentName: string;
}

/**
 * Генерирует PDF-сертификат Artum Academy (A4 landscape, тёмная космо-тема):
 *   рамка с угловыми акцентами · монограмма-бейдж «A» · «СЕРТИФИКАТ» ·
 *   имя студента · название курса · подпись · круглая печать ·
 *   QR-код на страницу проверки /verify/<номер>.
 * Async — QR генерируется в data-URL.
 */
export async function generateCertificatePdf({
  certificate,
  courseTitle,
  studentName,
}: CertPdfInput): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('PTSans-Regular.ttf', PT_SANS_REGULAR_B64);
  doc.addFont('PTSans-Regular.ttf', 'PTSans', 'normal');
  doc.addFileToVFS('PTSans-Bold.ttf', PT_SANS_BOLD_B64);
  doc.addFont('PTSans-Bold.ttf', 'PTSans', 'bold');

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Фон — глубокий космический фиолет
  doc.setFillColor(10, 6, 24);
  doc.rect(0, 0, W, H, 'F');

  // Двойная рамка
  doc.setDrawColor(168, 85, 247);
  doc.setLineWidth(1.4);
  doc.rect(9, 9, W - 18, H - 18);
  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(0.4);
  doc.rect(13, 13, W - 26, H - 26);

  // Угловые акценты
  doc.setDrawColor(196, 168, 255);
  doc.setLineWidth(0.8);
  const c = 9;
  const k = 8;
  for (const [cx, cy, dx, dy] of [
    [c, c, 1, 1],
    [W - c, c, -1, 1],
    [c, H - c, 1, -1],
    [W - c, H - c, -1, -1],
  ] as const) {
    doc.line(cx, cy, cx + dx * k, cy);
    doc.line(cx, cy, cx, cy + dy * k);
  }

  // Монограмма-бейдж «A» (top center)
  const bs = 15;
  const bx = W / 2 - bs / 2;
  const by = 17;
  doc.setFillColor(168, 85, 247);
  doc.roundedRect(bx, by, bs, bs, 3.4, 3.4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('PTSans', 'bold');
  doc.setFontSize(19);
  doc.text('A', W / 2, by + bs / 2 + 3, { align: 'center' });

  // Brand
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont('PTSans', 'bold');
  doc.text('ARTUM', W / 2 - 1, by + bs + 8, { align: 'right' });
  doc.setTextColor(196, 168, 255);
  doc.setFont('PTSans', 'normal');
  doc.text('Academy', W / 2 + 1, by + bs + 8);

  // Заголовок
  doc.setTextColor(168, 85, 247);
  doc.setFont('PTSans', 'bold');
  doc.setFontSize(46);
  doc.text('СЕРТИФИКАТ', W / 2, 68, { align: 'center' });
  doc.setTextColor(156, 163, 175);
  doc.setFont('PTSans', 'normal');
  doc.setFontSize(12);
  doc.text('О ПРОХОЖДЕНИИ КУРСА', W / 2, 78, { align: 'center' });
  doc.setDrawColor(168, 85, 247);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 38, 84, W / 2 + 38, 84);

  // Имя
  doc.setTextColor(200, 200, 210);
  doc.setFontSize(12);
  doc.text('Настоящим удостоверяется, что', W / 2, 97, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFont('PTSans', 'bold');
  doc.setFontSize(30);
  doc.text(studentName, W / 2, 113, { align: 'center' });
  doc.setDrawColor(168, 85, 247);
  doc.setLineWidth(0.4);
  const nw = doc.getTextWidth(studentName);
  doc.line(W / 2 - nw / 2, 117, W / 2 + nw / 2, 117);

  // Курс
  doc.setTextColor(200, 200, 210);
  doc.setFont('PTSans', 'normal');
  doc.setFontSize(12);
  doc.text('успешно завершил(а) курс', W / 2, 128, { align: 'center' });
  doc.setTextColor(196, 168, 255);
  doc.setFont('PTSans', 'bold');
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(`«${courseTitle}»`, W - 90) as string[];
  let cy = 141;
  for (const line of titleLines.slice(0, 2)) {
    doc.text(line, W / 2, cy, { align: 'center' });
    cy += 8.5;
  }

  // ── Низ: подпись · печать · QR ──
  // Подпись (left)
  doc.setDrawColor(120, 120, 140);
  doc.setLineWidth(0.4);
  doc.line(38, 176, 92, 176);
  doc.setTextColor(255, 255, 255);
  doc.setFont('PTSans', 'bold');
  doc.setFontSize(11);
  doc.text('Artum Academy', 65, 182, { align: 'center' });
  doc.setTextColor(156, 163, 175);
  doc.setFont('PTSans', 'normal');
  doc.setFontSize(8.5);
  doc.text('образовательная платформа', 65, 187, { align: 'center' });
  const issueDate = new Date(certificate.issuedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  doc.text(`Выдан: ${issueDate}`, 65, 192, { align: 'center' });

  // Печать (center)
  const sx = W / 2;
  const sy = 178;
  doc.setDrawColor(168, 85, 247);
  doc.setLineWidth(0.7);
  doc.circle(sx, sy, 12);
  doc.setLineWidth(0.3);
  doc.circle(sx, sy, 9.6);
  doc.setTextColor(168, 85, 247);
  doc.setFont('PTSans', 'bold');
  doc.setFontSize(13);
  doc.text('A', sx, sy + 0.5, { align: 'center' });
  doc.setFont('PTSans', 'normal');
  doc.setFontSize(5.4);
  doc.setTextColor(196, 168, 255);
  doc.text('ARTUM · ACADEMY', sx, sy + 6.5, { align: 'center' });

  // QR (right)
  const qrUrl = `${SITE}/verify/${certificate.verificationNumber}`;
  const qr = await QRCode.toDataURL(qrUrl, {
    margin: 0,
    width: 320,
    color: { dark: '#0B0712', light: '#FFFFFF' },
  });
  const qs = 24;
  const qx = W - 32 - qs;
  const qy = 162;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qx - 2, qy - 2, qs + 4, qs + 4, 2, 2, 'F');
  doc.addImage(qr, 'PNG', qx, qy, qs, qs);
  doc.setTextColor(156, 163, 175);
  doc.setFont('PTSans', 'normal');
  doc.setFontSize(8);
  doc.text('Проверка подлинности', qx + qs / 2, qy + qs + 5, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 130);
  doc.text(`№ ${certificate.verificationNumber}`, qx + qs / 2, qy + qs + 9, { align: 'center' });

  return doc;
}

/**
 * Скачивает сертификат как файл `artum-cert-<номер>.pdf`.
 */
export async function downloadCertificatePdf(input: CertPdfInput): Promise<void> {
  const doc = await generateCertificatePdf(input);
  doc.save(`artum-cert-${input.certificate.verificationNumber}.pdf`);
}
