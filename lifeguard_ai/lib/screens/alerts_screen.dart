import 'package:flutter/material.dart';

class AlertsScreen extends StatelessWidget {
  final List<dynamic> alerts;
  final bool loading;
  final String error;
  final Future<void> Function() onRefresh;

  const AlertsScreen({
    super.key,
    required this.alerts,
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

      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ==================================================
          // HEADER
          // ==================================================

          const Text(
            "Alerts",
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 5),

          const Text(
            "Patients requiring immediate or closer attention.",
            style: TextStyle(
              color: Color(0xFF8095A9),
              fontSize: 13,
            ),
          ),

          const SizedBox(height: 22),

          // ==================================================
          // SUMMARY
          // ==================================================

          Row(
            children: [
              Expanded(
                child: _summaryCard(
                  alerts.length.toString(),
                  "Active",
                  Icons.notifications_active_rounded,
                  const Color(0xFFFF5C68),
                ),
              ),

              const SizedBox(width: 12),

              Expanded(
                child: _summaryCard(
                  "Live",
                  "Monitoring",
                  Icons.monitor_heart_rounded,
                  const Color(0xFF20C8C8),
                ),
              ),
            ],
          ),

          const SizedBox(height: 25),

          // ==================================================
          // ACTIVE ALERTS
          // ==================================================

          const Text(
            "Active Alerts",
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 12),

          if (alerts.isEmpty)
            _noAlerts()
          else
            ...alerts.map(
              (alert) => Padding(
                padding:
                    const EdgeInsets.only(bottom: 14),
                child: _alertCard(alert),
              ),
            ),
        ],
      ),
    );
  }

  // ======================================================
  // SUMMARY CARD
  // ======================================================

  Widget _summaryCard(
    String value,
    String label,
    IconData icon,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.all(17),

      decoration: BoxDecoration(
        color: const Color(0xFF101C29),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFF1B2D3D),
        ),
      ),

      child: Row(
        children: [
          Icon(
            icon,
            color: color,
            size: 25,
          ),

          const SizedBox(width: 12),

          Expanded(
            child: Column(
              crossAxisAlignment:
                  CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 10,
                    color: Color(0xFF8095A9),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ======================================================
  // NO ALERTS
  // ======================================================

  Widget _noAlerts() {
    return Container(
      padding: const EdgeInsets.all(22),

      decoration: BoxDecoration(
        color: const Color(0xFF172923),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFF216B50),
        ),
      ),

      child: const Column(
        children: [
          Icon(
            Icons.check_circle_outline,
            color: Color(0xFF35D78A),
            size: 45,
          ),

          SizedBox(height: 10),

          Text(
            "No Active Alerts",
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),

          SizedBox(height: 5),

          Text(
            "All monitored patients are currently stable.",
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF8497A3),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  // ======================================================
  // ALERT CARD
  // ======================================================

  Widget _alertCard(dynamic alert) {
    final String risk =
        alert["risk"]?.toString() ?? "HIGH";

    final String patientName =
        alert["patientName"]?.toString() ??
        alert["name"]?.toString() ??
        alert["patientId"]?.toString() ??
        "Unknown Patient";

    final String patientId =
        alert["patientId"]?.toString() ?? "--";

    final String room =
        alert["room"]?.toString() ?? "--";

    final String summary =
        alert["summary"]?.toString() ??
        "Immediate attention recommended.";

    final dynamic score =
        alert["riskScore"];

    final List<dynamic> reasons =
        alert["reasons"] is List
            ? alert["reasons"]
            : [];

    final Color riskColor =
        _getRiskColor(risk);

    return Container(
      padding: const EdgeInsets.all(18),

      decoration: BoxDecoration(
        color: const Color(0xFF101C29),

        borderRadius:
            BorderRadius.circular(20),

        border: Border.all(
          color: riskColor.withValues(
            alpha: 0.45,
          ),
        ),
      ),

      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,

        children: [
          // ================================================
          // ALERT HEADER
          // ================================================

          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.all(9),

                decoration: BoxDecoration(
                  color:
                      riskColor.withValues(
                    alpha: 0.12,
                  ),
                  shape: BoxShape.circle,
                ),

                child: Icon(
                  Icons.warning_rounded,
                  color: riskColor,
                  size: 22,
                ),
              ),

              const SizedBox(width: 10),

              Expanded(
                child: Column(
                  crossAxisAlignment:
                      CrossAxisAlignment.start,

                  children: [
                    Text(
                      risk == "HIGH"
                          ? "HIGH RISK"
                          : risk,

                      style: TextStyle(
                        color: riskColor,
                        fontSize: 11,
                        fontWeight:
                            FontWeight.bold,
                      ),
                    ),

                    const SizedBox(height: 3),

                    Text(
                      patientName,

                      style:
                          const TextStyle(
                        fontSize: 15,
                        fontWeight:
                            FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),

              _riskBadge(risk),
            ],
          ),

          const SizedBox(height: 14),

          // ================================================
          // PATIENT / ROOM
          // ================================================

          Row(
            children: [
              const Icon(
                Icons.badge_outlined,
                size: 15,
                color: Color(0xFF8095A9),
              ),

              const SizedBox(width: 6),

              Text(
                patientId,
                style:
                    const TextStyle(
                  color:
                      Color(0xFF8095A9),
                  fontSize: 11,
                ),
              ),

              const SizedBox(width: 15),

              const Icon(
                Icons.meeting_room_outlined,
                size: 15,
                color: Color(0xFF8095A9),
              ),

              const SizedBox(width: 6),

              Text(
                "Room $room",
                style:
                    const TextStyle(
                  color:
                      Color(0xFF8095A9),
                  fontSize: 11,
                ),
              ),
            ],
          ),

          const SizedBox(height: 15),

          // ================================================
          // SUMMARY
          // ================================================

          Text(
            summary,
            style: const TextStyle(
              fontSize: 12,
              height: 1.5,
            ),
          ),

          // ================================================
          // RISK SCORE
          // ================================================

          if (score != null) ...[
            const SizedBox(height: 12),

            Container(
              width: double.infinity,

              padding:
                  const EdgeInsets.all(11),

              decoration: BoxDecoration(
                color:
                    riskColor.withValues(
                  alpha: 0.08,
                ),

                borderRadius:
                    BorderRadius.circular(12),
              ),

              child: Text(
                "AI Risk Score: $score",

                style: TextStyle(
                  color: riskColor,
                  fontSize: 11,
                  fontWeight:
                      FontWeight.bold,
                ),
              ),
            ),
          ],

          // ================================================
          // CONTRIBUTING FACTORS
          // ================================================

          if (reasons.isNotEmpty) ...[
            const SizedBox(height: 15),

            const Text(
              "Contributing Factors",
              style: TextStyle(
                fontSize: 12,
                fontWeight:
                    FontWeight.bold,
              ),
            ),

            const SizedBox(height: 8),

            ...reasons.map(
              (reason) =>
                  _reasonItem(reason),
            ),
          ],
        ],
      ),
    );
  }

  // ======================================================
  // REASON ITEM
  // ======================================================

  Widget _reasonItem(dynamic reason) {
    final String factor =
        reason["factor"]?.toString() ??
        "Risk Factor";

    final String value =
        reason["value"]?.toString() ??
        "--";

    final String severity =
        reason["severity"]?.toString() ??
        "MODERATE";

    final String explanation =
        reason["explanation"]?.toString() ??
        "";

    return Container(
      margin:
          const EdgeInsets.only(bottom: 8),

      padding:
          const EdgeInsets.all(12),

      decoration: BoxDecoration(
        color: const Color(0xFF141E2D),
        borderRadius:
            BorderRadius.circular(12),
      ),

      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,

        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  factor,

                  style:
                      const TextStyle(
                    fontSize: 12,
                    fontWeight:
                        FontWeight.bold,
                  ),
                ),
              ),

              Text(
                severity,

                style:
                    const TextStyle(
                  color:
                      Color(0xFFF4B53F),
                  fontSize: 9,
                  fontWeight:
                      FontWeight.bold,
                ),
              ),
            ],
          ),

          const SizedBox(height: 5),

          Text(
            "Value: $value",

            style:
                const TextStyle(
              color:
                  Color(0xFF20C8C8),
              fontSize: 10,
              fontWeight:
                  FontWeight.bold,
            ),
          ),

          if (explanation.isNotEmpty) ...[
            const SizedBox(height: 5),

            Text(
              explanation,

              style:
                  const TextStyle(
                color:
                    Color(0xFF8497A3),
                fontSize: 10,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ======================================================
  // RISK BADGE
  // ======================================================

  Widget _riskBadge(String risk) {
    final color = _getRiskColor(risk);

    return Container(
      padding:
          const EdgeInsets.symmetric(
        horizontal: 9,
        vertical: 6,
      ),

      decoration: BoxDecoration(
        color: color.withValues(
          alpha: 0.12,
        ),

        borderRadius:
            BorderRadius.circular(12),
      ),

      child: Text(
        risk.toUpperCase(),

        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight:
              FontWeight.bold,
        ),
      ),
    );
  }

  // ======================================================
  // RISK COLOR
  // ======================================================

  Color _getRiskColor(String risk) {
    switch (risk.toUpperCase()) {
      case "HIGH":
      case "CRITICAL":
        return const Color(0xFFFF5C68);

      case "MODERATE":
        return const Color(0xFFFFB84D);

      default:
        return const Color(0xFF43D17A);
    }
  }
}