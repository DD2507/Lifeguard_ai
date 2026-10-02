import 'package:flutter_test/flutter_test.dart';
import 'package:lifeguard_ai/services/bpm_baseline_collector.dart';

// These deterministic fixtures exercise collection logic only; they are not
// sensor readings and do not represent hardware verification.
Map<String, dynamic> _fixtureReading(int sequence, {Object? heartRate = 78}) =>
    {
      "sensorStatus": "LIVE",
      "heartRate": heartRate,
      "spo2": 97,
      "temperature": 36.8,
      "lastValidReadingAt": DateTime.utc(
        2026,
        9,
        30,
      ).add(Duration(seconds: sequence)).toIso8601String(),
    };

void main() {
  group("patient baseline live reading collection", () {
    test("requires and accepts all fifteen valid readings", () {
      final collector = BpmBaselineCollector();
      for (var sequence = 0; sequence < 14; sequence++) {
        expect(collector.add(_fixtureReading(sequence)), isTrue);
      }

      expect(collector.count, 14);
      expect(collector.add(_fixtureReading(14)), isTrue);
      expect(collector.count, 15);
    });

    test("rejects duplicates and invalid BPM sensor values", () {
      final collector = BpmBaselineCollector();
      final reading = _fixtureReading(1);

      expect(collector.add(reading), isTrue);
      expect(collector.add(reading), isFalse);
      expect(collector.add(_fixtureReading(2, heartRate: 0)), isFalse);
      expect(collector.add(_fixtureReading(3, heartRate: "invalid")), isFalse);
      expect(collector.add(_fixtureReading(4, heartRate: 29)), isFalse);
      expect(collector.add(_fixtureReading(5, heartRate: 221)), isFalse);
      expect(collector.count, 1);
    });

    test(
      "accepts complete live sensor-range HR, SpO2, and temperature together",
      () {
        final collector = BpmBaselineCollector();
        expect(collector.add({..._fixtureReading(1), "spo2": 82}), isTrue);
        expect(
          collector.add({..._fixtureReading(2), "temperature": 29.8}),
          isTrue,
        );
        expect(collector.add(_fixtureReading(3, heartRate: 108)), isTrue);
        expect(collector.add(_fixtureReading(4)), isTrue);
        expect(collector.count, 4);
        expect(collector.readings.last, {
          "sensorStatus": "LIVE",
          "heartRate": 78.0,
          "spo2": 97.0,
          "temperature": 36.8,
          "fingerDetected": null,
          "heartRateStatus": null,
          "spo2Status": null,
          "receivedAt": DateTime.utc(2026, 9, 30, 0, 0, 4).toIso8601String(),
        });
      },
    );

    test("caps accepted samples at the existing 15 reading maximum", () {
      final collector = BpmBaselineCollector();
      for (var sequence = 0; sequence < 15; sequence++) {
        expect(collector.add(_fixtureReading(sequence)), isTrue);
      }

      expect(collector.count, 15);
      expect(collector.add(_fixtureReading(16)), isFalse);
      expect(collector.count, 15);
    });
  });
}
