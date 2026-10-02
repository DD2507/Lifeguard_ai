import 'dart:async';

import 'package:flutter/material.dart';

import 'app_theme.dart';

import 'api_service.dart';
import 'models/prescription.dart';
import 'screens/alerts_screen.dart';
import 'screens/patients_screen.dart';
import 'screens/rooms_screen.dart';
import 'screens/login_screen.dart';
import 'services/bpm_baseline_collector.dart';
import 'services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService().initialize();
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

      navigatorKey: NotificationService.navigatorKey,

      title: 'LifeGuard AI',

      theme: buildLifeGuardTheme(),

      home: const LoginScreen(),
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

    refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      loadData();
    });
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
      NotificationService().recoverMedicineAlerts(results[1]);
    } catch (e) {
      if (!mounted) return;

      setState(() {
        loading = false;

        error = "Unable to connect to LifeGuard AI server";
      });

      debugPrint("API error: $e");
    }
  }

  Future<void> acknowledgeAlert(String alertId) async {
    await ApiService.acknowledgeAlert(alertId);
    await loadData();

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("Patient alert acknowledged"),
        backgroundColor: LifeGuardColors.emerald,
      ),
    );
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

              padding: const EdgeInsets.fromLTRB(18, 12, 18, 12),

              decoration: const BoxDecoration(
                color: LifeGuardColors.surface,

                border: Border(
                  bottom: BorderSide(color: LifeGuardColors.border),
                ),
              ),

              child: Row(
                children: [
                  const Expanded(
                    child: Row(
                      children: [
                        DecoratedBox(
                          decoration: BoxDecoration(
                            color: LifeGuardColors.lime,
                            borderRadius: BorderRadius.all(Radius.circular(5)),
                          ),
                          child: SizedBox(
                            width: 28,
                            height: 28,
                            child: Icon(
                              Icons.add_rounded,
                              size: 20,
                              color: LifeGuardColors.ink,
                            ),
                          ),
                        ),
                        SizedBox(width: 9),
                        Text(
                          "LIFEGUARD.AI",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // LOGOUT BUTTON
                  IconButton(
                    tooltip: "Logout",

                    icon: const Icon(Icons.logout, color: LifeGuardColors.ink),

                    onPressed: () {
                      Navigator.pushAndRemoveUntil(
                        context,

                        MaterialPageRoute(builder: (_) => const LoginScreen()),

                        (route) => false,
                      );
                    },
                  ),

                  // EXISTING LIVE STATUS
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 6,
                    ),

                    decoration: BoxDecoration(
                      color: LifeGuardColors.emeraldSoft,

                      borderRadius: BorderRadius.circular(20),
                    ),

                    child: const Row(
                      children: [
                        Icon(
                          Icons.circle,
                          size: 8,
                          color: LifeGuardColors.emerald,
                        ),

                        SizedBox(width: 6),

                        Text(
                          "SYSTEM CONNECTED",

                          style: TextStyle(
                            color: LifeGuardColors.emerald,

                            fontSize: 9,

                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            Expanded(child: _buildCurrentPage()),
          ],
        ),
      ),

      // ====================================================

      // BOTTOM NAVIGATION

      // ====================================================
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: changePage,
        backgroundColor: LifeGuardColors.surface,
        indicatorColor: LifeGuardColors.lime,
        elevation: 8,
        height: 72,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: "Dashboard",
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people),
            label: "Patients",
          ),
          NavigationDestination(
            icon: Icon(Icons.warning_amber_outlined),
            selectedIcon: Icon(Icons.warning_amber),
            label: "Alerts",
          ),
          NavigationDestination(
            icon: Icon(Icons.meeting_room_outlined),
            selectedIcon: Icon(Icons.meeting_room),
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

        onAcknowledge: acknowledgeAlert,
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

String _nurseGreetingForHour(int hour) {
  if (hour >= 5 && hour < 12) {
    return "Good morning, Nurse";
  }
  if (hour >= 12 && hour < 17) {
    return "Good afternoon, Nurse";
  }
  return "Good evening, Nurse";
}

class _DashboardGreeting extends StatefulWidget {
  const _DashboardGreeting();

  @override
  State<_DashboardGreeting> createState() => _DashboardGreetingState();
}

class _DashboardGreetingState extends State<_DashboardGreeting> {
  late String _greeting;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _greeting = _nurseGreetingForHour(DateTime.now().hour);
    _timer = Timer.periodic(const Duration(minutes: 1), (_) {
      _updateGreeting();
    });
  }

  void _updateGreeting() {
    final greeting = _nurseGreetingForHour(DateTime.now().hour);
    if (!mounted || greeting == _greeting) return;
    setState(() {
      _greeting = greeting;
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      _greeting,
      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
    );
  }
}

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
        child: CircularProgressIndicator(color: LifeGuardColors.emerald),
      );
    }

    if (error.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(25),

          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,

            children: [
              const Icon(
                Icons.cloud_off,
                size: 50,
                color: LifeGuardColors.rose,
              ),

              const SizedBox(height: 15),

              Text(
                error,

                textAlign: TextAlign.center,

                style: const TextStyle(color: LifeGuardColors.rose),
              ),

              const SizedBox(height: 15),

              ElevatedButton(onPressed: onRefresh, child: const Text("Retry")),
            ],
          ),
        ),
      );
    }

    final lowRisk = patients.where((p) => p["risk"] == "LOW").length;

    final highRisk = patients
        .where((p) => p["risk"] == "HIGH" || p["risk"] == "CRITICAL")
        .length;

    return RefreshIndicator(
      onRefresh: onRefresh,

      color: LifeGuardColors.emerald,

      child: ListView(
        padding: const EdgeInsets.all(18),

        children: [
          // =================================================

          // WELCOME

          // =================================================
          Container(
            padding: const EdgeInsets.all(18),

            decoration: BoxDecoration(
              color: LifeGuardColors.surface,

              borderRadius: BorderRadius.circular(8),

              border: Border.all(color: LifeGuardColors.border),
            ),

            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: LifeGuardColors.limeSoft,
                        borderRadius: BorderRadius.all(Radius.circular(20)),
                      ),
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        child: Text(
                          "SHIFT OVERVIEW · INTENSIVE CARE UNIT",
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                    Spacer(),
                    Icon(
                      Icons.favorite_border,
                      size: 20,
                      color: LifeGuardColors.rose,
                    ),
                  ],
                ),
                SizedBox(height: 12),
                _DashboardGreeting(),
                SizedBox(height: 5),
                Text(
                  "Here is the latest overview of your patients.",
                  style: TextStyle(color: LifeGuardColors.muted, fontSize: 12),
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
                child: _statCard("Patients", patients.length, Icons.people),
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
                child: _statCard("High Risk", highRisk, Icons.warning_amber),
              ),
            ],
          ),

          const SizedBox(height: 25),

          // =================================================

          // ALERT HEADER

          // =================================================
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,

            children: [
              const Text(
                "🚨 Active Alerts",

                style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
              ),

              Text(
                "${alerts.length} Active",

                style: const TextStyle(
                  color: LifeGuardColors.rose,

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
                color: LifeGuardColors.emeraldSoft,

                borderRadius: BorderRadius.circular(8),

                border: Border.all(color: LifeGuardColors.emerald),
              ),

              child: const Center(
                child: Text(
                  "✓ No active alerts currently detected",

                  style: TextStyle(color: LifeGuardColors.emerald),
                ),
              ),
            )
          else
            ...alerts.take(3).map((alert) => _alertCard(alert)),

          const SizedBox(height: 25),

          // =================================================

          // PATIENT MONITORING

          // =================================================
          const Text(
            "Patient Monitoring",

            style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
          ),

          const SizedBox(height: 12),

          ...patients.map((patient) => _patientCard(context, patient)),
        ],
      ),
    );
  }

  // ====================================================

  // STAT CARD

  // ====================================================

  Widget _statCard(String title, int value, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),

      decoration: BoxDecoration(
        color: LifeGuardColors.surface,

        borderRadius: BorderRadius.circular(8),

        border: Border.all(color: LifeGuardColors.border),
      ),

      child: Column(
        children: [
          Icon(icon, color: LifeGuardColors.emerald, size: 22),

          const SizedBox(height: 8),

          Text(
            "$value",

            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),

          const SizedBox(height: 3),

          Text(
            title,

            style: const TextStyle(color: LifeGuardColors.muted, fontSize: 11),
          ),
        ],
      ),
    );
  }

  // ====================================================

  // PATIENT CARD

  // ====================================================

  Widget _patientCard(BuildContext context, dynamic patient) {
    final risk = patient["risk"] ?? "LOW";

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,

          MaterialPageRoute(
            builder: (_) =>
                PatientDetailsScreen(patientId: patient["patientId"]),
          ),
        );
      },

      child: Container(
        margin: const EdgeInsets.only(bottom: 12),

        padding: const EdgeInsets.all(17),

        decoration: BoxDecoration(
          color: LifeGuardColors.surface,

          borderRadius: BorderRadius.circular(8),

          border: Border.all(color: LifeGuardColors.border),
        ),

        child: Column(
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: LifeGuardColors.limeSoft,

                  child: Text(
                    (patient["patientId"] ?? "P").toString().replaceFirst(
                      "P",

                      "",
                    ),

                    style: const TextStyle(
                      color: LifeGuardColors.ink,

                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),

                const SizedBox(width: 12),

                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,

                    children: [
                      Text(
                        patient["name"] ?? "Unknown Patient",

                        style: const TextStyle(
                          fontWeight: FontWeight.bold,

                          fontSize: 15,
                        ),
                      ),

                      const SizedBox(height: 4),

                      Text(
                        "Room ${patient["room"]}",

                        style: const TextStyle(
                          color: LifeGuardColors.muted,

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
                _vital("♥", "${patient["heartRate"]} BPM", "Heart Rate"),

                _vital("≋", "${patient["spo2"]}%", "SpO₂"),

                _vital("♨", "${patient["temperature"]}°C", "Temp"),
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
      margin: const EdgeInsets.only(bottom: 10),

      padding: const EdgeInsets.all(16),

      decoration: BoxDecoration(
        color: LifeGuardColors.roseSoft,

        borderRadius: BorderRadius.circular(8),

        border: Border.all(color: LifeGuardColors.rose),
      ),

      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,

        children: [
          Row(
            children: [
              const Icon(Icons.warning_amber, color: LifeGuardColors.rose),

              const SizedBox(width: 10),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,

                  children: [
                    Text(
                      alert["patientName"] ?? "Patient",

                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),

                    Text(
                      "Room ${alert["room"]}",

                      style: const TextStyle(
                        color: LifeGuardColors.muted,

                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),

              _riskBadge(alert["risk"] ?? "HIGH"),
            ],
          ),

          const SizedBox(height: 12),

          Text(
            alert["summary"] ?? "Immediate attention recommended.",

            style: const TextStyle(
              color: LifeGuardColors.rose,

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

  Widget _vital(String icon, String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(
            icon,

            style: const TextStyle(
              color: LifeGuardColors.emerald,
              fontSize: 19,
            ),
          ),

          const SizedBox(height: 4),

          Text(
            value,

            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),

          Text(
            label,

            style: const TextStyle(color: LifeGuardColors.muted, fontSize: 9),
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
        background = LifeGuardColors.roseSoft;

        text = LifeGuardColors.rose;

        break;

      case "MODERATE":
        background = LifeGuardColors.amberSoft;

        text = LifeGuardColors.amber;

        break;

      case "HAND NOT DETECTED":
      case "CALCULATE BASELINE":
      case "RISK UNAVAILABLE":
        background = const Color(0xFFE8ECEA);
        text = LifeGuardColors.muted;
        break;

      default:
        background = LifeGuardColors.emeraldSoft;

        text = LifeGuardColors.emerald;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),

      decoration: BoxDecoration(
        color: background,

        borderRadius: BorderRadius.circular(12),
      ),

      child: Text(
        risk,

        style: TextStyle(color: text, fontSize: 9, fontWeight: FontWeight.bold),
      ),
    );
  }
}

// ======================================================
// PATIENT DETAILS
// ======================================================

class PatientDetailsScreen extends StatefulWidget {
  final String patientId;

  const PatientDetailsScreen({super.key, required this.patientId});

  @override
  State<PatientDetailsScreen> createState() => _PatientDetailsScreenState();
}

class _PatientDetailsScreenState extends State<PatientDetailsScreen> {
  Map<String, dynamic>? patient;

  bool loading = true;

  String error = "";

  Timer? refreshTimer;
  bool collectingBpmBaseline = false;
  bool savingBpmBaseline = false;
  final BpmBaselineCollector bpmBaselineCollector = BpmBaselineCollector();
  Map<String, dynamic>? savedBpmBaseline;
  String bpmBaselineMessage = "";

  // ====================================================
  // PRESCRIPTION STATE
  // ====================================================

  List<Prescription> prescriptions = [];

  bool loadingPrescriptions = false;

  bool updatingPrescription = false;

  Map<String, dynamic>? digitalTwin;
  Map<String, dynamic>? simulationResult;
  bool loadingDigitalTwin = false;
  bool simulating = false;

  final List<String> scenarioOptions = [
    "REDUCED_OXYGEN",
    "FEVER_LIKE",
    "ELEVATED_HEART_RATE",
    "COMBINED_DETERIORATION",
    "POOR_ROOM_ENVIRONMENT",
  ];

  String selectedScenario = "REDUCED_OXYGEN";
  final Map<String, TextEditingController> manualControllers = {
    "heartRate": TextEditingController(),
    "spo2": TextEditingController(),
    "temperature": TextEditingController(),
    "roomTemperature": TextEditingController(),
    "humidity": TextEditingController(),
    "airQuality": TextEditingController(),
  };

  @override
  void initState() {
    super.initState();

    loadPatient();
    loadPrescriptions();
    loadDigitalTwin();

    // Live patient refresh
    refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      loadPatient();
      loadPrescriptions();
      loadDigitalTwin();
    });
  }

  @override
  void dispose() {
    refreshTimer?.cancel();
    for (final controller in manualControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  // ====================================================
  // LOAD PATIENT
  // ====================================================

  Future<void> loadPatient() async {
    try {
      final data = await ApiService.getPatient(widget.patientId);

      if (!mounted) return;

      setState(() {
        patient = data;

        loading = false;

        error = "";
      });

      _recordBpmBaselineSample(data);
    } catch (e) {
      if (!mounted) return;

      setState(() {
        loading = false;

        error = "Unable to load patient details";
      });

      debugPrint("Patient details error: $e");
    }
  }

  double? _validBaselineVital(dynamic value, double minimum, double maximum) {
    if (value == null || value.toString().trim().isEmpty) return null;
    final parsed = double.tryParse(value.toString());
    return parsed != null &&
            parsed.isFinite &&
            parsed >= minimum &&
            parsed <= maximum
        ? parsed
        : null;
  }

  void _recordBpmBaselineSample(Map<String, dynamic>? reading) {
    if (!collectingBpmBaseline || savingBpmBaseline || reading == null) return;
    if (!bpmBaselineCollector.add(reading)) return;
    if (bpmBaselineCollector.count >= BpmBaselineCollector.maximumReadings) {
      _saveBpmBaseline();
    } else if (mounted) {
      setState(() {});
    }
  }

  void _startBpmBaselineCollection() {
    if (collectingBpmBaseline || savingBpmBaseline) return;
    bpmBaselineCollector.clear();
    setState(() {
      collectingBpmBaseline = true;
      savedBpmBaseline = null;
      bpmBaselineMessage = "";
    });
    _recordBpmBaselineSample(patient);
  }

  Future<void> _saveBpmBaseline() async {
    if (savingBpmBaseline ||
        bpmBaselineCollector.count < BpmBaselineCollector.minimumReadings) {
      return;
    }
    final samples = bpmBaselineCollector.readings
        .take(BpmBaselineCollector.maximumReadings)
        .map((sample) => Map<String, dynamic>.from(sample))
        .toList();
    setState(() {
      collectingBpmBaseline = false;
      savingBpmBaseline = true;
      bpmBaselineMessage = "Saving baseline...";
    });

    try {
      final result = await ApiService.savePatientBaseline(
        widget.patientId,
        samples,
      );
      final baseline = result["baseline"] is Map
          ? Map<String, dynamic>.from(result["baseline"] as Map)
          : <String, dynamic>{};
      if (!mounted) return;
      setState(() {
        savedBpmBaseline = baseline;
        savingBpmBaseline = false;
        bpmBaselineMessage =
            result["message"]?.toString() ??
            "Baseline saved using ${baseline["sampleCount"] ?? samples.length} valid readings.";
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(bpmBaselineMessage)));
      await loadPatient();
      await loadDigitalTwin();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        savingBpmBaseline = false;
        bpmBaselineMessage = e.toString().replaceFirst("Exception: ", "");
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(bpmBaselineMessage)));
    }
  }

  // ====================================================
  // LOAD PRESCRIPTIONS
  // ====================================================

  Future<void> loadPrescriptions() async {
    if (loadingPrescriptions) return;

    setState(() {
      loadingPrescriptions = true;
    });

    try {
      final data = await ApiService.getPrescriptions(widget.patientId);

      final loadedPrescriptions = data
          .whereType<Map>()
          .map((item) => Prescription.fromJson(Map<String, dynamic>.from(item)))
          .toList();

      // Synchronize active prescriptions
      // with the local notification service.
      await NotificationService().syncPrescriptions(loadedPrescriptions);

      if (!mounted) return;

      setState(() {
        prescriptions = loadedPrescriptions;

        loadingPrescriptions = false;
      });

      debugPrint(
        "Loaded ${loadedPrescriptions.length} prescriptions "
        "for ${widget.patientId}",
      );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        loadingPrescriptions = false;
      });

      debugPrint("Prescription loading error: $e");
    }
  }

  Future<void> loadDigitalTwin() async {
    if (loadingDigitalTwin) return;

    setState(() {
      loadingDigitalTwin = true;
    });

    try {
      final data = await ApiService.getDigitalTwin(widget.patientId);
      if (!mounted) return;
      final baseline = data["baseline"] is Map
          ? Map<String, dynamic>.from(data["baseline"] as Map)
          : null;
      final dataQuality = data["dataQuality"] is Map
          ? Map<String, dynamic>.from(data["dataQuality"] as Map)
          : <String, dynamic>{};
      setState(() {
        digitalTwin = data;
        if (dataQuality["status"] == "ESTABLISHED" && baseline != null) {
          savedBpmBaseline = {
            ...baseline,
            "sampleCount": dataQuality["sampleCount"],
          };
        }
        loadingDigitalTwin = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        loadingDigitalTwin = false;
      });
      debugPrint("Digital twin load error: $e");
    }
  }

  Future<void> runSimulation() async {
    if (simulating) return;

    setState(() {
      simulating = true;
    });

    try {
      final payload = <String, dynamic>{};
      final scenario = selectedScenario;
      if (scenario.isNotEmpty) {
        payload["scenario"] = scenario;
      }

      final manualValues = <String, dynamic>{};
      for (final entry in manualControllers.entries) {
        final value = entry.value.text.trim();
        if (value.isNotEmpty) {
          manualValues[entry.key] = double.parse(value);
        }
      }

      if (manualValues.isNotEmpty) {
        payload.addAll(manualValues);
      }

      final result = await ApiService.simulateWhatIf(widget.patientId, payload);
      if (!mounted) return;
      setState(() {
        simulationResult = result;
        simulating = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        simulating = false;
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text("Simulation failed: $e")));
      debugPrint("Simulation error: $e");
    }
  }

  // ====================================================
  // MARK PRESCRIPTION COMPLETED
  // ====================================================

  Future<void> markPrescriptionCompleted(Prescription prescription) async {
    if (updatingPrescription) return;

    setState(() {
      updatingPrescription = true;
    });

    try {
      await ApiService.updatePrescriptionStatus(prescription.id, "COMPLETED");

      await NotificationService().cancelReminder(prescription.id);

      await loadPrescriptions();

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Prescription marked as completed"),
          duration: Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Failed to update prescription")),
      );

      debugPrint("Prescription update error: $e");
    } finally {
      if (mounted) {
        setState(() {
          updatingPrescription = false;
        });
      }
    }
  }

  // ====================================================
  // DELETE PRESCRIPTION
  // ====================================================

  Future<void> deletePrescription(Prescription prescription) async {
    if (updatingPrescription) return;

    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("Delete Prescription"),
          content: Text("Delete ${prescription.treatmentName}?"),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context, false);
              },
              child: const Text("CANCEL"),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context, true);
              },
              child: const Text("DELETE"),
            ),
          ],
        );
      },
    );

    if (shouldDelete != true) {
      return;
    }

    setState(() {
      updatingPrescription = true;
    });

    try {
      await ApiService.deletePrescription(prescription.id);

      await NotificationService().cancelReminder(prescription.id);

      await loadPrescriptions();

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Prescription deleted"),
          duration: Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Failed to delete prescription")),
      );

      debugPrint("Prescription delete error: $e");
    } finally {
      if (mounted) {
        setState(() {
          updatingPrescription = false;
        });
      }
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
        background = LifeGuardColors.roseSoft;

        text = const Color(0xFFFF5B6E);

        break;

      case "MODERATE":
        background = LifeGuardColors.amberSoft;

        text = LifeGuardColors.amber;

        break;

      default:
        background = LifeGuardColors.emeraldSoft;

        text = LifeGuardColors.emerald;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        risk,
        style: TextStyle(color: text, fontSize: 9, fontWeight: FontWeight.bold),
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
        appBar: AppBar(title: const Text("Patient Details")),
        body: const Center(
          child: CircularProgressIndicator(color: LifeGuardColors.emerald),
        ),
      );
    }

    if (error.isNotEmpty || patient == null) {
      return Scaffold(
        appBar: AppBar(title: const Text("Patient Details")),
        body: Center(
          child: Text(error.isNotEmpty ? error : "Patient not found"),
        ),
      );
    }

    final p = patient!;

    final handDetected = p["fingerDetected"] == true;
    final baselineEstablished = p["baselineStatus"] == "ESTABLISHED";
    final riskAvailable =
        handDetected && baselineEstablished && p["risk"] != null;
    final displayedRisk = !handDetected
        ? "HAND NOT DETECTED"
        : !baselineEstablished
        ? "CALCULATE BASELINE"
        : p["risk"]?.toString() ?? "RISK UNAVAILABLE";

    final reasons = riskAvailable
        ? (p["riskReasons"] as List?)?.cast<dynamic>() ?? []
        : <dynamic>[];
    final riskSummary = !handDetected
        ? "Hand not detected. Place a finger on the pulse-oximeter sensor to show the risk."
        : !baselineEstablished
        ? "Calculate the 15-reading patient baseline to show the risk."
        : p["riskSummary"] ??
              "Risk assessment is waiting for a valid live sensor reading.";

    final room = p["roomContext"] is Map
        ? p["roomContext"]
        : <String, dynamic>{};

    return Scaffold(
      appBar: AppBar(title: const Text("Patient Details")),
      body: RefreshIndicator(
        onRefresh: () async {
          await loadPatient();
          await loadPrescriptions();
        },
        color: LifeGuardColors.emerald,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            // =================================================
            // PATIENT PROFILE
            // =================================================

            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: LifeGuardColors.limeSoft,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: LifeGuardColors.border),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: LifeGuardColors.limeSoft,
                    child: Text(
                      p["patientId"].toString().replaceFirst("P", ""),
                      style: const TextStyle(
                        color: LifeGuardColors.ink,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),

                  const SizedBox(width: 15),

                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p["name"] ?? "Patient",
                          style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.bold,
                          ),
                        ),

                        const SizedBox(height: 5),

                        Text(
                          "Patient ID: ${p["patientId"]}",
                          style: const TextStyle(
                            color: LifeGuardColors.muted,
                            fontSize: 12,
                          ),
                        ),

                        Text(
                          "Room ${p["room"]}",
                          style: const TextStyle(
                            color: LifeGuardColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),

                  _riskBadge(displayedRisk),
                ],
              ),
            ),

            const SizedBox(height: 25),

            // =================================================
            // LIVE VITALS
            // =================================================
            const Text(
              "Live Vitals",
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 12),

            _detailCard("♥", "Heart Rate", "${p["heartRate"]} BPM"),

            _detailCard("≋", "SpO₂", "${p["spo2"]}%"),

            _detailCard("♨", "Body Temperature", "${p["temperature"]}°C"),

            const SizedBox(height: 20),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: LifeGuardColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: LifeGuardColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Patient Baseline",
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    "Collects 15 distinct valid live readings and saves average heart rate, SpO₂, and body temperature baselines.",
                    style: TextStyle(
                      color: LifeGuardColors.muted,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 18,
                    runSpacing: 12,
                    children: [
                      _roomAverageValue(
                        "Current heart rate",
                        p["sensorStatus"] == "LIVE" &&
                                _validBaselineVital(p["heartRate"], 30, 220) !=
                                    null
                            ? "${_validBaselineVital(p["heartRate"], 30, 220)!.toStringAsFixed(0)} BPM"
                            : "Unavailable",
                      ),
                      _roomAverageValue(
                        "Saved baseline HR",
                        (savedBpmBaseline?["heartRate"] ??
                                    (digitalTwin?["patient"] is Map &&
                                            digitalTwin?["patient"]["patientId"] ==
                                                widget.patientId
                                        ? digitalTwin?["baseline"]?["heartRate"]
                                        : null)) ==
                                null
                            ? "--"
                            : "${savedBpmBaseline?["heartRate"] ?? digitalTwin?["baseline"]?["heartRate"]} BPM",
                      ),
                      _roomAverageValue(
                        "Valid readings",
                        "${collectingBpmBaseline ? bpmBaselineCollector.count : (savedBpmBaseline?["sampleCount"] ?? bpmBaselineCollector.count)}/${BpmBaselineCollector.maximumReadings}",
                      ),
                    ],
                  ),
                  if (savedBpmBaseline != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      "Saved baseline: HR ${savedBpmBaseline!["heartRate"] ?? "--"} BPM, SpO₂ ${savedBpmBaseline!["spo2"] ?? "--"}%, Temp ${savedBpmBaseline!["temperature"] ?? "--"}°C (${savedBpmBaseline!["sampleCount"] ?? "--"} live readings)",
                      style: const TextStyle(
                        color: LifeGuardColors.ink,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: collectingBpmBaseline || savingBpmBaseline
                        ? null
                        : _startBpmBaselineCollection,
                    icon: collectingBpmBaseline || savingBpmBaseline
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.calculate_outlined),
                    label: Text(
                      savingBpmBaseline
                          ? "Saving baseline..."
                          : collectingBpmBaseline
                          ? "Collecting readings... ${bpmBaselineCollector.count}/${BpmBaselineCollector.maximumReadings}"
                          : "Calculate Baseline",
                    ),
                  ),
                  if (collectingBpmBaseline) ...[
                    const SizedBox(height: 8),
                    Text(
                      "${bpmBaselineCollector.count}/${BpmBaselineCollector.maximumReadings} valid readings collected — waiting until all 15 distinct live IoT readings arrive. Collection will not stop early.",
                      style: const TextStyle(
                        color: LifeGuardColors.ink,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  if (bpmBaselineMessage.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      bpmBaselineMessage,
                      style: TextStyle(
                        color: savedBpmBaseline == null
                            ? const Color(0xFFFFC36A)
                            : const Color(0xFF61D6A6),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 20),

            // =================================================
            // ROOM ENVIRONMENT
            // =================================================
            const Text(
              "Room Environment",
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 12),

            _detailCard(
              "🌡️",
              "Room Temperature",
              room["temperature"] != null ? "${room["temperature"]}°C" : "--",
            ),

            _detailCard(
              "💧",
              "Humidity",
              room["humidity"] != null ? "${room["humidity"]}%" : "--",
            ),

            _detailCard(
              "🌬️",
              "Air Quality",
              room["airQuality"] != null ? "${room["airQuality"]}" : "--",
            ),

            _detailCard(
              "👤",
              "Finger Presence",
              patient?["fingerDetected"] == true ? "Detected" : "Not Detected",
            ),

            // =================================================
            // AI RISK ANALYSIS
            // =================================================
            const Text(
              "AI Risk Analysis",
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 12),

            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: LifeGuardColors.roseSoft,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: LifeGuardColors.rose),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _riskBadge(p["risk"] ?? "LOW"),

                  const SizedBox(height: 12),

                  Text(
                    "Risk Score: ${riskAvailable ? (p["riskScore"] ?? "--") : "--"}",
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),

                  const SizedBox(height: 10),

                  Text(
                    riskSummary,
                    style: const TextStyle(
                      color: LifeGuardColors.ink,
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
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 12),

            if (reasons.isEmpty)
              const Text(
                "No contributing factors detected.",
                style: TextStyle(color: LifeGuardColors.muted),
              )
            else
              ...reasons.map((reason) => _reasonCard(reason)),

            const SizedBox(height: 20),

            // =================================================
            // PATIENT DIGITAL TWIN
            // =================================================
            const Text(
              "Patient Digital Twin",
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 12),

            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: LifeGuardColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: LifeGuardColors.border),
              ),
              child: loadingDigitalTwin
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: LifeGuardColors.emerald,
                      ),
                    )
                  : (() {
                      final twin = digitalTwin;
                      if (twin == null) {
                        return const Text(
                          "Digital twin not available yet.",
                          style: TextStyle(color: LifeGuardColors.muted),
                        );
                      }

                      final current =
                          twin["currentState"] as Map? ?? <String, dynamic>{};
                      final twinBaseline =
                          twin["baseline"] as Map? ?? <String, dynamic>{};
                      final dataQuality =
                          twin["dataQuality"] as Map? ?? <String, dynamic>{};
                      final baseline = dataQuality["status"] == "ESTABLISHED"
                          ? twinBaseline
                          : savedBpmBaseline ?? twinBaseline;
                      final baselineCount =
                          dataQuality["status"] == "ESTABLISHED"
                          ? dataQuality["sampleCount"]
                          : savedBpmBaseline?["sampleCount"];
                      final trends =
                          twin["trends"] as Map? ?? <String, dynamic>{};

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Current physiological state",
                            style: TextStyle(
                              color: LifeGuardColors.emerald,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: _detailCard(
                                  "♥",
                                  "Heart Rate",
                                  "${current["heartRate"] ?? "--"} bpm",
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _detailCard(
                                  "≋",
                                  "SpO₂",
                                  "${current["spo2"] ?? "--"}%",
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _detailCard(
                                  "♨",
                                  "Temperature",
                                  "${current["temperature"] ?? "--"}°C",
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: LifeGuardColors.emeraldSoft,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: LifeGuardColors.emerald,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "Saved personal baseline${baselineCount == null ? "" : " ($baselineCount readings)"}",
                                  style: const TextStyle(
                                    color: LifeGuardColors.emerald,
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  "HR: ${baseline["heartRate"] ?? "--"} BPM   •   SpO₂: ${baseline["spo2"] ?? "--"}%   •   Temp: ${baseline["temperature"] ?? "--"}°C",
                                  style: const TextStyle(
                                    color: LifeGuardColors.ink,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    height: 1.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            "Trend: HR ${trends["heartRate"]?["label"] ?? "N/A"}, SpO₂ ${trends["spo2"]?["label"] ?? "N/A"}, Temp ${trends["temperature"]?["label"] ?? "N/A"}",
                            style: const TextStyle(
                              color: LifeGuardColors.ink,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      );
                    })(),
            ),

            const SizedBox(height: 25),

            // =================================================
            // WHAT-IF SIMULATOR
            // =================================================
            const Text(
              "What-If Simulator",
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 12),

            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: LifeGuardColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: LifeGuardColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Scenario",
                    style: TextStyle(
                      color: LifeGuardColors.emerald,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: selectedScenario,
                    decoration: const InputDecoration(
                      filled: true,
                      fillColor: LifeGuardColors.surfaceMuted,
                      border: OutlineInputBorder(),
                    ),
                    items: scenarioOptions.map((value) {
                      return DropdownMenuItem<String>(
                        value: value,
                        child: Text(value.replaceAll("_", " ")),
                      );
                    }).toList(),
                    onChanged: (value) {
                      if (value != null) {
                        setState(() {
                          selectedScenario = value;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    "Manual virtual values (optional)",
                    style: TextStyle(color: LifeGuardColors.ink, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      SizedBox(
                        width: 120,
                        child: TextField(
                          controller: manualControllers["heartRate"],
                          decoration: const InputDecoration(
                            labelText: "HR",
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      SizedBox(
                        width: 120,
                        child: TextField(
                          controller: manualControllers["spo2"],
                          decoration: const InputDecoration(
                            labelText: "SpO₂",
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      SizedBox(
                        width: 130,
                        child: TextField(
                          controller: manualControllers["temperature"],
                          decoration: const InputDecoration(
                            labelText: "Temp",
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      SizedBox(
                        width: 140,
                        child: TextField(
                          controller: manualControllers["roomTemperature"],
                          decoration: const InputDecoration(
                            labelText: "Room Temp",
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      SizedBox(
                        width: 120,
                        child: TextField(
                          controller: manualControllers["humidity"],
                          decoration: const InputDecoration(
                            labelText: "Humidity",
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      SizedBox(
                        width: 120,
                        child: TextField(
                          controller: manualControllers["airQuality"],
                          decoration: const InputDecoration(
                            labelText: "Air Quality",
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: simulating ? null : runSimulation,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: LifeGuardColors.lime,
                      foregroundColor: Colors.black,
                    ),
                    child: Text(
                      simulating ? "Simulating..." : "Simulate Scenario",
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    "Simulation only — this compares virtual physiological readings with the saved personal baseline. It does not predict an actual clinical outcome or provide a diagnosis.",
                    style: TextStyle(
                      color: LifeGuardColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            if (simulationResult != null)
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: LifeGuardColors.emeraldSoft,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: LifeGuardColors.emerald),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Simulated Scenario: ${simulationResult!["scenario"]?["name"] ?? "Manual"}",
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      "Simulated SpO₂: ${simulationResult!["simulatedState"]?["spo2"] ?? "--"}% | Deviation: ${simulationResult!["deviations"]?["spo2"] ?? "--"}",
                      style: const TextStyle(
                        color: LifeGuardColors.ink,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "Simulated Risk: ${simulationResult!["simulatedRisk"]?["risk"] ?? "--"} | Score: ${simulationResult!["simulatedRisk"]?["riskScore"] ?? "--"}",
                      style: const TextStyle(
                        color: LifeGuardColors.ink,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      simulationResult!["simulatedRisk"]?["riskSummary"] ??
                          "No risk summary available.",
                      style: const TextStyle(
                        color: LifeGuardColors.ink,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      "Why did the risk change?",
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...(simulationResult!["simulatedRisk"]?["riskReasons"]
                                as List? ??
                            [])
                        .map(
                          (reason) => Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: LifeGuardColors.surface,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  reason["factor"] ?? "Factor",
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  reason["explanation"] ??
                                      "No explanation available.",
                                  style: const TextStyle(
                                    color: LifeGuardColors.ink,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                  ],
                ),
              ),

            const SizedBox(height: 25),

            // =================================================
            // PRESCRIPTIONS
            // =================================================
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  "Prescriptions & Treatment",
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
                ),

                if (loadingPrescriptions)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: LifeGuardColors.emerald,
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 12),

            if (!loadingPrescriptions && prescriptions.isEmpty)
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: LifeGuardColors.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: LifeGuardColors.border),
                ),
                child: const Column(
                  children: [
                    Icon(
                      Icons.medication_outlined,
                      size: 35,
                      color: LifeGuardColors.muted,
                    ),

                    SizedBox(height: 8),

                    Text(
                      "No prescriptions assigned",
                      style: TextStyle(
                        color: LifeGuardColors.muted,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              )
            else
              ...prescriptions.map(
                (prescription) => _prescriptionCard(prescription),
              ),

            const SizedBox(height: 25),
          ],
        ),
      ),
    );
  }

  // ====================================================
  // PRESCRIPTION CARD
  // ====================================================

  Widget _prescriptionCard(Prescription prescription) {
    final status = prescription.status.toUpperCase();

    final bool active = status == "ACTIVE";

    final bool completed = status == "COMPLETED";

    Color statusColor;

    if (completed) {
      statusColor = LifeGuardColors.emerald;
    } else if (status == "CANCELLED") {
      statusColor = const Color(0xFFFF6575);
    } else {
      statusColor = LifeGuardColors.blue;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: LifeGuardColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: LifeGuardColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ==================================================
          // TITLE + STATUS
          // ==================================================

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: LifeGuardColors.limeSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  prescription.type == "Medication"
                      ? Icons.medication
                      : Icons.medical_services,
                  color: LifeGuardColors.emerald,
                  size: 24,
                ),
              ),

              const SizedBox(width: 12),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      prescription.treatmentName,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),

                    const SizedBox(height: 4),

                    Text(
                      prescription.type,
                      style: const TextStyle(
                        color: LifeGuardColors.muted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),

              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 15),

          // ==================================================
          // DETAILS
          // ==================================================
          _prescriptionDetail(
            Icons.medication_outlined,
            "Dosage",
            prescription.dosage,
          ),

          _prescriptionDetail(
            Icons.access_time,
            "Scheduled Time",
            prescription.scheduledTime,
          ),

          _prescriptionDetail(
            Icons.repeat,
            "Frequency",
            prescription.frequency,
          ),

          if (prescription.duration.isNotEmpty)
            _prescriptionDetail(
              Icons.calendar_today_outlined,
              "Duration",
              prescription.duration,
            ),

          if (prescription.instructions.isNotEmpty)
            _prescriptionDetail(
              Icons.info_outline,
              "Instructions",
              prescription.instructions,
            ),

          // ==================================================
          // ACTIONS
          // ==================================================
          if (active) ...[
            const SizedBox(height: 8),

            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: updatingPrescription
                        ? null
                        : () => markPrescriptionCompleted(prescription),
                    icon: const Icon(Icons.check_circle_outline, size: 18),
                    label: const Text("MARK COMPLETED"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF146B50),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),

                const SizedBox(width: 8),

                IconButton(
                  tooltip: "Delete prescription",
                  onPressed: updatingPrescription
                      ? null
                      : () => deletePrescription(prescription),
                  icon: const Icon(
                    Icons.delete_outline,
                    color: Color(0xFFFF6575),
                  ),
                ),
              ],
            ),
          ] else ...[
            Align(
              alignment: Alignment.centerRight,
              child: IconButton(
                tooltip: "Delete prescription",
                onPressed: updatingPrescription
                    ? null
                    : () => deletePrescription(prescription),
                icon: const Icon(
                  Icons.delete_outline,
                  color: Color(0xFFFF6575),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ====================================================
  // PRESCRIPTION DETAIL
  // ====================================================

  Widget _prescriptionDetail(IconData icon, String title, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: LifeGuardColors.emerald),

          const SizedBox(width: 9),

          Text(
            "$title: ",
            style: const TextStyle(color: LifeGuardColors.muted, fontSize: 12),
          ),

          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: LifeGuardColors.ink,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ====================================================
  // DETAIL CARD
  // ====================================================

  Widget _roomAverageValue(String label, String value) {
    return SizedBox(
      width: 155,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: LifeGuardColors.muted, fontSize: 11),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _detailCard(String icon, String title, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: LifeGuardColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: LifeGuardColors.border),
      ),
      child: Row(
        children: [
          Text(
            icon,
            style: const TextStyle(
              fontSize: 25,
              color: LifeGuardColors.emerald,
            ),
          ),

          const SizedBox(width: 15),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: LifeGuardColors.muted,
                    fontSize: 12,
                  ),
                ),

                const SizedBox(height: 5),

                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.bold,
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
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: LifeGuardColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: LifeGuardColors.amber),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  reason["factor"] ?? "Risk Factor",
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ),

              Text(
                reason["severity"] ?? "MODERATE",
                style: const TextStyle(
                  color: LifeGuardColors.amber,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          Text(
            "Value: ${reason["value"]}",
            style: const TextStyle(
              color: LifeGuardColors.emerald,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),

          const SizedBox(height: 7),

          Text(
            reason["explanation"] ?? "",
            style: const TextStyle(
              color: LifeGuardColors.muted,
              fontSize: 12,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}
