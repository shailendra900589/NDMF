// Attendance reports follow the business day in India; stored timestamps stay UTC.
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});
function attendanceDay(value = new Date()) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? formatter.format(date) : '';
}
module.exports = { attendanceDay };
