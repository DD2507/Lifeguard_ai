const assert = require("node:assert/strict");
const ioClient = require("../lifeguard_web/node_modules/socket.io-client");
const mongoose = require("mongoose");
require("dotenv").config({ path: __dirname + "/.env" });
const Prescription = require("./models/Prescription");

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testLiveServer() {
    console.log("=== VERIFYING LIVE SERVER SCHEDULER (PORT 5000) ===");

    // 1. Connect Socket.IO to live server
    const client = ioClient("http://localhost:5000", {
        transports: ["websocket", "polling"]
    });

    const received = [];

    await new Promise((resolve, reject) => {
        client.on("connect", () => {
            console.log("✓ Connected to live server Socket.IO on http://localhost:5000");
            client.emit("subscribe-dashboard");
            resolve();
        });
        client.on("connect_error", reject);
    });

    client.on("medicine-due", (payload) => {
        console.log(">>> [LIVE SERVER] medicine-due event received:", payload);
        received.push(payload);
    });

    await sleep(500);

    // 2. Connect to MongoDB Atlas to check and cleanup records
    await mongoose.connect(process.env.MONGODB_URI);

    let createdId = null;
    try {
        const scheduledDate = new Date(Date.now() + 15_000);
        console.log(`Creating prescription via HTTP API due in 15 seconds at ${scheduledDate.toISOString()}...`);

        const response = await fetch("http://localhost:5000/api/prescriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patientId: "P003",
                treatmentName: "TEST_LIVE_SERVER_REMINDER",
                type: "Medication",
                dosage: "100mg IV",
                scheduledAt: scheduledDate.toISOString(),
                scheduledTime: scheduledDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
                frequency: "Once only"
            })
        });

        assert.equal(response.status, 201, "API should return 201 Created");
        const body = await response.json();
        createdId = body._id;
        console.log(`✓ Prescription created via HTTP API with ID: ${createdId}`);

        // Verify no reminder before 15 seconds
        await sleep(5_000);
        assert.equal(received.filter((r) => r._id === createdId).length, 0, "Should not emit before scheduled time");
        console.log("✓ Verified: No reminder received 5s after creation (time not yet due).");

        // Wait until past scheduled time
        console.log("Waiting for scheduler to identify due time and emit real-time event...");
        const deadline = Date.now() + 25_000;
        while (Date.now() < deadline && received.filter((r) => r._id === createdId).length === 0) {
            await sleep(500);
        }

        const dueEvents = received.filter((r) => r._id === createdId);
        assert.equal(dueEvents.length, 1, `Expected exactly 1 reminder event, received ${dueEvents.length}`);
        const event = dueEvents[0];
        assert.equal(event.patientId, "P003");
        assert.equal(event.treatmentName, "TEST_LIVE_SERVER_REMINDER");
        assert.equal(event.dosage, "100mg IV");
        assert.ok(event.dueTime, "Due time should be present");
        console.log("✓ Verified: Live server emitted medicine-due event on time with exact payload!");

        // Verify persistent reminderDeliveredAt in DB
        const saved = await Prescription.findById(createdId);
        assert.ok(saved.reminderDeliveredAt instanceof Date, "DB record must have reminderDeliveredAt");
        console.log(`✓ Verified: MongoDB record updated with reminderDeliveredAt: ${saved.reminderDeliveredAt.toISOString()}`);

        // Wait another 7 seconds to ensure no duplicate event is emitted
        await sleep(7_000);
        const duplicateEvents = received.filter((r) => r._id === createdId);
        assert.equal(duplicateEvents.length, 1, "Scheduler must not emit duplicates on subsequent ticks");
        console.log("✓ Verified: No duplicate events emitted on subsequent scheduler checks.");

    } finally {
        if (createdId) {
            await Prescription.findByIdAndDelete(createdId);
            console.log(`✓ Cleaned up test prescription ${createdId} from MongoDB.`);
        }
        client.disconnect();
        await mongoose.disconnect();
    }

    console.log("\n=======================================================");
    console.log("LIVE SERVER SCHEDULER VERIFICATION PASSED COMPLETELY!");
    console.log("=======================================================");
}

testLiveServer().catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
});
