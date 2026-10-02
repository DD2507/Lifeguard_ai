const test = require("node:test");
const assert = require("node:assert/strict");

const roomModelPath = require.resolve("../models/room");
const notifierPath = require.resolve("./notificationService");
const originals = new Map([
    [roomModelPath, require.cache[roomModelPath]],
    [notifierPath, require.cache[notifierPath]]
]);

let savedRoom;
const roomEvents = [];
require.cache[roomModelPath] = {
    id: roomModelPath,
    filename: roomModelPath,
    loaded: true,
    exports: {
        findOneAndUpdate: async (filter, update) => {
            savedRoom = {
                roomId: filter.roomId,
                ...(savedRoom || {}),
                ...update.$set
            };
            return savedRoom;
        }
    }
};
require.cache[notifierPath] = {
    id: notifierPath,
    filename: notifierPath,
    loaded: true,
    exports: {
        getNotificationSocket: () => ({ connected: true }),
        notifyRoomUpdated: (_io, payload) => roomEvents.push({ event: "room-updated", payload }),
        notifyRoomSensorStatus: (_io, payload) => roomEvents.push({ event: "room-sensor-status", payload })
    }
};

const {
    parseRoomPayload,
    presentRoom,
    getRoomSensorStatus,
    updateRoomSensor
} = require("./roomSensorService");

test.beforeEach(() => {
    savedRoom = null;
    roomEvents.length = 0;
});

test.after(() => {
    for (const [filePath, cacheEntry] of originals) {
        if (cacheEntry) require.cache[filePath] = cacheEntry;
        else delete require.cache[filePath];
    }
});

test("parses observed room 102 DHT11 and MQ135 field names", () => {
    assert.deepEqual(parseRoomPayload("102", {
        roomId: "102",
        temperature: 31.3,
        humidity: 54.2,
        airQuality: 431
    }), {
        valid: true,
        values: { temperature: 31.3, humidity: 54.2, airQuality: 431 }
    });
});

test("rejects conflicting room IDs, absent fields, and out-of-range values", () => {
    assert.equal(parseRoomPayload("102", {
        roomId: "101", temperature: 30, humidity: 50, airQuality: 100
    }).valid, false);
    assert.equal(parseRoomPayload("102", {
        temperature: 30, humidity: 50
    }).valid, false);
    assert.equal(parseRoomPayload("102", {
        temperature: 30, humidity: 101, airQuality: 100
    }).valid, false);
    assert.equal(parseRoomPayload("102", {
        temperature: 30, humidity: 50, airQuality: 4096
    }).valid, false);
});

test("returns waiting or stale without fabricating room measurements", () => {
    const waiting = presentRoom({ roomId: "102", source: null, temperature: 0, humidity: 0, airQuality: 0 });
    assert.equal(waiting.sensorStatus, "WAITING");
    assert.equal(waiting.temperature, null);
    assert.equal(waiting.humidity, null);
    assert.equal(waiting.airQuality, null);

    assert.equal(getRoomSensorStatus({
        source: "MQTT",
        sensorStatus: "LIVE",
        lastValidReadingAt: new Date(0)
    }, 60_000), "DATA_STALE");
});

test("persists valid MQTT data and emits a room update", async () => {
    const now = new Date();
    const room = await updateRoomSensor("102", {
        roomId: "102", temperature: 31.3, humidity: 54.2, airQuality: 431
    }, { receivedAt: now });

    assert.equal(room.roomId, "102");
    assert.equal(room.temperature, 31.3);
    assert.equal(room.humidity, 54.2);
    assert.equal(room.airQuality, 431);
    assert.equal(room.source, "MQTT");
    assert.equal(room.sensorStatus, "LIVE");
    assert.equal(room.lastValidReadingAt.toISOString(), now.toISOString());
    assert.equal(roomEvents.filter((item) => item.event === "room-updated").length, 1);
});

test("invalid payload changes sensor status but preserves last valid values", async () => {
    const now = new Date();
    await updateRoomSensor("102", {
        temperature: 31.3, humidity: 54.2, airQuality: 431
    }, { receivedAt: now });

    const invalid = await updateRoomSensor("102", {
        temperature: 31.3, humidity: 140, airQuality: 431
    }, { receivedAt: new Date(now.getTime() + 5_000) });

    assert.equal(invalid.sensorStatus, "SENSOR_INVALID");
    assert.equal(invalid.temperature, 31.3);
    assert.equal(invalid.humidity, 54.2);
    assert.equal(invalid.airQuality, 431);
    assert.ok(invalid.lastSensorError);
    assert.equal(roomEvents.filter((item) => item.event === "room-updated").length, 2);
    assert.equal(roomEvents.filter((item) => item.event === "room-sensor-status").length, 1);
});
