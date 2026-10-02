import 'package:flutter/material.dart';

class MedicineDueAlarmScreen extends StatelessWidget {
  final Map<String, dynamic> alert;

  const MedicineDueAlarmScreen({super.key, required this.alert});

  @override
  Widget build(BuildContext context) {
    final patientId = alert["patientId"]?.toString() ?? "Unknown";
    final patientName = alert["patientName"]?.toString() ?? patientId;
    final room = alert["room"]?.toString() ?? "Unknown";
    final medicine = alert["treatmentName"]?.toString() ?? "Medicine";
    final dosage = alert["dosage"]?.toString() ?? "Not specified";
    final instructions = alert["instructions"]?.toString() ?? "";
    final dueTime =
        alert["dueTime"]?.toString() ??
        alert["scheduledAt"]?.toString() ??
        "Time unavailable";

    return PopScope(
      child: Scaffold(
        backgroundColor: const Color(0xFF190B10),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.alarm_on_rounded,
                    color: Color(0xFFFF6575),
                    size: 76,
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    "MEDICINE DUE — ACTION REQUIRED",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFFFF8792),
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                    ),
                  ),
                  const SizedBox(height: 24),
                  _detail("Patient", "$patientName ($patientId)"),
                  _detail("Room", room),
                  _detail("Medicine", medicine),
                  _detail("Dosage", dosage),
                  _detail("Due", dueTime),
                  if (instructions.isNotEmpty)
                    _detail("Instructions", instructions),
                  const SizedBox(height: 18),
                  const Text(
                    "Repeating alarm sound, spoken announcements, and medicine completion are not configured in this mobile build. This reminder remains in the active Alerts list.",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFFFFD69A), fontSize: 13),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFFC52D43),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.notifications_off_outlined),
                      label: const Text("DISMISS ALARM"),
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    "Dismissing this alarm does not complete or remove the medicine alert.",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFFB8C5CA), fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _detail(String label, String value) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF25151B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF62313A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: Color(0xFFFFA6AF), fontSize: 12),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 17),
          ),
        ],
      ),
    );
  }
}
