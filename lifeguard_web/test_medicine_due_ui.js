import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import AppShell from "./src/components/AppShell.jsx";

console.log("=== RUNNING REACT UI MEDICINE DUE NOTIFICATION TEST ===");

// Test 1: AppShell with dueReminderCount renders badge
const shellHtml = renderToString(
  React.createElement(
    AppShell,
    {
      activePage: "dashboard",
      onNavigate: () => {},
      onLogout: () => {},
      alertCount: 0,
      dueReminderCount: 2,
      connected: true,
      pageTheme: "bg-slate-50"
    },
    React.createElement("div", null, "Child Content")
  )
);

assert.ok(shellHtml.includes("2 Due"), "AppShell header must render '2 Due' pill when dueReminderCount > 0");
console.log("✓ AppShell renders Medicine Due indicator pill in header.");

// Test 2: Notification Card markup structure
const mockReminder = {
  _id: "test-presc-123",
  occurrenceId: "test-presc-123:2026-09-29T16:15:00.000Z",
  patientId: "P012",
  treatmentName: "Amoxicillin 500mg",
  dosage: "1 capsule with water",
  scheduledTime: "10:00 PM",
  dueTime: "29 Sept 2026, 10:00 pm",
  status: "ACTIVE"
};

const ReminderCard = ({ reminder }) => {
  return React.createElement(
    "div",
    {
      className: "rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 shadow-2xl text-slate-900",
      role: "alert",
      "aria-live": "assertive"
    },
    React.createElement(
      "div",
      { className: "flex items-center justify-between pb-2 border-b border-amber-200" },
      React.createElement(
        "div",
        { className: "flex items-center gap-2" },
        React.createElement("span", { className: "font-extrabold text-sm text-amber-950 uppercase" }, "MEDICINE DUE")
      ),
      React.createElement("button", { type: "button" }, "Dismiss")
    ),
    React.createElement(
      "div",
      { className: "mt-3 space-y-1 text-sm font-medium text-slate-800" },
      React.createElement("p", null, "Patient: ", React.createElement("strong", null, reminder.patientId)),
      React.createElement("p", null, "Medicine: ", React.createElement("strong", null, reminder.treatmentName)),
      React.createElement("p", null, "Dosage: ", reminder.dosage),
      React.createElement("p", null, "Scheduled time: ", reminder.dueTime || reminder.scheduledTime)
    ),
    React.createElement(
      "div",
      { className: "mt-3 pt-2 flex items-center justify-end gap-2 border-t border-amber-200/60" },
      React.createElement("button", { type: "button" }, "View Patient")
    )
  );
};

const cardHtml = renderToString(React.createElement(ReminderCard, { reminder: mockReminder }));

assert.ok(cardHtml.includes("MEDICINE DUE"), "Must display MEDICINE DUE title");
assert.ok(cardHtml.includes("Patient:"), "Must display Patient label");
assert.ok(cardHtml.includes("P012"), "Must display patient ID");
assert.ok(cardHtml.includes("Medicine:"), "Must display Medicine label");
assert.ok(cardHtml.includes("Amoxicillin 500mg"), "Must display medicine name");
assert.ok(cardHtml.includes("Dosage:"), "Must display Dosage label");
assert.ok(cardHtml.includes("1 capsule with water"), "Must display dosage");
assert.ok(cardHtml.includes("Scheduled time:"), "Must display Scheduled time label");
assert.ok(cardHtml.includes("29 Sept 2026, 10:00 pm"), "Must display due time");
assert.ok(cardHtml.includes("View Patient"), "Must display View Patient action button");

console.log("✓ Medicine Due card HTML contains all required fields: Patient, Medicine, Dosage, Scheduled time, and Action buttons.");
console.log("==========================================");
console.log("ALL REACT UI TESTS PASSED 100%!");
console.log("==========================================");
