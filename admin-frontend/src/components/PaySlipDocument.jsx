import { amountInWords, formatAmount, formatMonthLabel } from '../utils/payslip';

const LOGO_SRC = '/mystaff-smart-logo.svg';

/**
 * Print-ready pay slip matching the professional grid template.
 */
export default function PaySlipDocument({ slip, id, className = '' }) {
  if (!slip) return null;

  const e = slip.earnings || {};
  const d = slip.deductions || {};
  const monthLabel = formatMonthLabel(slip.month);
  const company = slip.companyName || 'MyStaff Smart';
  const address = slip.companyAddress || '';

  const earnRows = [
    ['Basic Salary', e.basic],
    ['House Rent Allowances', e.hra],
    ['Conveyance Allowances', e.conveyance],
    ['Medical Allowances', e.medical],
    ['Special Allowances', e.special],
  ];
  const dedRows = [
    ['EPF', d.epf],
    ['Health Insurance', d.healthInsurance],
    ['Professional Tax', d.professionalTax],
    ['TDS', d.tds],
  ];
  while (dedRows.length < earnRows.length) {
    dedRows.push(['', null]);
  }

  return (
    <div className={`pslip ${className}`.trim()} id={id} data-month={slip.month}>
      <table className="pslip__table">
        <tbody>
          <tr>
            <td className="pslip__logo-cell">
              <img src={LOGO_SRC} alt="MyStaff Smart" className="pslip__logo" />
            </td>
            <td className="pslip__company-cell" colSpan={3}>
              <div className="pslip__company-name">{company}</div>
              {address ? <div className="pslip__company-addr">{address}</div> : null}
            </td>
          </tr>
          <tr>
            <td className="pslip__month-cell" colSpan={4}>
              Pay Slip for the Month of {monthLabel}
            </td>
          </tr>
          <tr>
            <td className="pslip__label">Name</td>
            <td className="pslip__value">{slip.employeeName}</td>
            <td className="pslip__label">Department</td>
            <td className="pslip__value">{slip.department}</td>
          </tr>
          <tr>
            <td className="pslip__label">Emp. No</td>
            <td className="pslip__value">{slip.employeeNo}</td>
            <td className="pslip__label">Bank Name</td>
            <td className="pslip__value">{slip.bankName}</td>
          </tr>
          <tr>
            <td className="pslip__label">Designation</td>
            <td className="pslip__value">{slip.designation}</td>
            <td className="pslip__label">A/c No.</td>
            <td className="pslip__value">{slip.accountNo}</td>
          </tr>
          <tr className="pslip__col-heads">
            <td colSpan={2} className="pslip__head">Earnings</td>
            <td colSpan={2} className="pslip__head">Deductions</td>
          </tr>
          {slip.attendance && <tr><td colSpan={4} style={{padding:10,fontSize:11}}>Calendar days: {slip.attendance.calendarDays || new Date(Number(slip.month.slice(0,4)),Number(slip.month.slice(5)),0).getDate()} · Present: {slip.attendance.presentDays || 0} · Paid leave: {slip.attendance.paidLeaveDays || 0} · Unpaid leave: {slip.attendance.unpaidLeaveDays || 0} · Weekly off/holidays: {slip.attendance.weeklyOffDays || 0} · {slip.payroll ? 'Absent/unrecorded' : 'Absent'}: {slip.attendance.absentDays || 0}{slip.attendance.note && <div>{slip.attendance.note}</div>}</td></tr>}
          {slip.payroll && <tr><td colSpan={4} style={{padding:10,fontSize:11}}>Base monthly salary: ₹{formatAmount(slip.payroll.monthlySalary)} · Payable days: {slip.payroll.paidDays}/{slip.payroll.calendarDays} · Unpaid/pending days: {slip.payroll.unpaidDays} · Loss of pay: ₹{formatAmount(slip.payroll.lossOfPay)}</td></tr>}
          {slip.payroll?.isProvisional && <tr><td colSpan={4} style={{padding:8,fontSize:11,fontWeight:700}}>Provisional payroll as of {slip.payroll.asOf}. Future and unrecorded days are pending; recalculate after attendance review.</td></tr>}
          {earnRows.map((row, i) => (
            <tr key={`er-${i}`}>
              <td className="pslip__label">{row[0]}</td>
              <td className="pslip__amt">{formatAmount(row[1])}</td>
              <td className="pslip__label">{dedRows[i][0]}</td>
              <td className="pslip__amt">{formatAmount(dedRows[i][1])}</td>
            </tr>
          ))}
          <tr className="pslip__totals-row">
            <td className="pslip__label pslip__strong">Gross Salary</td>
            <td className="pslip__amt pslip__strong">{formatAmount(slip.grossSalary)}</td>
            <td className="pslip__label pslip__strong">Total Deductions</td>
            <td className="pslip__amt pslip__strong">{formatAmount(slip.totalDeductions)}</td>
          </tr>
          <tr className="pslip__net-row">
            <td className="pslip__label pslip__strong" colSpan={2}>
              Net Pay
            </td>
            <td className="pslip__amt pslip__strong pslip__net" colSpan={2}>
              {formatAmount(slip.netPay)}
            </td>
          </tr>
          <tr>
            <td className="pslip__words" colSpan={4}>
              Amount in Words: {amountInWords(slip.netPay)}
            </td>
          </tr>
          <tr>
            <td className="pslip__sign-cell" colSpan={4}>
              <p style={{textAlign:'center',fontSize:12}}>Digital salary slip — computer generated. No signature is required.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
