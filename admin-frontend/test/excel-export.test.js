import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { downloadExcel } from '../src/utils/exportExcel.js';

test('report downloads are genuine styled XLSX workbooks', async () => {
  const originalDocument = global.document;
  const originalUrl = global.URL;
  const originalWindow = global.window;
  let exportedBlob;
  let downloadedAs;
  const anchor = { click() {}, remove() {} };

  global.document = {
    body: { appendChild() {} },
    createElement: () => anchor,
  };
  global.URL = {
    createObjectURL: (blob) => { exportedBlob = blob; return 'blob:report'; },
    revokeObjectURL() {},
  };
  global.window = { setTimeout: (callback) => callback() };

  try {
    await downloadExcel('route-report.csv', {
      title: 'Route activity report',
      subtitle: 'Test employee · October 2026',
      sheetName: 'Route details',
      headers: ['Employee', 'KM', 'Notes'],
      rows: [['Ajeet', 12.5, '=Unsafe formula stays as text']],
    });
    downloadedAs = anchor.download;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await exportedBlob.arrayBuffer());
    const sheet = workbook.getWorksheet('Route details');
    assert.equal(downloadedAs, 'route-report.xlsx');
    assert.equal(sheet.getCell('A1').value, 'MyStaff Smart | Route activity report');
    assert.equal(sheet.getCell('A4').value, 'Employee');
    assert.equal(sheet.getCell('C5').value, "'=Unsafe formula stays as text");
    assert.equal(sheet.getCell('A4').fill.fgColor.argb, 'FF075D50');
    assert.equal(sheet.views[0].ySplit, 4);
  } finally {
    global.document = originalDocument;
    global.URL = originalUrl;
    global.window = originalWindow;
  }
});
