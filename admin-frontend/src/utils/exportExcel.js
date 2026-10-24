const BRAND = 'MyStaff Smart';
const BRAND_COLOR = '0B7867';
const HEADER_COLOR = '075D50';
const PALE_ROW = 'F2FAF8';
const BORDER_COLOR = 'C9DED8';

const columnName = (index) => {
  let result = '';
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

const safeCellValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' && /^\s*[=+@-]/.test(value)) return `'${value}`;
  return value;
};

const readableTitle = (filename) => filename
  .replace(/\.(xlsx|xls|csv)$/i, '')
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatGeneratedAt = () => new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
}).format(new Date());

const normalizedFilename = (filename) => {
  const base = String(filename || 'report').replace(/\.(xlsx|xls|csv)$/i, '');
  return `${base}.xlsx`;
};

/** Downloads a real, styled XLSX workbook used by every console report. */
export async function downloadExcel(filename, report) {
  const headers = Array.isArray(report?.headers) ? report.headers : [];
  const rows = Array.isArray(report?.rows) ? report.rows : [];
  if (!headers.length) throw new Error('The report does not have any columns to export.');

  // Keep the heavy XLSX writer out of the normal dashboard bundle. It loads
  // only when an authorized user explicitly downloads a report.
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND;
  workbook.created = new Date();
  workbook.modified = new Date();
  const worksheet = workbook.addWorksheet(String(report?.sheetName || 'Report').slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    properties: { defaultRowHeight: 20 },
  });

  const finalColumn = columnName(headers.length);
  worksheet.mergeCells(`A1:${finalColumn}1`);
  worksheet.getCell('A1').value = `${BRAND} | ${report?.title || readableTitle(filename)}`;
  worksheet.getCell('A1').font = { name: 'Aptos Display', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_COLOR}` } };
  worksheet.getCell('A1').alignment = { vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells(`A2:${finalColumn}2`);
  worksheet.getCell('A2').value = `${report?.subtitle || `${rows.length.toLocaleString('en-IN')} record${rows.length === 1 ? '' : 's'}`} · Generated ${formatGeneratedAt()} IST`;
  worksheet.getCell('A2').font = { name: 'Aptos', size: 10, color: { argb: 'FF4B635E' } };
  worksheet.getCell('A2').alignment = { vertical: 'middle' };
  worksheet.getRow(2).height = 22;

  worksheet.addRow([]);
  const headerRow = worksheet.addRow(headers.map((header) => String(header)));
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_COLOR}` } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } }, bottom: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } } };
  });

  rows.forEach((sourceRow, rowIndex) => {
    const row = worksheet.addRow(headers.map((_, cellIndex) => safeCellValue(sourceRow?.[cellIndex])));
    row.eachCell((cell) => {
      cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF1E3430' } };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } } };
      if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PALE_ROW}` } };
    });
  });

  headers.forEach((header, index) => {
    const values = [header, ...rows.map((row) => row?.[index] ?? '')];
    const widest = values.reduce((length, value) => Math.max(length, String(value).replace(/\r?\n/g, ' ').length), 0);
    const label = String(header).toLowerCase();
    const isNarrative = /notes|address|location|from|to/.test(label);
    const isId = /id|mobile|aadhaar|pan/.test(label);
    worksheet.getColumn(index + 1).width = Math.min(isNarrative ? 52 : isId ? 20 : 30, Math.max(isNarrative ? 20 : 12, widest + 2));
    if (/\bkm\b|distance|minutes/.test(label)) worksheet.getColumn(index + 1).numFmt = '#,##0.00';
  });

  worksheet.autoFilter = `A4:${finalColumn}${Math.max(4, rows.length + 4)}`;
  worksheet.headerFooter.oddFooter = `&L${BRAND}&C${report?.title || readableTitle(filename)}&RPage &P of &N`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = normalizedFilename(filename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
