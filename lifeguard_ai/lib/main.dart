import 'dart:async';

import 'package:flutter/material.dart';

import 'api_service.dart';
import 'screens/alerts_screen.dart';
import 'screens/patients_screen.dart';
import 'screens/rooms_screen.dart';

void main() {
  runApp(const LifeGuardApp());
}

// ======================================================
// APP
// ======================================================

class LifeGuardApp extends StatelessWidget {
  const LifeGuardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'LifeGuard AI',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF001A21),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF20C8C8),
          brightness: Brightness.dark,
        ),
      ),
      home: const HomeScreen(),
    );
  }
}

// ======================================================
// HOME SCREEN
// ======================================================

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int selectedIndex = 0;

  List<dynamic> patients = [];
  List<dynamic> alerts = [];
  List<dynamic> rooms = [];

  bool loading = true;
  String error = "";

  Timer? refreshTimer;

  @override
  void initState() {
    super.initState();

    loadData();

    refreshTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) {
        loadData();
      },
    );
  }

  @override
  void dispose() {
    refreshTimer?.cancel();
    super.dispose();
  }

  // ====================================================
  // LOAD DATA
  // ====================================================

  Future<void> loadData() async {
    try {
      final results = await Future.wait([
        ApiService.getPatients(),
        ApiService.getAlerts(),
        ApiService.getRooms(),
      ]);

      if (!mounted) return;

      setState(() {
        patients = results[0];
        alerts = results[1];
        rooms = results[2];
        loading = false;
        error = "";
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        loading = false;
        error = "Unable to connect to LifeGuard AI server";
      });

      debugPrint("API error: $e");
    }
  }

  // ====================================================
  // NAVIGATION
  // ====================================================

  void changePage(int index) {
    setState(() {
      selectedIndex = index;
    });
  }

  // ====================================================
  // BUILD
  // ====================================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // =================================================
            // HEADER
            // =================================================

            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(
                20,
                18,
                20,
                14,
              ),
              decoration: const BoxDecoration(
                color: Color(0xFF00151B),
                border: Border(
                  bottom: BorderSide(
                    color: Color(0xFF12343C),
                  ),
                ),
              ),
              child: Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment:
                          CrossAxisAlignment.start,
                      children: [
                        Text(
                          "LifeGuard AI",
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          "Patient Care Intelligence",
                          style: TextStyle(
                            color: Color(0xFF8497A3),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),

                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF102D31),
                      borderRadius:
                          BorderRadius.circular(20),
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.circle,
                          size: 8,
                          color: Color(0xFF2DD4BF),
                        ),
                        SizedBox(width: 6),
                        Text(
                          "LIVE",
                          style: TextStyle(
                            color: Color(0xFF2DD4BF),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // =================================================
            // CURRENT PAGE
            // =================================================

            Expanded(
              child: _buildCurrentPage(),
            ),
          ],
        ),
      ),

      // ====================================================
      // BOTTOM NAVIGATION
      // ====================================================

      bottomNavigationBar: BottomNavigationBar(
        currentIndex: selectedIndex,
        onTap: changePage,
        backgroundColor: const Color(0xFF00151B),
        selectedItemColor: const Color(0xFF20C8C8),
        unselectedItemColor: const Color(0xFF718692),
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: "Dashboard",
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.people_outline),
            activeIcon: Icon(Icons.people),
            label: "Patients",
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.warning_amber_outlined),
            activeIcon: Icon(Icons.warning_amber),
            label: "Alerts",
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.meeting_room_outlined),
            activeIcon: Icon(Icons.meeting_room),
            label: "Rooms",
          ),
        ],
      ),
    );
  }

  // ====================================================
  // CURRENT PAGE
  // ====================================================

  Widget _buildCurrentPage() {
    if (selectedIndex == 1) {
      return PatientsScreen(
        patients: patients,
        loading: loading,
        error: error,
        onRefresh: loadData,
      );
    }

    if (selectedIndex == 2) {
      return AlertsScreen(
        alerts: alerts,
        loading: loading,
        error: error,
        onRefresh: loadData,
      );
    }

    if (selectedIndex == 3) {
      return RoomsScreen(
        rooms: rooms,
        patients: patients,
        loading: loading,
        error: error,
        onRefresh: loadData,
      );
    }

    return DashboardPage(
      patients: patients,
      alerts: alerts,
      loading: loading,
      error: error,
      onRefresh: loadData,
    );
  }
}

