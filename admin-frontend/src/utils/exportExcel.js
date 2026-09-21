/** Download rows as Excel-friendly .xls (CSV content, opens in Excel) */
export function downloadExcel(filename, sheets) {
  const { headers, rows } = sheets;
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach((row) => lines.push(row.map(escape).join(',')));
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xls') || filename.endsWith('.csv')
    ? filename
    : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
