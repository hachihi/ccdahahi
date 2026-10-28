import type ExcelJS from 'exceljs';
import { downloadCsv } from './dahahiService';

/* ------------------------------------------------------------------ */
/* Mô tả một bảng báo cáo - dùng chung cho mọi mẫu                      */
/* ------------------------------------------------------------------ */

export interface ReportColumn {
  header: string;
  width?: number; // độ rộng cột trong Excel (ký tự)
  align?: 'left' | 'center' | 'right';
}

export interface ReportTable {
  company?: string; // tên đơn vị (dòng đầu)
  title: string;
  subtitle: string; // kỳ báo cáo + bộ lọc
  columns: ReportColumn[];
  rows: (string | number)[][];
  totalsRow?: (string | number)[]; // dòng tổng cộng (tuỳ chọn)
  signatures?: string[]; // vd: ['Người lập biểu', 'Kế toán', 'Giám đốc']
  fileName: string; // không gồm đuôi
}

const todayVi = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

export const exportCsv = (t: ReportTable) => {
  const rows = t.totalsRow ? [...t.rows, t.totalsRow] : t.rows;
  downloadCsv(`${t.fileName}.csv`, t.columns.map(c => c.header), rows);
};

/* ------------------------------------------------------------------ */
/* Excel .xlsx thật (exceljs, nạp khi bấm xuất để không nặng bundle)    */
/* ------------------------------------------------------------------ */

export const exportXlsx = async (t: ReportTable) => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dahahi Attendance';
  wb.created = new Date();
  const ws = wb.addWorksheet('Báo cáo', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '5:5',
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 }
    },
    headerFooter: { oddFooter: '&LNgày in: &D&CTrang &P / &N' }
  });

  const nCols = t.columns.length;
  const thin = { style: 'thin' as const, color: { argb: 'FF94A3B8' } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  ws.columns = t.columns.map(c => ({ width: c.width || Math.max(12, c.header.length + 4) }));

  // Dòng 1: đơn vị, 2: tiêu đề, 3: kỳ báo cáo, 4: trống, 5: header bảng
  const company = ws.getRow(1);
  company.getCell(1).value = t.company || '';
  company.getCell(1).font = { bold: true, size: 11 };
  ws.mergeCells(1, 1, 1, nCols);

  ws.getRow(2).getCell(1).value = t.title;
  ws.getRow(2).getCell(1).font = { bold: true, size: 16, color: { argb: 'FF065F46' } };
  ws.getRow(2).getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 28;
  ws.mergeCells(2, 1, 2, nCols);

  ws.getRow(3).getCell(1).value = t.subtitle;
  ws.getRow(3).getCell(1).font = { italic: true, size: 10 };
  ws.getRow(3).getCell(1).alignment = { horizontal: 'center' };
  ws.mergeCells(3, 1, 3, nCols);

  const head = ws.getRow(5);
  head.height = 32;
  t.columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = border;
  });

  t.rows.forEach((r, ri) => {
    const row = ws.getRow(6 + ri);
    r.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.border = border;
      cell.alignment = { horizontal: t.columns[ci].align || 'center', vertical: 'middle' };
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });
  });

  let next = 6 + t.rows.length;
  if (t.totalsRow) {
    const row = ws.getRow(next++);
    t.totalsRow.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { bold: true };
      cell.border = border;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      cell.alignment = { horizontal: t.columns[ci].align || 'center', vertical: 'middle' };
    });
  }

  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: nCols } };

  // Phần ký xác nhận
  if (t.signatures && t.signatures.length) {
    next += 2;
    ws.getRow(next).getCell(nCols).value = `Ngày ${todayVi()}`;
    ws.getRow(next).getCell(nCols).alignment = { horizontal: 'right' };
    ws.getRow(next).getCell(nCols).font = { italic: true };
    next++;
    const step = Math.max(1, Math.floor(nCols / t.signatures.length));
    t.signatures.forEach((s, i) => {
      const col = Math.min(nCols, 1 + i * step + Math.floor(step / 2));
      const c = ws.getRow(next).getCell(col);
      c.value = s;
      c.font = { bold: true };
      c.alignment = { horizontal: 'center' };
      const c2 = ws.getRow(next + 1).getCell(col);
      c2.value = '(Ký, ghi rõ họ tên)';
      c2.font = { italic: true, size: 9 };
      c2.alignment = { horizontal: 'center' };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${t.fileName}.xlsx`
  );
};

/* ------------------------------------------------------------------ */
/* PDF: mở cửa sổ in A4 ngang, người dùng chọn "Lưu dạng PDF"           */
/* ------------------------------------------------------------------ */

const esc = (v: string | number): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Trả về false nếu trình duyệt chặn cửa sổ bật lên */
export const exportPdf = (t: ReportTable): boolean => {
  const w = window.open('', '_blank');
  if (!w) return false;

  const ths = t.columns.map(c => `<th>${esc(c.header)}</th>`).join('');
  const trs = t.rows
    .map(
      r =>
        `<tr>${r
          .map((v, i) => `<td style="text-align:${t.columns[i].align || 'center'}">${esc(v)}</td>`)
          .join('')}</tr>`
    )
    .join('');
  const total = t.totalsRow
    ? `<tr class="total">${t.totalsRow
        .map((v, i) => `<td style="text-align:${t.columns[i].align || 'center'}">${esc(v)}</td>`)
        .join('')}</tr>`
    : '';
  const sigs = (t.signatures || [])
    .map(s => `<div class="sig"><b>${esc(s)}</b><br/><i>(Ký, ghi rõ họ tên)</i></div>`)
    .join('');

  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"/>
<title>${esc(t.fileName)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm 14mm;
    @bottom-center { content: "Trang " counter(page) " / " counter(pages); font-size: 9pt; color:#475569; } }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color:#0f172a; }
  .company { font-weight: bold; }
  h1 { text-align:center; color:#065f46; font-size:16pt; margin:6px 0 2px; }
  .sub { text-align:center; font-style:italic; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background:#047857; color:#fff; border:1px solid #64748b; padding:5px 4px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  td { border:1px solid #94a3b8; padding:3px 4px; }
  tbody tr:nth-child(even) td { background:#f1f5f9; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  tr.total td { font-weight:bold; background:#d1fae5 !important; }
  .sigs { display:flex; justify-content:space-around; margin-top:28px; page-break-inside:avoid; }
  .sig { text-align:center; min-width:180px; height:90px; }
  .date { text-align:right; font-style:italic; margin-top:18px; }
</style></head><body>
${t.company ? `<div class="company">${esc(t.company)}</div>` : ''}
<h1>${esc(t.title)}</h1>
<div class="sub">${esc(t.subtitle)}</div>
<table><thead><tr>${ths}</tr></thead><tbody>${trs}${total}</tbody></table>
${sigs ? `<div class="date">Ngày ${todayVi()}</div><div class="sigs">${sigs}</div>` : ''}
<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
</body></html>`);
  w.document.close();
  return true;
};
