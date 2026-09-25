const API_BASE = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export const api = {
  patients: () => request("/patients"),
  patient: (id) => request(`/patients/${id}`),
  digitalTwin: (id) => request(`/patients/${id}/digital-twin`),
  whatIf: (id, payload) =>
    request(`/patients/${id}/what-if`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  alerts: () => request("/alerts"),
  alertHistory: () => request("/alerts/history"),
  resolveAlert: (id) =>
    request(`/alerts/${id}/resolve`, { method: "PATCH" }),
  rooms: () => request("/rooms"),
  beds: () => request("/beds"),
  assignBed: (bedId, patientId) =>
    request(`/beds/${bedId}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ patientId })
    }),
  releaseBed: (bedId) =>
    request(`/beds/${bedId}/release`, { method: "PATCH" }),
  bedMaintenance: (bedId) =>
    request(`/beds/${bedId}/maintenance`, { method: "PATCH" }),
  bedAvailable: (bedId) =>
    request(`/beds/${bedId}/available`, { method: "PATCH" }),
  deleteBed: (bedId) =>
    request(`/beds/${bedId}`, { method: "DELETE" }),
  prescriptions: (patientId) =>
    request(`/prescriptions/patient/${patientId}`),
  createPrescription: (payload) =>
    request("/prescriptions", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updatePrescription: (id, payload) =>
    request(`/prescriptions/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  prescriptionStatus: (id, status) =>
    request(`/prescriptions/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }),
  deletePrescription: (id) =>
    request(`/prescriptions/${id}`, { method: "DELETE" })
};
