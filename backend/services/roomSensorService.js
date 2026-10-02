const Room = require("../models/room");
const {
    getNotificationSocket,
    notifyRoomUpdated,
    notifyRoomSensorStatus
} = require("./notificationService");

const ROOM_SENSOR_STALE_AFTER_MS = Math.max(
    1_000,
    Number(process.env.ROOM_SENSOR_STALE_AFTER_MS) || 30_000
);

function getRoomSensorStatus(room, now = Date.now()) {
    if (room?.sensorStatus === "SENSOR_INVALID") return "SENSOR_INVALID";
    if (room?.sensorStatus === "DATA_STALE") return "DATA_STALE";
    if (room?.source !== "MQTT" || !room?.lastValidReadingAt) {
        if (room?.sensorStatus === "SENSOR_INVALID") return "SENSOR_INVALID";
        return "WAITING";
    }
    if (now - new Date(room.lastValidReadingAt).getTime() > ROOM_SENSOR_STALE_AFTER_MS) {
        return "DATA_STALE";
    }
    return "LIVE";
}

function presentRoom(room, now = Date.now()) {
    const data = typeof room?.toObject === "function" ? room.toObject() : { ...room };
    const sensorStatus = getRoomSensorStatus(data, now);
    const hasValidReading = data.source === "MQTT" && Boolean(data.lastValidReadingAt);
    const hasCurrentPresence = Boolean(
        data.presenceLastUpdatedAt &&
        now - new Date(data.presenceLastUpdatedAt).getTime() <= ROOM_SENSOR_STALE_AFTER_MS
    );

    return {
        ...data,
        temperature: hasValidReading ? data.temperature : null,
        humidity: hasValidReading ? data.humidity : null,
        airQuality: hasValidReading ? data.airQuality : null,
        presenceDetected: hasCurrentPresence ? data.presenceDetected : null,
        sensorStatus,
        connected: sensorStatus === "LIVE",
        lastMessageAt: data.lastMessageAt || null,
        lastValidReadingAt: data.lastValidReadingAt || null,
        lastSensorError: data.lastSensorError || "",
        source: hasValidReading ? data.source : null
    };
}

function parseRoomPayload(roomId, payload) {
    if (!roomId || !payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { valid: false, reason: "Room MQTT payload must be a JSON object" };
    }

    if (payload.roomId != null && String(payload.roomId).trim() !== String(roomId).trim()) {
        return { valid: false, reason: "Room ID in payload does not match the MQTT topic" };
    }

    const fields = ["temperature", "humidity", "airQuality"];
    const values = {};
    for (const field of fields) {
        const raw = payload[field];
        const value = Number(raw);
        if (raw == null || raw === "" || !Number.isFinite(value)) {
            return { valid: false, reason: `Room sensor field '${field}' is missing or invalid` };
        }
        values[field] = value;
    }

    if (values.temperature < -10 || values.temperature > 80) {
        return { valid: false, reason: "Room temperature is outside the accepted sensor range" };
    }
    if (values.humidity < 0 || values.humidity > 100) {
        return { valid: false, reason: "Humidity is outside the accepted sensor range" };
    }
    if (values.airQuality < 0 || values.airQuality > 4095) {
        return { valid: false, reason: "MQ135 reading is outside the ESP32 ADC range" };
    }

    return { valid: true, values };
}

async function updateRoomSensor(roomId, payload, {
    receivedAt = new Date(),
    retained = false,
    error = ""
} = {}) {
    const timestamp = new Date(receivedAt);
    const invalid = retained
        ? { valid: false, reason: "Retained MQTT message is not a new room sensor reading" }
        : error
            ? { valid: false, reason: error }
            : parseRoomPayload(roomId, payload);

    let room;
    if (!invalid.valid) {
        room = await Room.findOneAndUpdate(
            { roomId: String(roomId) },
            {
                $set: {
                    lastMessageAt: timestamp,
                    sensorStatus: retained ? "DATA_STALE" : "SENSOR_INVALID",
                    lastSensorError: invalid.reason
                }
            },
            { new: true, upsert: true, runValidators: true }
        );
    } else {
        const values = {
            ...invalid.values,
            source: "MQTT",
            sensorStatus: "LIVE",
            lastMessageAt: timestamp,
            lastValidReadingAt: timestamp,
            lastUpdated: timestamp,
            lastSensorError: ""
        };
        if (typeof payload.presenceDetected === "boolean") {
            values.presenceDetected = payload.presenceDetected;
            values.presenceLastUpdatedAt = timestamp;
        }

        room = await Room.findOneAndUpdate(
            { roomId: String(roomId) },
            { $set: values },
            { new: true, upsert: true, runValidators: true }
        );
    }

    const presented = presentRoom(room);
    const io = getNotificationSocket();
    if (io) {
        notifyRoomUpdated(io, presented);
        if (presented.sensorStatus !== "LIVE") notifyRoomSensorStatus(io, presented);
    }
    return presented;
}

module.exports = {
    ROOM_SENSOR_STALE_AFTER_MS,
    getRoomSensorStatus,
    presentRoom,
    parseRoomPayload,
    updateRoomSensor
};