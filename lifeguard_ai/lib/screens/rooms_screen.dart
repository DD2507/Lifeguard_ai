import 'package:flutter/material.dart';

class RoomsScreen extends StatelessWidget {
  final List<dynamic> rooms;
  final List<dynamic> patients;
  final bool loading;
  final String error;
  final Future<void> Function() onRefresh;


  const RoomsScreen({
  super.key,
  required this.rooms,
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
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            "Smart Rooms",
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 5),

          const Text(
            "Monitor room environment and connected IoT devices.",
            style: TextStyle(
              color: Color(0xFF8095A9),
              fontSize: 13,
            ),
          ),

          const SizedBox(height: 20),

          // ==================================================
          // ROOM COUNT
          // ==================================================

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
                  Icons.meeting_room_rounded,
                  color: Color(0xFF20C8C8),
                ),

                const SizedBox(width: 12),

                Text(
                  "${rooms.length} Rooms",
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 15),

          // ==================================================
          // ROOMS
          // ==================================================

          if (rooms.isEmpty)
            Container(
              padding: const EdgeInsets.all(25),
              decoration: BoxDecoration(
                color: const Color(0xFF101C29),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: const Color(0xFF1B2D3D),
                ),
              ),
              child: const Column(
                children: [
                  Icon(
                    Icons.meeting_room_outlined,
                    color: Color(0xFF8095A9),
                    size: 45,
                  ),
                  SizedBox(height: 10),
                  Text(
                    "No rooms found",
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            )
          else
            ...rooms.map(
              (room) => Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: _roomCard(room),
              ),
            ),
        ],
      ),
    );
  }

  // ======================================================
  // ROOM CARD
  // ======================================================

  Widget _roomCard(dynamic room) {
    final String roomId =
        room["roomId"]?.toString() ?? "--";

    final String temperature =
        room["temperature"] != null
            ? "${room["temperature"]}°C"
            : "--";

    final String humidity =
        room["humidity"] != null
            ? "${room["humidity"]}%"
            : "--";

    final String airQuality =
        room["airQuality"]?.toString() ?? "--";

    final bool presenceDetected =
        room["presenceDetected"] == true;

    final bool fanStatus =
        room["fanStatus"] == true;

    final bool buzzerStatus =
        room["buzzerStatus"] == true;

    return GestureDetector(
      onTap: () {
        // Room details will be connected to the
        // backend in the next step.
      },

      child: Container(
        padding: const EdgeInsets.all(18),

        decoration: BoxDecoration(
          color: const Color(0xFF101C29),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: const Color(0xFF1B2D3D),
          ),
        ),

        child: Column(
          children: [
            // ================================================
            // ROOM HEADER
            // ================================================

            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,

                  decoration: BoxDecoration(
                    color: const Color(0xFF12343A),
                    borderRadius:
                        BorderRadius.circular(15),
                  ),

                  child: const Icon(
                    Icons.meeting_room_rounded,
                    color: Color(0xFF20C9C3),
                    size: 26,
                  ),
                ),

                const SizedBox(width: 13),

                Expanded(
                  child: Column(
                    crossAxisAlignment:
                        CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Room $roomId",

                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight:
                              FontWeight.bold,
                        ),
                      ),

                      const SizedBox(height: 4),

                      Text(
                        presenceDetected
                            ? "Patient detected"
                            : "No patient detected",

                        style: TextStyle(
                          fontSize: 10,
                          color: presenceDetected
                              ? const Color(
                                  0xFF43D17A,
                                )
                              : const Color(
                                  0xFF8095A9,
                                ),
                        ),
                      ),
                    ],
                  ),
                ),

                _statusBadge(
                  room,
                ),
              ],
            ),

            const SizedBox(height: 18),

            // ================================================
            // ENVIRONMENT
            // ================================================

            Row(
              children: [
                _environment(
                  Icons.thermostat_outlined,
                  temperature,
                  "Temperature",
                  const Color(0xFF4DA3FF),
                ),

                _environment(
                  Icons.water_drop_outlined,
                  humidity,
                  "Humidity",
                  const Color(0xFF4DA3FF),
                ),

                _environment(
                  Icons.air_rounded,
                  airQuality,
                  "Air Quality",
                  const Color(0xFF43D17A),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // ================================================
            // DEVICES
            // ================================================

            Container(
              padding: const EdgeInsets.all(11),

              decoration: BoxDecoration(
                color: const Color(0xFF0D1722),
                borderRadius:
                    BorderRadius.circular(12),
              ),

              child: Row(
                children: [
                  const Icon(
                    Icons.memory_rounded,
                    size: 16,
                    color: Color(0xFF20C8C8),
                  ),

                  const SizedBox(width: 7),

                  const Expanded(
                    child: Text(
                      "IoT Environment Controller",
                      style: TextStyle(
                        fontSize: 10,
                        color: Color(0xFF8095A9),
                      ),
                    ),
                  ),

                  if (fanStatus)
                    const Padding(
                      padding:
                          EdgeInsets.only(right: 8),
                      child: Icon(
                        Icons.air,
                        size: 16,
                        color: Color(0xFF20C8C8),
                      ),
                    ),

                  if (buzzerStatus)
                    const Icon(
                      Icons.notifications_active,
                      size: 16,
                      color: Color(0xFFFF5C68),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ======================================================
  // STATUS BADGE
  // ======================================================

  Widget _statusBadge(dynamic room) {
    final bool fan =
        room["fanStatus"] == true;

    final bool buzzer =
        room["buzzerStatus"] == true;

    String status = "CONNECTED";
    Color color = const Color(0xFF43D17A);

    if (buzzer) {
      status = "ALERT";
      color = const Color(0xFFFF5C68);
    } else if (fan) {
      status = "ACTIVE";
      color = const Color(0xFF20C8C8);
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: 6,
      ),

      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),

      child: Text(
        status,

        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  // ======================================================
  // ENVIRONMENT
  // ======================================================

  Widget _environment(
    IconData icon,
    String value,
    String label,
    Color color,
  ) {
    return Expanded(
      child: Column(
        children: [
          Icon(
            icon,
            color: color,
            size: 22,
          ),

          const SizedBox(height: 7),

          Text(
            value,

            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 3),

          Text(
            label,

            textAlign: TextAlign.center,

            style: const TextStyle(
              fontSize: 8,
              color: Color(0xFF8095A9),
            ),
          ),
        ],
      ),
    );
  }
}