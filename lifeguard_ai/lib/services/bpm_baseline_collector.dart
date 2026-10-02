/// Collects distinct valid live vital samples for the patient baseline API.
/// The backend remains responsible for calculating and saving the baseline.
class BpmBaselineCollector {
  static const int minimumReadings = 15;
  static const int maximumReadings = 15;

  final List<Map<String, dynamic>> _readings = [];
  final Set<String> _seenTimestamps = {};

  int get count => _readings.length;
  List<Map<String, dynamic>> get readings =>
      _readings.map((reading) => Map<String, dynamic>.from(reading)).toList();

  void clear() {
    _readings.clear();
    _seenTimestamps.clear();
  }

  bool add(Map<String, dynamic>? reading) {
    if (reading == null ||
        reading["sensorStatus"] != "LIVE" ||
        count >= maximumReadings) {
      return false;
    }

    final timestamp = DateTime.tryParse(
      reading["lastValidReadingAt"]?.toString() ?? "",
    );
    final heartRate = _validNumber(reading["heartRate"], 30, 220);
    final spo2 = _validNumber(reading["spo2"], 70, 100);
    final temperature = _validNumber(reading["temperature"], 25, 45);
    if (timestamp == null ||
        heartRate == null ||
        spo2 == null ||
        temperature == null ||
        reading["fingerDetected"] == false ||
        _isInvalidStatus(reading["heartRateStatus"]) ||
        _isInvalidStatus(reading["spo2Status"])) {
      return false;
    }

    final timestampKey = timestamp.toUtc().toIso8601String();
    if (!_seenTimestamps.add(timestampKey)) return false;

    _readings.add({
      "sensorStatus": "LIVE",
      "heartRate": heartRate,
      "spo2": spo2,
      "temperature": temperature,
      "fingerDetected": reading["fingerDetected"],
      "heartRateStatus": reading["heartRateStatus"],
      "spo2Status": reading["spo2Status"],
      "receivedAt": timestampKey,
    });
    return true;
  }

  static bool _isInvalidStatus(dynamic value) =>
      value?.toString().trim().toUpperCase() == "INVALID";

  static double? _validNumber(dynamic value, double minimum, double maximum) {
    if (value == null || value.toString().trim().isEmpty) return null;
    final number = double.tryParse(value.toString());
    return number != null &&
            number.isFinite &&
            number >= minimum &&
            number <= maximum
        ? number
        : null;
  }
}
