import { downloadBlob } from '@/utils/download';
import { isNativeApp } from '@/utils/platform';

export interface PrintableSection {
  heading: string | null;
  headers: string[];
  rows: string[][];
  footer: string[] | null;
}

export interface PrintableReport {
  title: string;
  subtitle: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  sections: PrintableSection[];
}

const PRINT_STYLES = `
  body { font-family: Cairo, Inter, system-ui, sans-serif; color: #171717; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 24px 0 8px; break-after: avoid; }
  p { font-size: 12px; color: #525252; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #d4d4d4; padding: 8px; text-align: start; }
  th { background: #f5f5f5; font-weight: 600; }
  td.num, th.num { text-align: end; }
  tr.footer td { font-weight: 700; background: #fafafa; }
  tr { break-inside: avoid; }
  @page { size: A4 landscape; margin: 14mm; }
`;

export function printReport(report: PrintableReport): void {
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

  doc.documentElement.lang = report.lang;
  doc.documentElement.dir = report.dir;
  doc.title = report.title;
  const style = doc.createElement('style');
  style.textContent = PRINT_STYLES;
  doc.head.appendChild(style);

  const heading = doc.createElement('h1');
  heading.textContent = report.title;
  const subtitle = doc.createElement('p');
  subtitle.textContent = report.subtitle;
  doc.body.append(heading, subtitle);

  for (const section of report.sections) {
    if (section.heading) {
      const sectionHeading = doc.createElement('h2');
      sectionHeading.textContent = section.heading;
      doc.body.appendChild(sectionHeading);
    }
    doc.body.appendChild(buildTable(doc, section));
  }

  const cleanup = () => frame.remove();
  if (isNativeApp) {
    cleanup();
    const html = `<!doctype html>\n${doc.documentElement.outerHTML}`;
    const fileName = report.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'report';
    void downloadBlob(new Blob([html], { type: 'text/html' }), `${fileName}.html`);
    return;
  }
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(cleanup, 60_000);
  }, 100);
}

function buildTable(doc: Document, section: PrintableSection): HTMLTableElement {
  const grid = doc.createElement('table');
  const thead = grid.createTHead();
  const headRow = thead.insertRow();
  section.headers.forEach((header, index) => {
    const cell = doc.createElement('th');
    cell.textContent = header;
    if (index > 0) cell.className = 'num';
    headRow.appendChild(cell);
  });

  const tbody = grid.createTBody();
  for (const values of section.rows) {
    const row = tbody.insertRow();
    values.forEach((value, index) => {
      const cell = row.insertCell();
      cell.textContent = value;
      if (index > 0) cell.className = 'num';
    });
  }

  if (section.footer) {
    const footRow = tbody.insertRow();
    footRow.className = 'footer';
    section.footer.forEach((value, index) => {
      const cell = footRow.insertCell();
      cell.textContent = value;
      if (index > 0) cell.className = 'num';
    });
  }
  return grid;
}
