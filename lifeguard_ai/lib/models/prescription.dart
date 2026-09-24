class Prescription {
  final String id;
  final String patientId;
  final String doctorId;
  final String treatmentName;
  final String type;
  final String dosage;
  final String scheduledTime;
  final String frequency;
  final DateTime? startDate;
  final DateTime? endDate;
  final String duration;
  final String instructions;
  final String status;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Prescription({
    required this.id,
    required this.patientId,
    required this.doctorId,
    required this.treatmentName,
    required this.type,
    required this.dosage,
    required this.scheduledTime,
    required this.frequency,
    this.startDate,
    this.endDate,
    required this.duration,
    required this.instructions,
    required this.status,
    this.createdAt,
    this.updatedAt,
  });

  bool get isActive => status.toUpperCase() == "ACTIVE";
  bool get isCompleted => status.toUpperCase() == "COMPLETED";
  bool get isCancelled => status.toUpperCase() == "CANCELLED";

  factory Prescription.fromJson(Map<String, dynamic> json) {
    return Prescription(
      id: json["_id"]?.toString() ?? json["id"]?.toString() ?? "",
      patientId: json["patientId"]?.toString() ?? "",
      doctorId: json["doctorId"]?.toString() ?? "DOC-001",
      treatmentName: json["treatmentName"]?.toString() ?? "",
      type: json["type"]?.toString() ?? "Medication",
      dosage: json["dosage"]?.toString() ?? "",
      scheduledTime: json["scheduledTime"]?.toString() ?? "",
      frequency: json["frequency"]?.toString() ?? "Once daily",
      startDate: json["startDate"] != null
          ? DateTime.tryParse(json["startDate"].toString())
          : null,
      endDate: json["endDate"] != null
          ? DateTime.tryParse(json["endDate"].toString())
          : null,
      duration: json["duration"]?.toString() ?? "",
      instructions: json["instructions"]?.toString() ?? "",
      status: json["status"]?.toString() ?? "ACTIVE",
      createdAt: json["createdAt"] != null
          ? DateTime.tryParse(json["createdAt"].toString())
          : null,
      updatedAt: json["updatedAt"] != null
          ? DateTime.tryParse(json["updatedAt"].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      "patientId": patientId,
      "doctorId": doctorId,
      "treatmentName": treatmentName,
      "type": type,
      "dosage": dosage,
      "scheduledTime": scheduledTime,
      "frequency": frequency,
      if (startDate != null) "startDate": startDate!.toIso8601String(),
      if (endDate != null) "endDate": endDate!.toIso8601String(),
      "duration": duration,
      "instructions": instructions,
      "status": status,
    };
  }
}
