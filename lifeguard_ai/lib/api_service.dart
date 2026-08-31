import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiService {
  // Android Emulator
  static const String baseUrl = "http://10.0.2.2:5000/api";

  // ======================================================
  // GET ALL PATIENTS
  // ======================================================

  static Future<List<dynamic>> getPatients() async {
    final response = await http.get(
      Uri.parse("$baseUrl/patients"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to load patients");
    }

    return jsonDecode(response.body);
  }

  // ======================================================
  // GET SINGLE PATIENT
  // ======================================================

  static Future<Map<String, dynamic>> getPatient(
    String patientId,
  ) async {
    final response = await http.get(
      Uri.parse("$baseUrl/patients/$patientId"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to load patient");
    }

    return jsonDecode(response.body);
  }

  // ======================================================
  // GET ACTIVE ALERTS
  // ======================================================

  static Future<List<dynamic>> getAlerts() async {
    final response = await http.get(
      Uri.parse("$baseUrl/alerts"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to load alerts");
    }

    return jsonDecode(response.body);
  }

  // ======================================================
  // GET ROOMS
  // ======================================================

  static Future<List<dynamic>> getRooms() async {
    final response = await http.get(
      Uri.parse("$baseUrl/rooms"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to load rooms");
    }

    return jsonDecode(response.body);
  }

  // ======================================================
  // GET PATIENT VITAL HISTORY
  // ======================================================

  static Future<List<dynamic>> getVitalHistory(
    String patientId,
  ) async {
    final response = await http.get(
      Uri.parse("$baseUrl/vitals/$patientId/history"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to load vital history");
    }

    return jsonDecode(response.body);
  }

  // ======================================================
  // CONTROL ROOM ACTUATORS
  // ======================================================

  static Future<Map<String, dynamic>> controlRoom(
    String roomId, {
    required bool fan,
    required bool buzzer,
  }) async {
    final response = await http.post(
      Uri.parse("$baseUrl/rooms/$roomId/control"),
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonEncode({
        "fan": fan,
        "buzzer": buzzer,
      }),
    );

    if (response.statusCode < 200 ||
        response.statusCode >= 300) {
      throw Exception(
        "Failed to control room: ${response.body}",
      );
    }

    return jsonDecode(response.body);
  }
}