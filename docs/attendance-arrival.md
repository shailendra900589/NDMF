# Attendance arrival and salary

Shift assignments retain employee → branch → company-default precedence, using India time. Check-in opens at the earlier of the configured opening and 30 minutes before shift start (clamped to midnight for same-day shifts). Last check-in and shift-end controls still apply. Disabling the check-in window removes its blocking restriction; arrival classification still uses the configured shift.

Grace is measured from shift start. For a 10:00 shift with 15 grace minutes, arrival through 10:15:00 is on time, after 10:15 is Late, and 11:00 or later is Half Day. The new half-day offset defaults to 60 minutes after shift start and is editable per company/branch/employee assignment; it must be after grace. Late arrivals earn a full day, half days earn 0.5 day. The existing four-paid-Sunday policy remains in effect without double counting.

Check-in saves the arrival classification and shift snapshot. Older records with a saved timing snapshot are classified from that snapshot and their original check-in time; records without timing retain their previous full-day treatment. Calendar, report matrix, Excel export and automatic payroll share the classification. Missing checkout is still shown independently of the arrival classification.

Admin/authorized branch managers can use Attendance correction → Full day / Present with a mandatory reason to replace half-day treatment. The original punch, GPS and biometric records are preserved and the correction is audited. Recalculate automatic payroll after a correction; already issued/released salary slips are not silently rewritten. Slip calculations and day summaries include late/half-day counts.
