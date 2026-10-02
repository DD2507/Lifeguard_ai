function getNotificationSocket() {
    return global.__lifeguardSocketServer || null;
}

function emitRoomEvent(io, roomName, eventName, payload) {
    if (!io || !roomName || !eventName) {
        return;
    }

    io.to(roomName).emit(eventName, payload);
}

function notifyPrescriptionCreated(io, prescription) {
    if (!io || !prescription) {
        return;
    }

    const payload = {
        _id: prescription._id,
        patientId: prescription.patientId,
        doctorId: prescription.doctorId,
        treatmentName: prescription.treatmentName,
        dosage: prescription.dosage,
        scheduledTime: prescription.scheduledTime,
        frequency: prescription.frequency,
        status: prescription.status,
        createdAt: prescription.createdAt || new Date().toISOString()
    };

    const rooms = ["doctor-dashboard", "nurse-dashboard"];
    if (prescription.patientId) rooms.push(`patient-${prescription.patientId}`);
    io.to(rooms).emit("prescription-created", payload);
}

function notifyMedicineDue(io, payload) {
    if (!io || !payload || typeof io.to !== "function") {
        throw new Error("Socket.IO server is unavailable for medicine-due emission");
    }

    const rooms = ["doctor-dashboard", "nurse-dashboard"];
    if (payload.patientId) rooms.push(`patient-${payload.patientId}`);
    const roomEmitter = io.to(rooms);
    if (!roomEmitter || typeof roomEmitter.emit !== "function") {
        throw new Error("Socket.IO room emitter is unavailable for medicine-due emission");
    }
    roomEmitter.emit("medicine-due", payload);
}

function notifyPatientVitalsUpdated(io, payload) {
    if (!io || !payload) return;
    io.to(["doctor-dashboard", "nurse-dashboard"]).emit("patient-vitals-updated", payload);
}

function notifyRoomUpdated(io, payload) {
    if (!io || !payload) return;
    io.to(["doctor-dashboard", "nurse-dashboard", "room-dashboard"]).emit("room-updated", payload);
}

function notifyRoomSensorStatus(io, payload) {
    if (!io || !payload) return;
    io.to(["doctor-dashboard", "nurse-dashboard", "room-dashboard"]).emit("room-sensor-status", payload);
}

function notifyAlertCreated(io, alert) {
    if (!io || !alert) {
        return;
    }

    const alertData = alert.toObject ? alert.toObject() : alert;
    if (alertData.alertType === "MEDICINE_DUE") {
        const payload = {
            ...alertData,
            _id: String(alertData._id),
            alertType: "MEDICINE_DUE",
            status: alertData.status || "ACTIVE",
            medicineStatus: alertData.medicineStatus || "MEDICINE_DUE"
        };
        io.to(["doctor-dashboard", "nurse-dashboard", "alert-dashboard"]).emit("alert-created", payload);
        return;
    }

    const payload = {
        _id: alert._id,
        patientId: alert.patientId,
        patientName: alert.patientName,
        room: alert.room,
        risk: alert.risk,
        riskScore: alert.riskScore,
        summary: alert.summary,
        timestamp: alert.createdAt || new Date().toISOString(),
        recommendedAction: alert.recommendedAction || null
    };

    const rooms = ["doctor-dashboard", "nurse-dashboard", "alert-dashboard"];
    if (alert.patientId) rooms.push(`patient-${alert.patientId}`);
    io.to(rooms).emit("alert-created", payload);
}

function notifyAlertUpdated(io, alert) {
    if (!io || !alert) return;
    const data = alert.toObject ? alert.toObject() : alert;
    const payload = { ...data, _id: String(data._id) };
    io.to(["doctor-dashboard", "nurse-dashboard", "alert-dashboard"]).emit("alert-updated", payload);
}

function notifyAlertCompleted(io, alert) {
    if (!io || !alert) return;
    const data = alert.toObject ? alert.toObject() : alert;
    const payload = { ...data, _id: String(data._id) };
    io.to(["doctor-dashboard", "nurse-dashboard", "alert-dashboard"]).emit("alert-completed", payload);
}

function notifyAlertResolved(io, patientId, alertId) {
    if (!io) {
        return;
    }

    const payload = {
        _id: alertId,
        patientId,
        timestamp: new Date().toISOString()
    };

    emitRoomEvent(io, "doctor-dashboard", "alert-resolved", payload);
    emitRoomEvent(io, "nurse-dashboard", "alert-resolved", payload);
    emitRoomEvent(io, "alert-dashboard", "alert-resolved", payload);

    if (patientId) {
        emitRoomEvent(io, `patient-${patientId}`, "alert-resolved", payload);
    }
}

function registerSocketServer(httpServer) {
    const { Server } = require("socket.io");

    const io = new Server(httpServer, {
        cors: {
            origin: true,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Keep route and scheduler access bound to the active backend server.
    global.__lifeguardSocketServer = io;

    io.on("connection", (socket) => {
        socket.on("join-room", (roomName) => {
            if (typeof roomName === "string" && roomName.trim()) {
                socket.join(roomName.trim());
            }
        });

        socket.on("subscribe-dashboard", () => {
            socket.join("doctor-dashboard");
            socket.join("nurse-dashboard");
            socket.join("alert-dashboard");
            socket.join("room-dashboard");
        });
    });

    return io;
}

module.exports = {
    getNotificationSocket,
    registerSocketServer,
    notifyPrescriptionCreated,
    notifyMedicineDue,
    notifyPatientVitalsUpdated,
    notifyRoomUpdated,
    notifyRoomSensorStatus,
    notifyAlertCreated,
    notifyAlertResolved,
    notifyAlertUpdated,
    notifyAlertCompleted
};
