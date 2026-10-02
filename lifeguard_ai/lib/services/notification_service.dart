import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../models/prescription.dart';
import '../screens/medicine_due_alarm_screen.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();
  io.Socket? _socket;

  bool _isInitialized = false;

  static const String channelId = "lifeguard_medication_channel";
  static const String channelName = "Medication & Treatment Reminders";
  static const String channelDescription =
      "Scheduled reminders for patient medications and treatments";

  Future<void> initialize() async {
    if (_isInitialized) return;

    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings iosSettings =
        DarwinInitializationSettings(
          requestAlertPermission: true,
          requestBadgePermission: true,
          requestSoundPermission: true,
        );

    const InitializationSettings initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notificationsPlugin.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        debugPrint("Notification tapped: ${response.payload}");
      },
    );

    final AndroidFlutterLocalNotificationsPlugin? androidImplementation =
        _notificationsPlugin
            .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin
            >();

    if (androidImplementation != null) {
      await androidImplementation.createNotificationChannel(
        AndroidNotificationChannel(
          channelId,
          channelName,
          description: channelDescription,
          importance: Importance.max,
          enableVibration: true,
          vibrationPattern: Int64List.fromList([0, 1000, 500, 1000]),
        ),
      );

      await androidImplementation.requestNotificationsPermission();
      await androidImplementation.requestExactAlarmsPermission();
    }

    _isInitialized = true;
    await _connectRealtimeNotifications();
    debugPrint("NotificationService initialized successfully");
  }

  final Map<String, Map<String, dynamic>> _pendingMedicineAlarms = {};
  final Set<String> _dismissedMedicineAlarms = <String>{};
  String? _activeMedicineAlarm;

  Future<void> _connectRealtimeNotifications() async {
    if (_socket != null) {
      return;
    }

    try {
      final String host =
          (kIsWeb ||
              defaultTargetPlatform == TargetPlatform.windows ||
              defaultTargetPlatform == TargetPlatform.macOS ||
              defaultTargetPlatform == TargetPlatform.linux)
          ? 'http://localhost:5000'
          : 'http://10.222.14.64:5000';

      _socket = io.io(
        host,
        io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .enableAutoConnect()
            .build(),
      );

      _socket!.onConnect((_) {
        debugPrint('Flutter realtime connected to LifeGuard backend');
        _socket!.emit('subscribe-dashboard');
      });

      _socket!.onConnectError((data) {
        debugPrint('Flutter realtime connect error: $data');
      });

      _socket!.onDisconnect((_) {
        debugPrint('Flutter realtime disconnected');
      });

      _socket!.on('alert-created', (data) {
        final payload = data is Map
            ? Map<String, dynamic>.from(data)
            : <String, dynamic>{};
        if (payload['alertType'] == 'MEDICINE_DUE') {
          _queueMedicineAlarm(payload, showNotification: true);
          return;
        }
        final patientId = payload['patientId'] ?? 'unknown';
        final risk = payload['risk'] ?? 'UNKNOWN';
        final title = 'Patient Risk Alert';
        final message = 'Patient $patientId reported $risk risk';
        _showRealtimeNotification(title, message, payload);
      });

      _socket!.on('prescription-created', (data) {
        final payload = data is Map
            ? Map<String, dynamic>.from(data)
            : <String, dynamic>{};
        final patientId = payload['patientId'] ?? 'unknown';
        final name = payload['treatmentName'] ?? 'Treatment';
        final title = 'Prescription Added';
        final message = 'Prescription for patient $patientId: $name';
        _showRealtimeNotification(title, message, payload);
      });

      _socket!.on('medicine-due', (data) {
        final payload = data is Map
            ? Map<String, dynamic>.from(data)
            : <String, dynamic>{};
        _queueMedicineAlarm(payload, showNotification: true);
      });

      _socket!.on('alert-completed', (data) {
        final payload = data is Map
            ? Map<String, dynamic>.from(data)
            : <String, dynamic>{};
        _removeMedicineAlarm(payload);
      });

      _socket!.connect();
    } catch (error) {
      debugPrint('Realtime notification setup failed: $error');
    }
  }

  void recoverMedicineAlerts(List<dynamic> alerts) {
    for (final item in alerts) {
      if (item is! Map) continue;
      final alert = Map<String, dynamic>.from(item);
      if (alert['alertType'] == 'MEDICINE_DUE' &&
          alert['status'] != 'COMPLETED' &&
          alert['status'] != 'RESOLVED') {
        _queueMedicineAlarm(alert, showNotification: false);
      }
    }
    _showNextMedicineAlarm();
  }

  void _queueMedicineAlarm(
    Map<String, dynamic> alert, {
    required bool showNotification,
  }) {
    final occurrenceId =
        alert['occurrenceId']?.toString() ??
        alert['alertId']?.toString() ??
        alert['_id']?.toString() ??
        '';
    if (occurrenceId.isEmpty ||
        _dismissedMedicineAlarms.contains(occurrenceId) ||
        _pendingMedicineAlarms.containsKey(occurrenceId) ||
        _activeMedicineAlarm == occurrenceId) {
      return;
    }

    _pendingMedicineAlarms[occurrenceId] = alert;
    if (showNotification) {
      final patientId = alert['patientId'] ?? 'unknown';
      final medicine = alert['treatmentName'] ?? 'Medicine';
      final dosage = alert['dosage'] ?? 'Dosage unavailable';
      final dueTime = alert['dueTime'] ?? alert['scheduledAt'] ?? '';
      _showRealtimeNotification(
        'MEDICINE DUE',
        'Patient: $patientId\nMedicine: $medicine\nDosage: $dosage\nDue: $dueTime',
        alert,
      );
    }
    _showNextMedicineAlarm();
  }

  void _showNextMedicineAlarm() {
    if (_activeMedicineAlarm != null || _pendingMedicineAlarms.isEmpty) return;
    final navigator = navigatorKey.currentState;
    if (navigator == null) return;

    final entry = _pendingMedicineAlarms.entries.first;
    _activeMedicineAlarm = entry.key;
    navigator
        .push<void>(
          MaterialPageRoute<void>(
            builder: (_) => MedicineDueAlarmScreen(alert: entry.value),
            fullscreenDialog: true,
          ),
        )
        .whenComplete(() {
          _pendingMedicineAlarms.remove(entry.key);
          _dismissedMedicineAlarms.add(entry.key);
          _activeMedicineAlarm = null;
          _showNextMedicineAlarm();
        });
  }

  void _removeMedicineAlarm(Map<String, dynamic> alert) {
    final occurrenceId =
        alert['occurrenceId']?.toString() ??
        alert['alertId']?.toString() ??
        alert['_id']?.toString() ??
        '';
    if (occurrenceId.isEmpty) return;
    _pendingMedicineAlarms.remove(occurrenceId);
    _dismissedMedicineAlarms.add(occurrenceId);
    if (_activeMedicineAlarm == occurrenceId)
      navigatorKey.currentState?.maybePop();
  }

  Future<void> _showRealtimeNotification(
    String title,
    String body,
    Map<String, dynamic> payload,
  ) async {
    final context = navigatorKey.currentContext;
    if (context != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$title\n$body'),
          duration: const Duration(seconds: 5),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }

    try {
      await _notificationsPlugin.show(
        id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        title: title,
        body: body,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            channelId,
            channelName,
            channelDescription: channelDescription,
            importance: Importance.max,
            priority: Priority.high,
          ),
        ),
        payload: jsonEncode(payload),
      );
    } catch (error) {
      debugPrint('Local in-app notification failed: $error');
    }
  }

  // ======================================================
  // CANCEL LOCAL SCHEDULED REMINDER
  // ======================================================

  Future<void> cancelReminder(String prescriptionId) async {
    final int notificationId = prescriptionId.hashCode & 0x7FFFFFFF;
    await _notificationsPlugin.cancel(id: notificationId);
    debugPrint("Cancelled reminder ID: $notificationId");
  }

  // ======================================================
  // SYNC MULTIPLE PRESCRIPTIONS
  // ======================================================

  Future<void> syncPrescriptions(List<Prescription> prescriptions) async {
    for (final prescription in prescriptions) {
      await cancelReminder(prescription.id);
    }
  }
}
