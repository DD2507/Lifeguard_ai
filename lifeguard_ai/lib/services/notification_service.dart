import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

import '../models/prescription.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  bool _isInitialized = false;

  static const String channelId = "lifeguard_medication_channel";
  static const String channelName = "Medication & Treatment Reminders";
  static const String channelDescription =
      "Scheduled reminders for patient medications and treatments";

  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      tz.initializeTimeZones();
    } catch (e) {
      debugPrint("Error initializing timezones: $e");
    }

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
        _notificationsPlugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

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
    debugPrint("NotificationService initialized successfully");
  }

  // ======================================================
  // TIME PARSER (Handles "10:00 PM", "22:00", etc.)
  // ======================================================

  Map<String, int>? _parseTime(String timeString) {
    try {
      final clean = timeString.trim().toUpperCase();
      final isPM = clean.contains("PM");
      final isAM = clean.contains("AM");

      final digitsOnly = clean.replaceAll(RegExp(r"[^0-9:]"), "").trim();
      final parts = digitsOnly.split(":");
      if (parts.isEmpty) return null;

      int hour = int.parse(parts[0]);
      int minute = parts.length > 1 ? int.parse(parts[1]) : 0;

      if (isPM && hour < 12) {
        hour += 12;
      } else if (isAM && hour == 12) {
        hour = 0;
      }

      return {"hour": hour, "minute": minute};
    } catch (e) {
      debugPrint("Error parsing scheduled time '$timeString': $e");
      return null;
    }
  }

  // ======================================================
  // SCHEDULE REMINDER
  // ======================================================

  DateTimeComponents? _matchDateTimeComponentsForFrequency(String frequency) {
    final normalized = frequency.trim().toLowerCase();

    switch (normalized) {
      case "once daily":
        return DateTimeComponents.time;
      case "once only":
      case "twice daily":
      case "three times daily":
      case "every 8 hours":
      case "every 12 hours":
      case "as needed":
        return null;
      default:
        return null;
    }
  }

  bool _isAutoScheduleSupported(String frequency) {
    final normalized = frequency.trim().toLowerCase();
    if (normalized == "once daily") return true;
    return false;
  }

  Future<void> scheduleMedicationReminder(Prescription prescription) async {
    final normalizedStatus = prescription.status.trim().toUpperCase();
    if (normalizedStatus != "ACTIVE") {
      await cancelReminder(prescription.id);
      return;
    }

    if (prescription.startDate != null &&
        tz.TZDateTime.now(tz.local).isBefore(
          tz.TZDateTime.from(prescription.startDate!, tz.local),
        )) {
      await cancelReminder(prescription.id);
      debugPrint(
        "Prescription ${prescription.id} is scheduled after startDate; no reminder created yet.",
      );
      return;
    }

    final now = tz.TZDateTime.now(tz.local);
    if (prescription.endDate != null &&
        now.isAfter(tz.TZDateTime.from(prescription.endDate!, tz.local))) {
      await cancelReminder(prescription.id);
      debugPrint(
        "Prescription ${prescription.id} has expired; reminder cancelled.",
      );
      return;
    }

    final frequency = prescription.frequency.trim();
    if (!_isAutoScheduleSupported(frequency)) {
      if (frequency.toLowerCase() == "as needed") {
        debugPrint(
          "Skipping automatic scheduling for AS NEEDED prescription ${prescription.id}.",
        );
      } else {
        debugPrint(
          "Frequency '$frequency' is not auto-scheduled with the current single-time prescription model; using a single reminder at the stored time only.",
        );
      }
      await cancelReminder(prescription.id);
      return;
    }

    final parsedTime = _parseTime(prescription.scheduledTime);
    if (parsedTime == null) {
      debugPrint("Cannot schedule: Invalid time '${prescription.scheduledTime}'");
      await cancelReminder(prescription.id);
      return;
    }

    final int hour = parsedTime["hour"]!;
    final int minute = parsedTime["minute"]!;

    tz.TZDateTime scheduledDate = tz.TZDateTime(
      tz.local,
      now.year,
      now.month,
      now.day,
      hour,
      minute,
    );

    if (scheduledDate.isBefore(now)) {
      scheduledDate = scheduledDate.add(const Duration(days: 1));
    }

    final int notificationId = prescription.id.hashCode & 0x7FFFFFFF;
    await cancelReminder(prescription.id);

    final AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      channelId,
      channelName,
      channelDescription: channelDescription,
      importance: Importance.max,
      priority: Priority.high,
      enableVibration: true,
      vibrationPattern: Int64List.fromList([0, 1000, 500, 1000]),
      styleInformation: BigTextStyleInformation(
        prescription.instructions.isNotEmpty
            ? "${prescription.treatmentName} - ${prescription.dosage}\nInstructions: ${prescription.instructions}"
            : "${prescription.treatmentName} - ${prescription.dosage} is scheduled now.",
      ),
    );

    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final NotificationDetails notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    try {
      await _notificationsPlugin.zonedSchedule(
        id: notificationId,
        title: "Medication Reminder",
        body: "${prescription.treatmentName} - ${prescription.dosage} is scheduled now.",
        scheduledDate: scheduledDate,
        notificationDetails: notificationDetails,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        matchDateTimeComponents: _matchDateTimeComponentsForFrequency(frequency),
      );

      debugPrint(
        "Scheduled reminder for ${prescription.treatmentName} (ID: $notificationId) at $scheduledDate",
      );
    } catch (e) {
      debugPrint("Failed to zone-schedule notification: $e");
    }
  }

  // ======================================================
  // CANCEL REMINDER
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
      if (prescription.isActive) {
        await scheduleMedicationReminder(prescription);
      } else {
        await cancelReminder(prescription.id);
      }
    }
  }
}