// ======================================================
// DASHBOARD
// ======================================================

class DashboardPage extends StatelessWidget {
  final List<dynamic> patients;
  final List<dynamic> alerts;
  final bool loading;
  final String error;
  final Future<void> Function() onRefresh;

  const DashboardPage({
    super.key,
    required this.patients,
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
          padding: const EdgeInsets.all(25),
          child: Column(
            mainAxisAlignment:
                MainAxisAlignment.center,
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

    final lowRisk = patients.where(
      (p) => p["risk"] == "LOW",
    ).length;

    final highRisk = patients.where(
      (p) =>
          p["risk"] == "HIGH" ||
          p["risk"] == "CRITICAL",
    ).length;

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: const Color(0xFF20C8C8),
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          // =================================================
          // WELCOME
          // =================================================

          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: const Color(0xFF12353B),
              borderRadius:
                  BorderRadius.circular(20),
              border: Border.all(
                color: const Color(0xFF14606A),
              ),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment:
                        CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Good evening, Doctor",
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        "Here is the latest overview of your patients.",
                        style: TextStyle(
                          color: Color(0xFF91A6AF),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const Text(
                  "♥",
                  style: TextStyle(
                    fontSize: 42,
                    color: Color(0xFF20C8C8),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          // =================================================
          // STATISTICS
          // =================================================

          Row(
            children: [
              Expanded(
                child: _statCard(
                  "Patients",
                  patients.length,
                  Icons.people,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _statCard(
                  "Low Risk",
                  lowRisk,
                  Icons.check_circle_outline,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _statCard(
                  "High Risk",
                  highRisk,
                  Icons.warning_amber,
                ),
              ),
            ],
          ),

          const SizedBox(height: 25),

          // =================================================
          // ALERT HEADER
          // =================================================

          Row(
            mainAxisAlignment:
                MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                "🚨 Active Alerts",
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                "${alerts.length} Active",
                style: const TextStyle(
                  color: Color(0xFFFF6575),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // =================================================
          // ALERTS
          // =================================================

          if (alerts.isEmpty)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF172923),
                borderRadius:
                    BorderRadius.circular(15),
                border: Border.all(
                  color: const Color(0xFF216B50),
                ),
              ),
              child: const Center(
                child: Text(
                  "✓ No active alerts currently detected",
                  style: TextStyle(
                    color: Color(0xFF35D78A),
                  ),
                ),
              ),
            )
          else
            ...alerts.take(3).map(
                  (alert) => _alertCard(alert),
                ),

          const SizedBox(height: 25),

          // =================================================
          // PATIENT MONITORING
          // =================================================

          const Text(
            "Patient Monitoring",
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 12),

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

  // ====================================================
  // STAT CARD
  // ====================================================

  Widget _statCard(
    String title,
    int value,
    IconData icon,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(
        vertical: 16,
        horizontal: 8,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFF141E2D),
        borderRadius:
            BorderRadius.circular(15),
        border: Border.all(
          color: const Color(0xFF263747),
        ),
      ),
      child: Column(
        children: [
          Icon(
            icon,
            color: const Color(0xFF20C8C8),
            size: 22,
          ),
          const SizedBox(height: 8),
          Text(
            "$value",
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            title,
            style: const TextStyle(
              color: Color(0xFF8294A1),
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================
  // PATIENT CARD
  // ====================================================

  Widget _patientCard(
    BuildContext context,
    dynamic patient,
  ) {
    final risk = patient["risk"] ?? "LOW";

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PatientDetailsScreen(
              patientId: patient["patientId"],
            ),
          ),
        );
      },
      child: Container(
        margin:
            const EdgeInsets.only(bottom: 12),
        padding:
            const EdgeInsets.all(17),
        decoration: BoxDecoration(
          color: const Color(0xFF141E2D),
          borderRadius:
              BorderRadius.circular(18),
          border: Border.all(
            color: const Color(0xFF263747),
          ),
        ),
        child: Column(
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor:
                      const Color(0xFF103943),
                  child: Text(
                    (patient["patientId"] ?? "P")
                        .toString()
                        .replaceFirst(
                          "P",
                          "",
                        ),
                    style: const TextStyle(
                      color:
                          Color(0xFF20C8C8),
                      fontWeight:
                          FontWeight.bold,
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
                        patient["name"] ??
                            "Unknown Patient",
                        style:
                            const TextStyle(
                          fontWeight:
                              FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "Room ${patient["room"]}",
                        style:
                            const TextStyle(
                          color:
                              Color(0xFF80939F),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                _riskBadge(risk),
              ],
            ),

            const SizedBox(height: 15),

            Row(
              children: [
                _vital(
                  "♥",
                  "${patient["heartRate"]} BPM",
                  "Heart Rate",
                ),
                _vital(
                  "≋",
                  "${patient["spo2"]}%",
                  "SpO₂",
                ),
                _vital(
                  "♨",
                  "${patient["temperature"]}°C",
                  "Temp",
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ====================================================
  // ALERT CARD
  // ====================================================

  Widget _alertCard(dynamic alert) {
    return Container(
      margin:
          const EdgeInsets.only(bottom: 10),
      padding:
          const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF281D27),
        borderRadius:
            BorderRadius.circular(17),
        border: Border.all(
          color: const Color(0xFF8B3040),
        ),
      ),
      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.warning_amber,
                color: Color(0xFFFF6575),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment:
                      CrossAxisAlignment.start,
                  children: [
                    Text(
                      alert["patientName"] ??
                          "Patient",
                      style:
                          const TextStyle(
                        fontWeight:
                            FontWeight.bold,
                      ),
                    ),
                    Text(
                      "Room ${alert["room"]}",
                      style:
                          const TextStyle(
                        color:
                            Color(0xFF8CA0AA),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _riskBadge(
                alert["risk"] ?? "HIGH",
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            alert["summary"] ??
                "Immediate attention recommended.",
            style: const TextStyle(
              color: Color(0xFFFF6575),
              fontSize: 12,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================
  // VITAL
  // ====================================================

  Widget _vital(
    String icon,
    String value,
    String label,
  ) {
    return Expanded(
      child: Column(
        children: [
          Text(
            icon,
            style: const TextStyle(
              color: Color(0xFF20C8C8),
              fontSize: 19,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
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

  // ====================================================
  // RISK BADGE
  // ====================================================

  Widget _riskBadge(String risk) {
    Color background;
    Color text;

    switch (risk.toUpperCase()) {
      case "HIGH":
      case "CRITICAL":
        background =
            const Color(0xFF3B202D);
        text =
            const Color(0xFFFF5B6E);
        break;

      case "MODERATE":
        background =
            const Color(0xFF393326);
        text =
            const Color(0xFFF4B53F);
        break;

      default:
        background =
            const Color(0xFF12382F);
        text =
            const Color(0xFF35D78A);
    }

    return Container(
      padding:
          const EdgeInsets.symmetric(
        horizontal: 9,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius:
            BorderRadius.circular(12),
      ),
      child: Text(
        risk,
        style: TextStyle(
          color: text,
          fontSize: 9,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

// ======================================================
// PATIENT DETAILS
// ======================================================

class PatientDetailsScreen extends StatefulWidget {
  final String patientId;

  const PatientDetailsScreen({
    super.key,
    required this.patientId,
  });

  @override
  State<PatientDetailsScreen> createState() =>
      _PatientDetailsScreenState();
}

class _PatientDetailsScreenState
    extends State<PatientDetailsScreen> {
  Map<String, dynamic>? patient;

  bool loading = true;
  String error = "";

  Timer? refreshTimer;

  // ====================================================
  // ACTUATOR STATE
  // ====================================================

  bool fanStatus = false;
  bool buzzerStatus = false;

  bool controllingFan = false;
  bool controllingBuzzer = false;

  @override
  void initState() {
    super.initState();

    loadPatient();

    // Live patient refresh
    refreshTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) {
        loadPatient();
      },
    );
  }

  @override
  void dispose() {
    refreshTimer?.cancel();
    super.dispose();
  }

  // ====================================================
  // LOAD PATIENT
  // ====================================================

  Future<void> loadPatient() async {
    try {
      final data = await ApiService.getPatient(
        widget.patientId,
      );

      if (!mounted) return;

      setState(() {
        patient = data;
        loading = false;
        error = "";

        // Only initialize actuator state if
        // we don't already have a local control state.
        if (!controllingFan &&
            !controllingBuzzer) {
          final action =
              data["recommendedAction"];

          if (action is Map) {
            fanStatus =
                action["fan"] == true;
            buzzerStatus =
                action["buzzer"] == true;
          }
        }
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        loading = false;
        error =
            "Unable to load patient details";
      });

      debugPrint(
        "Patient details error: $e",
      );
    }
  }

  // ====================================================
  // CONTROL FAN
  // ====================================================

  Future<void> toggleFan() async {
    if (patient == null || controllingFan) {
      return;
    }

    final roomId =
        patient!["room"].toString();

    final newStatus = !fanStatus;

    setState(() {
      controllingFan = true;
    });

    try {
      await ApiService.controlRoom(
        roomId,
        fan: newStatus,
        buzzer: buzzerStatus,
      );

      if (!mounted) return;

      setState(() {
        fanStatus = newStatus;
        controllingFan = false;
      });

      ScaffoldMessenger.of(context)
          .showSnackBar(
        SnackBar(
          content: Text(
            "Fan ${newStatus ? "turned ON" : "turned OFF"}",
          ),
          duration:
              const Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        controllingFan = false;
      });

      ScaffoldMessenger.of(context)
          .showSnackBar(
        const SnackBar(
          content: Text(
            "Failed to control fan",
          ),
        ),
      );

      debugPrint(
        "Fan control error: $e",
      );
    }
  }

  // ====================================================
  // CONTROL BUZZER
  // ====================================================

  Future<void> toggleBuzzer() async {
    if (patient == null ||
        controllingBuzzer) {
      return;
    }

    final roomId =
        patient!["room"].toString();

    final newStatus = !buzzerStatus;

    setState(() {
      controllingBuzzer = true;
    });

    try {
      await ApiService.controlRoom(
        roomId,
        fan: fanStatus,
        buzzer: newStatus,
      );

      if (!mounted) return;

      setState(() {
        buzzerStatus = newStatus;
        controllingBuzzer = false;
      });

      ScaffoldMessenger.of(context)
          .showSnackBar(
        SnackBar(
          content: Text(
            "Buzzer ${newStatus ? "turned ON" : "turned OFF"}",
          ),
          duration:
              const Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        controllingBuzzer = false;
      });

      ScaffoldMessenger.of(context)
          .showSnackBar(
        const SnackBar(
          content: Text(
            "Failed to control buzzer",
          ),
        ),
      );

      debugPrint(
        "Buzzer control error: $e",
      );
    }
  }

  // ====================================================
  // RISK BADGE
  // ====================================================

  Widget _riskBadge(String risk) {
    Color background;
    Color text;

    switch (risk.toUpperCase()) {
      case "HIGH":
      case "CRITICAL":
        background =
            const Color(0xFF3B202D);
        text =
            const Color(0xFFFF5B6E);
        break;

      case "MODERATE":
        background =
            const Color(0xFF393326);
        text =
            const Color(0xFFF4B53F);
        break;

      default:
        background =
            const Color(0xFF12382F);
        text =
            const Color(0xFF35D78A);
    }

    return Container(
      padding:
          const EdgeInsets.symmetric(
        horizontal: 9,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius:
            BorderRadius.circular(12),
      ),
      child: Text(
        risk,
        style: TextStyle(
          color: text,
          fontSize: 9,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  // ====================================================
  // BUILD
  // ====================================================

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text(
            "Patient Details",
          ),
        ),
        body: const Center(
          child: CircularProgressIndicator(
            color: Color(0xFF20C8C8),
          ),
        ),
      );
    }

    if (error.isNotEmpty ||
        patient == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text(
            "Patient Details",
          ),
        ),
        body: Center(
          child: Text(
            error.isNotEmpty
                ? error
                : "Patient not found",
          ),
        ),
      );
    }

    final p = patient!;

    final reasons =
        (p["riskReasons"] as List?)
                ?.cast<dynamic>() ??
            [];

    final room =
        p["roomContext"] is Map
            ? p["roomContext"]
            : <String, dynamic>{};

    final action =
        p["recommendedAction"] is Map
            ? p["recommendedAction"]
            : <String, dynamic>{};

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          "Patient Details",
        ),
      ),
      body: RefreshIndicator(
        onRefresh: loadPatient,
        color: const Color(0xFF20C8C8),
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            // =================================================
            // PATIENT PROFILE
            // =================================================

            Container(
              padding:
                  const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color:
                    const Color(0xFF12353B),
                borderRadius:
                    BorderRadius.circular(18),
                border: Border.all(
                  color:
                      const Color(0xFF14606A),
                ),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor:
                        const Color(0xFF103943),
                    child: Text(
                      p["patientId"]
                          .toString()
                          .replaceFirst(
                            "P",
                            "",
                          ),
                      style:
                          const TextStyle(
                        color:
                            Color(0xFF20C8C8),
                        fontSize: 20,
                        fontWeight:
                            FontWeight.bold,
                      ),
                    ),
                  ),

                  const SizedBox(width: 15),

                  Expanded(
                    child: Column(
                      crossAxisAlignment:
                          CrossAxisAlignment.start,
                      children: [
                        Text(
                          p["name"] ??
                              "Patient",
                          style:
                              const TextStyle(
                            fontSize: 19,
                            fontWeight:
                                FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          "Patient ID: ${p["patientId"]}",
                          style:
                              const TextStyle(
                            color:
                                Color(0xFF8CA0AA),
                            fontSize: 12,
                          ),
                        ),
                        Text(
                          "Room ${p["room"]}",
                          style:
                              const TextStyle(
                            color:
                                Color(0xFF8CA0AA),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),

                  _riskBadge(
                    p["risk"] ?? "LOW",
                  ),
                ],
              ),
            ),

            const SizedBox(height: 25),

            // =================================================
            // LIVE VITALS
            // =================================================

            const Text(
              "Live Vitals",
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: 12),

            _detailCard(
              "♥",
              "Heart Rate",
              "${p["heartRate"]} BPM",
            ),

            _detailCard(
              "≋",
              "SpO₂",
              "${p["spo2"]}%",
            ),

            _detailCard(
              "♨",
              "Body Temperature",
              "${p["temperature"]}°C",
            ),

            const SizedBox(height: 20),

            // =================================================
            // ROOM ENVIRONMENT
            // =================================================

            const Text(
              "Room Environment",
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: 12),

            _detailCard(
              "🌡️",
              "Room Temperature",
              room["temperature"] != null
                  ? "${room["temperature"]}°C"
                  : "--",
            ),

            _detailCard(
              "💧",
              "Humidity",
              room["humidity"] != null
                  ? "${room["humidity"]}%"
                  : "--",
            ),

            _detailCard(
              "🌬️",
              "Air Quality",
              room["airQuality"] != null
                  ? "${room["airQuality"]}"
                  : "--",
            ),

            _detailCard(
              "👤",
              "Presence",
              room["presenceDetected"] == true
                  ? "Detected"
                  : "Not Detected",
            ),

            const SizedBox(height: 20),

            // =================================================
            // AI RISK ANALYSIS
            // =================================================

            const Text(
              "AI Risk Analysis",
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: 12),

            Container(
              padding:
                  const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color:
                    const Color(0xFF281D27),
                borderRadius:
                    BorderRadius.circular(18),
                border: Border.all(
                  color:
                      const Color(0xFF8B3040),
                ),
              ),
              child: Column(
                crossAxisAlignment:
                    CrossAxisAlignment.start,
                children: [
                  _riskBadge(
                    p["risk"] ?? "LOW",
                  ),

                  const SizedBox(height: 12),

                  Text(
                    "Risk Score: ${p["riskScore"] ?? 0}",
                    style:
                        const TextStyle(
                      fontSize: 16,
                      fontWeight:
                          FontWeight.bold,
                    ),
                  ),

                  const SizedBox(height: 10),

                  Text(
                    p["riskSummary"] ??
                        "No risk summary available.",
                    style:
                        const TextStyle(
                      color:
                          Color(0xFFB8C5CA),
                      fontSize: 13,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // =================================================
            // RISK REASONS
            // =================================================

            const Text(
              "Why This Risk Was Assigned",
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: 12),

            if (reasons.isEmpty)
              const Text(
                "No contributing factors detected.",
                style: TextStyle(
                  color: Color(0xFF8295A1),
                ),
              )
            else
              ...reasons.map(
                (reason) =>
                    _reasonCard(reason),
              ),

            const SizedBox(height: 20),

            // =================================================
            // RECOMMENDED ROOM ACTION
            // =================================================

            const Text(
              "Recommended Room Action",
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: 12),

            Container(
              padding:
                  const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color:
                    const Color(0xFF12353B),
                borderRadius:
                    BorderRadius.circular(18),
                border: Border.all(
                  color:
                      const Color(0xFF14606A),
                ),
              ),
              child: Column(
                crossAxisAlignment:
                    CrossAxisAlignment.start,
                children: [
                  // =================================================
                  // ACTUAL CONTROL BUTTONS
                  // =================================================

                  Row(
                    children: [
                      Expanded(
                        child: _controlBox(
                          title: "Fan",
                          enabled: fanStatus,
                          loading: controllingFan,
                          onPressed: toggleFan,
                          icon: Icons.air,
                        ),
                      ),

                      const SizedBox(width: 12),

                      Expanded(
                        child: _controlBox(
                          title: "Buzzer",
                          enabled: buzzerStatus,
                          loading: controllingBuzzer,
                          onPressed: toggleBuzzer,
                          icon: Icons.notifications_active,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 18),

                  const Text(
                    "AI Recommendation",
                    style: TextStyle(
                      color: Color(0xFF20C8C8),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),

                  const SizedBox(height: 7),

                  Text(
                    action["reason"] ??
                        "No immediate room intervention is required.",
                    style:
                        const TextStyle(
                      color:
                          Color(0xFFB8C5CA),
                      fontSize: 13,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 25),
          ],
        ),
      ),
    );
  }

  // ====================================================
  // DETAIL CARD
  // ====================================================

  Widget _detailCard(
    String icon,
    String title,
    String value,
  ) {
    return Container(
      margin:
          const EdgeInsets.only(bottom: 10),
      padding:
          const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color:
            const Color(0xFF141E2D),
        borderRadius:
            BorderRadius.circular(15),
        border: Border.all(
          color:
              const Color(0xFF263747),
        ),
      ),
      child: Row(
        children: [
          Text(
            icon,
            style: const TextStyle(
              fontSize: 25,
              color:
                  Color(0xFF20C8C8),
            ),
          ),

          const SizedBox(width: 15),

          Expanded(
            child: Column(
              crossAxisAlignment:
                  CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style:
                      const TextStyle(
                    color:
                        Color(0xFF8497A3),
                    fontSize: 12,
                  ),
                ),

                const SizedBox(height: 5),

                Text(
                  value,
                  style:
                      const TextStyle(
                    fontSize: 19,
                    fontWeight:
                        FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================
  // REASON CARD
  // ====================================================

  Widget _reasonCard(dynamic reason) {
    return Container(
      margin:
          const EdgeInsets.only(bottom: 10),
      padding:
          const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color:
            const Color(0xFF141E2D),
        borderRadius:
            BorderRadius.circular(15),
        border: Border.all(
          color:
              const Color(0xFF66532E),
        ),
      ),
      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  reason["factor"] ??
                      "Risk Factor",
                  style:
                      const TextStyle(
                    fontWeight:
                        FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ),

              Text(
                reason["severity"] ??
                    "MODERATE",
                style:
                    const TextStyle(
                  color:
                      Color(0xFFF4B53F),
                  fontSize: 10,
                  fontWeight:
                      FontWeight.bold,
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          Text(
            "Value: ${reason["value"]}",
            style:
                const TextStyle(
              color:
                  Color(0xFF20C8C8),
              fontSize: 12,
              fontWeight:
                  FontWeight.bold,
            ),
          ),

          const SizedBox(height: 7),

          Text(
            reason["explanation"] ?? "",
            style:
                const TextStyle(
              color:
                  Color(0xFF91A1AA),
              fontSize: 12,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================
  // REAL FAN / BUZZER CONTROL BOX
  // ====================================================

  Widget _controlBox({
    required String title,
    required bool enabled,
    required bool loading,
    required VoidCallback onPressed,
    required IconData icon,
  }) {
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding:
              const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: enabled
                ? const Color(0xFF172923)
                : const Color(0xFF101A27),
            borderRadius:
                BorderRadius.circular(12),
            border: Border.all(
              color: enabled
                  ? const Color(0xFF216B50)
                  : const Color(0xFF263747),
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: enabled
                    ? const Color(0xFF35D78A)
                    : const Color(0xFF718692),
                size: 28,
              ),

              const SizedBox(height: 7),

              Text(
                title,
                style:
                    const TextStyle(
                  fontWeight:
                      FontWeight.bold,
                ),
              ),

              const SizedBox(height: 4),

              Text(
                enabled ? "ON" : "OFF",
                style: TextStyle(
                  color: enabled
                      ? const Color(0xFF35D78A)
                      : const Color(0xFF718692),
                  fontSize: 12,
                  fontWeight:
                      FontWeight.bold,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 8),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed:
                loading ? null : onPressed,
            style:
                ElevatedButton.styleFrom(
              backgroundColor: enabled
                  ? const Color(0xFF8B3040)
                  : const Color(0xFF14606A),
              foregroundColor:
                  Colors.white,
              padding:
                  const EdgeInsets.symmetric(
                vertical: 10,
              ),
              shape:
                  RoundedRectangleBorder(
                borderRadius:
                    BorderRadius.circular(10),
              ),
            ),
            child: loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child:
                        CircularProgressIndicator(
                      strokeWidth: 2,
                    ),
                  )
                : Text(
                    enabled
                        ? "TURN OFF"
                        : "TURN ON",
                    style:
                        const TextStyle(
                      fontSize: 11,
                      fontWeight:
                          FontWeight.bold,
                    ),
                  ),
          ),
        ),
      ],
    );
  }
}