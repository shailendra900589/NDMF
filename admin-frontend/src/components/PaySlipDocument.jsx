import { amountInWords, formatAmount, formatMonthLabel } from '../utils/payslip';

const LOGO_SRC = '/nirmaldhara-logo.jpg';

/**
 * Print-ready pay slip matching the professional grid template.
 */
export default function PaySlipDocument({ slip, id, className = '' }) {
  if (!slip) return null;

  const e = slip.earnings || {};
  const d = slip.deductions || {};
  const monthLabel = formatMonthLabel(slip.month);
  const company = slip.companyName || 'Nirmaldhara Micro Foundation';
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
              <img src={LOGO_SRC} alt="Nirmaldhara" className="pslip__logo" />
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
              <div className="pslip__sign-row">
                <div className="pslip__sign-block">
                  <div className="pslip__sign-space" />
                  <div className="pslip__sign-line" />
                  <div className="pslip__sign-label">Employee Signature</div>
                </div>
                <div className="pslip__sign-block pslip__sign-block--right">
                  <div className="pslip__sign-space" />
                  <div className="pslip__sign-line" />
                  <div className="pslip__sign-label">Authorized Signatory</div>
                  <div className="pslip__sign-org">For {company}</div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
