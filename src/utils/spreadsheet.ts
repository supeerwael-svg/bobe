import * as XLSX from 'xlsx';
import { downloadBlob } from '@/utils/download';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function saveWorkbook(workbook: XLSX.WorkBook, filename: string): void {
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  void downloadBlob(new Blob([bytes], { type: XLSX_MIME }), filename);
}

export function exportRowsToExcel(rows: Record<string, string | number>[], sheetName: string, filename: string): void {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  saveWorkbook(workbook, filename);
}

export interface WorkbookSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
  footer: (string | number)[] | null;
}

export function exportSheetsToExcel(sheets: WorkbookSheet[], filename: string): void {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows, ...(sheet.footer ? [sheet.footer] : [])];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), sheet.name);
  }
  saveWorkbook(workbook, filename);
}

export function exportHeaderTemplate(headers: string[], sheetName: string, filename: string): void {
  const sheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  saveWorkbook(workbook, filename);
}

export async function readFirstSheet(file: File): Promise<unknown[][]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const firstName = workbook.SheetNames[0];
  if (!firstName) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstName], {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  });
}
