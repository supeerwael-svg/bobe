import { DAILY_REPORT_CSS } from '@/utils/dailyPageHtml';
import { downloadBlob } from '@/utils/download';
import { isNativeApp } from '@/utils/platform';

export function printDailyPages(pages: string[], title: string, lang: string, dir: 'ltr' | 'rtl'): void {
  const html = `<!doctype html>\n<html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${title}</title><style>${DAILY_REPORT_CSS}</style></head><body style="margin:0">${pages.join('')}</body></html>`;

  if (isNativeApp) {
    const fileName = title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'report';
    void downloadBlob(new Blob([html], { type: 'text/html' }), `${fileName}.html`);
    return;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => frame.remove();
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(cleanup, 60_000);
  }, 300);
}
