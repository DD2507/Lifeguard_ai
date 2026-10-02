import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lifeguard_ai/screens/alerts_screen.dart';
import 'package:lifeguard_ai/screens/medicine_due_alarm_screen.dart';

const _medicineAlertFixture = <String, dynamic>{
  "alertType": "MEDICINE_DUE",
  "status": "ACTIVE",
  "medicineStatus": "MEDICINE_DUE",
  "patientId": "TEST-PATIENT",
  "patientName": "Test Patient",
  "room": "TEST-ROOM",
  "treatmentName": "TEST medicine",
  "dosage": "TEST dosage",
  "instructions": "TEST instructions",
  "dueTime": "TEST scheduled time IST",
  "timeZone": "Asia/Kolkata",
  "occurrenceId": "TEST-PRESCRIPTION:TEST-SCHEDULE",
};

void main() {
  testWidgets("active medicine alert is visible with dose details", (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AlertsScreen(
            alerts: [_medicineAlertFixture],
            loading: false,
            error: "",
            onRefresh: () async {},
            onAcknowledge: (_) async {},
          ),
        ),
      ),
    );

    expect(find.text("MEDICINE DUE — ACTION REQUIRED"), findsOneWidget);
    expect(
      find.text("Patient: Test Patient (TEST-PATIENT)  •  Room TEST-ROOM"),
      findsOneWidget,
    );
    expect(find.text("TEST medicine — TEST dosage"), findsOneWidget);
    expect(
      find.text("Due: TEST scheduled time IST (Asia/Kolkata)"),
      findsOneWidget,
    );
  });

  testWidgets(
    "alarm dismissal closes the screen without changing alert status",
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => const MedicineDueAlarmScreen(
                        alert: _medicineAlertFixture,
                      ),
                    ),
                  ),
                  child: const Text("Open alarm"),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text("Open alarm"));
      await tester.pumpAndSettle();
      expect(find.text("MEDICINE DUE — ACTION REQUIRED"), findsOneWidget);

      await tester.ensureVisible(find.text("DISMISS ALARM"));
      await tester.tap(find.text("DISMISS ALARM"));
      await tester.pumpAndSettle();
      expect(find.text("Open alarm"), findsOneWidget);
      expect(_medicineAlertFixture["status"], "ACTIVE");
    },
  );
}
