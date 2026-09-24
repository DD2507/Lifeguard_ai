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
  // DIGITAL TWIN + SIMULATION
  // ======================================================

  static Future<Map<String, dynamic>> getDigitalTwin(
    String patientId,
  ) async {
    final response = await http.get(
      Uri.parse("$baseUrl/patients/$patientId/digital-twin"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to load patient digital twin");
    }

    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> simulateWhatIf(
    String patientId,
    Map<String, dynamic> payload,
  ) async {
    final response = await http.post(
      Uri.parse("$baseUrl/patients/$patientId/what-if"),
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonEncode(payload),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception("Simulation failed: ${response.body}");
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
  // GET BEDS
  // ======================================================

  static Future<List<dynamic>> getBeds() async {
    final response = await http.get(
      Uri.parse("$baseUrl/beds"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to load beds");
    }

    return jsonDecode(response.body);
  }

  static Future<List<dynamic>> getAvailableBeds() async {
    final response = await http.get(
      Uri.parse("$baseUrl/beds/available"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to load available beds");
    }

    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getPatientBed(String patientId) async {
    final response = await http.get(
      Uri.parse("$baseUrl/beds"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to load beds");
    }

    final List<dynamic> beds = jsonDecode(response.body);
    final bed = beds.firstWhere(
      (item) {
        if (item is! Map<String, dynamic>) {
          return false;
        }
        return item["patientId"]?.toString() == patientId;
      },
      orElse: () => <String, dynamic>{},
    );

    if (bed is! Map<String, dynamic> || bed.isEmpty) {
      throw Exception("No bed assigned");
    }

    return bed;
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

  // ======================================================
  // GET PATIENT PRESCRIPTIONS
  // ======================================================

  static Future<List<dynamic>> getPrescriptions(
    String patientId,
  ) async {
    final response = await http.get(
      Uri.parse("$baseUrl/prescriptions/patient/$patientId"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to load prescriptions: ${response.body}");
    }

    return jsonDecode(response.body);
  }

  // ======================================================
  // CREATE PRESCRIPTION
  // ======================================================

  static Future<Map<String, dynamic>> createPrescription(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse("$baseUrl/prescriptions"),
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonEncode(data),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception("Failed to create prescription: ${response.body}");
    }

    return jsonDecode(response.body);
  }

  // ======================================================
  // UPDATE PRESCRIPTION STATUS
  // ======================================================

  static Future<Map<String, dynamic>> updatePrescriptionStatus(
    String id,
    String status,
  ) async {
    final response = await http.patch(
      Uri.parse("$baseUrl/prescriptions/$id/status"),
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonEncode({"status": status}),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to update status: ${response.body}");
    }

    return jsonDecode(response.body);
  }

  // ======================================================
  // DELETE PRESCRIPTION
  // ======================================================

  static Future<Map<String, dynamic>> deletePrescription(
    String id,
  ) async {
    final response = await http.delete(
      Uri.parse("$baseUrl/prescriptions/$id"),
    );

    if (response.statusCode != 200) {
      throw Exception("Failed to delete prescription: ${response.body}");
    }

    return jsonDecode(response.body);
  }
}