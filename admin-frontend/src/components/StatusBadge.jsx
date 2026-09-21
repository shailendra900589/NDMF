import { STATUS_COLORS, LISTING_STATUS, LOAN_STATUS } from '../utils/constants';

export default function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#6b7280';
  const label =
    LISTING_STATUS[status] ||
    LOAN_STATUS[status] ||
    status?.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()) ||
    status;
  return (
    <span className="badge" style={{ background: color }}>
      {label}
    </span>
  );
}
