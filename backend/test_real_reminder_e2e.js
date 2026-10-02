const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config({ path: __dirname + "/.env" });

const Prescription = require("./models/Prescription");
const { registerSocketServer } = require("./services/notificationService");
const {
    processDueReminders,
    startPrescriptionReminderScheduler,
    resolveScheduledAt
} = require("./services/prescriptionReminderScheduler");

const ioClient = require("../lifeguard_web/node_modules/socket.io-client");

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runE2ETest() {
    console.log("=== STARTING AUTONOMOUS E2E REMINDER TEST ===");
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Atlas connected successfully.");

    // Create an isolated HTTP server and Socket.IO server on a dedicated port
    const app = express();
    const server = http.createServer(app);
    const TEST_PORT = 5088;

    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
    console.log(`Test Socket.IO server listening on port ${TEST_PORT}`);

    const io = registerSocketServer(server);
    global.__lifeguardSocketServer = io;

    // Connect a real Socket.IO client (mimicking React web and Flutter clients)
    console.log("Connecting client socket...");
    const clientSocket = ioClient(`http://localhost:${TEST_PORT}`, {
        transports: ["websocket", "polling"]
    });

    const receivedReminders = [];

    await new Promise((resolve, reject) => {
        clientSocket.on("connect", () => {
            console.log("Client connected. Subscribing to dashboard rooms...");
            clientSocket.emit("subscribe-dashboard");
            resolve();
        });
        clientSocket.on("connect_error", reject);
    });

    clientSocket.on("medicine-due", (payload) => {
        console.log(">>> RECEIVED medicine-due event:", payload);
        receivedReminders.push(payload);
    });

    // Give socket 500ms to join rooms
    await sleep(500);

    const testPatientId = "P003";
    const testTreatmentName = "TEST_MEDICINE_DUE_AUTONOMOUS_VERIFY";
    const testDosage = "250mg oral";

    let testPrescription = null;

    try {
        // Step 1: Create a test prescription due 90 seconds in the future.
        const scheduledAt = new Date(Date.now() + 90_000);
        console.log(`\nStep 1: Creating test prescription with due time ${scheduledAt.toISOString()} (90s in future)...`);

        testPrescription = await Prescription.create({
            patientId: testPatientId,
            doctorId: "DOC-001",
            treatmentName: testTreatmentName,
            type: "Medication",
            dosage: testDosage,
            scheduledTime: scheduledAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }),
            scheduledAt,
            frequency: "Once only",
            startDate: scheduledAt,
            status: "ACTIVE"
        });

        assert.ok(testPrescription._id, "Test prescription must have an _id");
        console.log(`✓ Test prescription saved in MongoDB with ID: ${testPrescription._id}`);

        // Step 2: Verify NO reminder is emitted before scheduled time
        console.log("\nStep 2: Checking reminder status before scheduled time...");
        const deliveredBefore = await processDueReminders({
            now: new Date(),
            PrescriptionModel: Prescription,
            io
        });
        assert.equal(deliveredBefore, 0, "No reminders should be delivered before scheduled time");
        assert.equal(receivedReminders.length, 0, "Client must NOT receive event before scheduled time");
        console.log("✓ Correct: No reminder emitted before scheduled time.");

        // Step 3: Start the scheduler and wait for due time
        console.log("\nStep 3: Starting scheduler (checks every 2s) and waiting 92 seconds for due time...");
        const stopScheduler = startPrescriptionReminderScheduler({ intervalMs: 2_000 });

        // Wait until after due time so the next scheduler interval can fire.
        await sleep(92_000);

        // Step 4: Verify Socket.IO event received
        console.log("\nStep 4: Verifying received real-time reminder event...");
        assert.equal(receivedReminders.length, 1, `Expected exactly 1 reminder event, received ${receivedReminders.length}`);
        const event = receivedReminders[0];

        assert.equal(event.patientId, testPatientId);
        assert.equal(event.treatmentName, testTreatmentName);
        assert.equal(event.dosage, testDosage);
        assert.ok(event.dueTime, "Event must include formatted dueTime");
        assert.equal(event.timeZone, "Asia/Kolkata");
        console.log("✓ Correct: Real reminder emitted at scheduled time with accurate patient ID, medicine, dosage, and due time!");

        // Step 5: Verify MongoDB persistence of delivery timestamp
        console.log("\nStep 5: Verifying persistent delivery tracking in MongoDB...");
        const dbRecord = await Prescription.findById(testPrescription._id);
        assert.ok(dbRecord.reminderDeliveredAt instanceof Date, "reminderDeliveredAt must be set in MongoDB");
        console.log(`✓ Correct: reminderDeliveredAt recorded in MongoDB at ${dbRecord.reminderDeliveredAt.toISOString()}`);

        // Step 6: Verify duplicate prevention across subsequent scheduler ticks
        console.log("\nStep 6: Verifying duplicate prevention over additional scheduler ticks...");
        await sleep(4_000); // 2 more scheduler intervals
        assert.equal(receivedReminders.length, 1, "Duplicate ticks must NOT resend reminder");
        console.log("✓ Correct: Duplicate scheduler checks do not send duplicate reminders.");

        // Step 7: Verify restart recovery
        console.log("\nStep 7: Testing backend/scheduler restart recovery...");
        stopScheduler(); // stop current scheduler
        console.log("Stopped scheduler. Starting new scheduler instance to simulate backend restart...");
        const restartDelivered = await processDueReminders({
            now: new Date(),
            PrescriptionModel: Prescription,
            io
        });
        assert.equal(restartDelivered, 0, "Restarting scheduler must NOT redeliver already delivered reminder");
        assert.equal(receivedReminders.length, 1, "No duplicate event received after restart");
        console.log("✓ Correct: Restarting scheduler does not resend an already delivered reminder.");

        // Step 8: Verify cancelled and completed prescriptions are NOT reminded
        console.log("\nStep 8: Verifying cancelled and completed prescriptions are ignored...");
        const pastDue = new Date(Date.now() - 30_000);
        const cancelled = await Prescription.create({
            patientId: testPatientId,
            doctorId: "DOC-001",
            treatmentName: "TEST_CANCELLED_PRESCRIPTION",
            dosage: "10mg",
            scheduledTime: "10:00 PM",
            scheduledAt: pastDue,
            status: "CANCELLED"
        });
        const completed = await Prescription.create({
            patientId: testPatientId,
            doctorId: "DOC-001",
            treatmentName: "TEST_COMPLETED_PRESCRIPTION",
            dosage: "20mg",
            scheduledTime: "10:00 PM",
            scheduledAt: pastDue,
            status: "COMPLETED"
        });

        const deliveredStatusCheck = await processDueReminders({
            now: new Date(),
            PrescriptionModel: Prescription,
            io
        });
        assert.equal(deliveredStatusCheck, 0, "Cancelled/completed prescriptions must NOT be delivered");
        assert.equal(receivedReminders.length, 1, "Client must NOT receive events for cancelled/completed prescriptions");
        console.log("✓ Correct: Cancelled and completed prescriptions are not reminded.");

        // Clean up cancelled and completed test prescriptions
        await Prescription.findByIdAndDelete(cancelled._id);
        await Prescription.findByIdAndDelete(completed._id);

    } finally {
        // Step 9: Clean up test prescription
        console.log("\nStep 9: Cleaning up temporary test prescription...");
        if (testPrescription && testPrescription._id) {
            await Prescription.findByIdAndDelete(testPrescription._id);
            console.log(`✓ Safely removed test prescription ${testPrescription._id} from MongoDB.`);
        }

        // Close socket client, HTTP server, and Mongoose connection
        clientSocket.disconnect();
        await new Promise((resolve) => server.close(resolve));
        await mongoose.disconnect();
        console.log("✓ Disconnected all test clients, servers, and MongoDB connection.");
    }

    console.log("\n==========================================");
    console.log("ALL REAL REMINDER E2E TESTS PASSED 100%!");
    console.log("==========================================");
}

runE2ETest().catch((err) => {
    console.error("FATAL ERROR in E2E test:", err);
    process.exit(1);
});
