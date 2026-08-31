import 'package:flutter/material.dart';

class PatientsScreen extends StatelessWidget {
  final List<dynamic> patients;
  final bool loading;
  final String error;
  final Future<void> Function() onRefresh;

  const PatientsScreen({
    super.key,
    required this.patients,
    required this.loading,
    required this.error,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(
        child: CircularProgressIndicator(
          color: Color(0xFF20C8C8),
        ),
      );
    }

    if (error.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.cloud_off,
                size: 50,
                color: Color(0xFFFF6575),
              ),

              const SizedBox(height: 15),

              Text(
                error,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFFFF6575),
                  fontSize: 14,
                ),
              ),

              const SizedBox(height: 15),

              ElevatedButton(
                onPressed: onRefresh,
                child: const Text("Retry"),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: const Color(0xFF20C8C8),

      child: patients.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 250),

                Center(
                  child: Text(
                    "No patients found",
                    style: TextStyle(
                      color: Color(0xFF8497A3),
                    ),
                  ),
                ),
              ],
            )
          : ListView(
              padding: const EdgeInsets.all(18),
              children: [
                // ==========================================
                // PAGE HEADER
                // ==========================================

                const Text(
                  "All Patients",
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                const SizedBox(height: 5),

                const Text(
                  "View and monitor all registered patients.",
                  style: TextStyle(
                    color: Color(0xFF8497A3),
                    fontSize: 13,
                  ),
                ),

                const SizedBox(height: 20),

                // ==========================================
                // PATIENT COUNT
                // ==========================================

                Container(
                  padding: const EdgeInsets.all(16),

                  decoration: BoxDecoration(
                    color: const Color(0xFF12353B),
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(
                      color: const Color(0xFF14606A),
                    ),
                  ),

                  child: Row(
                    children: [
                      const Icon(
                        Icons.people,
                        color: Color(0xFF20C8C8),
                      ),

                      const SizedBox(width: 12),

                      Text(
                        "${patients.length} Patients",
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 15),

                // ==========================================
                // PATIENT LIST
                // ==========================================

                ...patients.map(
                  (patient) => _patientCard(
                    context,
                    patient,
                  ),
                ),
              ],
            ),
    );
  }

  // ======================================================
  // PATIENT CARD
  // ======================================================

  Widget _patientCard(
    BuildContext context,
    dynamic patient,
  ) {
    final String patientId =
        patient["patientId"]?.toString() ?? "Unknown";

    final String name =
        patient["name"]?.toString() ?? "Unknown Patient";

    final String room =
        patient["room"]?.toString() ?? "--";

    final String risk =
        patient["risk"]?.toString() ?? "LOW";

    final dynamic heartRate =
        patient["heartRate"] ?? "--";

    final dynamic spo2 =
        patient["spo2"] ?? "--";

    final dynamic temperature =
        patient["temperature"] ?? "--";

    return Container(
      margin: const EdgeInsets.only(bottom: 14),

      padding: const EdgeInsets.all(17),

      decoration: BoxDecoration(
        color: const Color(0xFF141E2D),
        borderRadius: BorderRadius.circular(18),

        border: Border.all(
          color: const Color(0xFF263747),
        ),
      ),

      child: Column(
        children: [
          // ================================================
          // PATIENT HEADER
          // ================================================

          Row(
            children: [
              CircleAvatar(
                radius: 25,

                backgroundColor:
                    const Color(0xFF103943),

                child: Text(
                  patientId.replaceFirst("P", ""),

                  style: const TextStyle(
                    color: Color(0xFF20C8C8),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),

              const SizedBox(width: 12),

              Expanded(
                child: Column(
                  crossAxisAlignment:
                      CrossAxisAlignment.start,

                  children: [
                    Text(
                      name,

                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),

                    const SizedBox(height: 4),

                    Text(
                      "$patientId • Room $room",

                      style: const TextStyle(
                        color: Color(0xFF8497A3),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),

              _riskBadge(risk),
            ],
          ),

          const SizedBox(height: 18),

          // ================================================
          // VITALS
          // ================================================

          Container(
            padding: const EdgeInsets.symmetric(
              vertical: 14,
            ),

            decoration: BoxDecoration(
              color: const Color(0xFF101A27),

              borderRadius:
                  BorderRadius.circular(12),
            ),

            child: Row(
              children: [
                _vital(
                  Icons.favorite,
                  "$heartRate BPM",
                  "Heart Rate",
                ),

                _vital(
                  Icons.air,
                  "$spo2%",
                  "SpO₂",
                ),

                _vital(
                  Icons.thermostat,
                  "$temperature°C",
                  "Temperature",
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // ================================================
          // RISK SCORE
          // ================================================

          if (patient["riskScore"] != null)
            Align(
              alignment: Alignment.centerLeft,

              child: Text(
                "AI Risk Score: ${patient["riskScore"]}",

                style: const TextStyle(
                  color: Color(0xFF8497A3),
                  fontSize: 11,
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ======================================================
  // VITAL
  // ======================================================

  Widget _vital(
    IconData icon,
    String value,
    String label,
  ) {
    return Expanded(
      child: Column(
        children: [
          Icon(
            icon,
            size: 19,
            color: const Color(0xFF20C8C8),
          ),

          const SizedBox(height: 5),

          Text(
            value,

            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 2),

          Text(
            label,

            style: const TextStyle(
              color: Color(0xFF718692),
              fontSize: 9,
            ),
          ),
        ],
      ),
    );
  }

  // ======================================================
  // RISK BADGE
  // ======================================================

  Widget _riskBadge(String risk) {
    Color background;
    Color text;

    switch (risk.toUpperCase()) {
      case "HIGH":
      case "CRITICAL":
        background = const Color(0xFF3B202D);
        text = const Color(0xFFFF5B6E);
        break;

      case "MODERATE":
        background = const Color(0xFF393326);
        text = const Color(0xFFF4B53F);
        break;

      default:
        background = const Color(0xFF12382F);
        text = const Color(0xFF35D78A);
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 9,
        vertical: 6,
      ),

      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),

      child: Text(
        risk.toUpperCase(),

        style: TextStyle(
          color: text,
          fontSize: 9,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}