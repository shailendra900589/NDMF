/// Wall-clock representation for formatting India business dates, independent
/// of the phone's configured timezone. Do not persist this shifted value.
DateTime indiaTime(DateTime instant) =>
    instant.toUtc().add(const Duration(hours: 5, minutes: 30));
