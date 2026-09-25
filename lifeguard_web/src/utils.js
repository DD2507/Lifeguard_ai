export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning, Doctor";
  if (hour < 17) return "Good afternoon, Doctor";
  return "Good evening, Doctor";
}

export function patientIndex(patientId = "") {
  const digits = String(patientId).replace(/\D/g, "");
  if (digits) return digits.padStart(3, "0").slice(-3);
  return String(patientId).slice(-3).toUpperCase() || "---";
}

export function formatVital(value, suffix = "") {
  if (value === null || value === undefined || value === "" || Number(value) === 0) {
    return "--";
  }
  return `${value}${suffix}`;
}

export function riskTone(risk) {
  const value = String(risk || "LOW").toUpperCase();
  if (value === "HIGH") {
    return {
      key: "high",
      label: "High Risk",
      pill: "bg-rose-100 text-rose-700 border-rose-200",
      solid: "bg-rose-600 text-white",
      card: "border-rose-300",
      text: "text-rose-600",
      soft: "bg-rose-50"
    };
  }
  if (value === "MODERATE") {
    return {
      key: "moderate",
      label: "Moderate Risk",
      pill: "bg-amber-50 text-amber-700 border-amber-200",
      solid: "bg-amber-500 text-white",
      card: "border-amber-200",
      text: "text-amber-600",
      soft: "bg-amber-50"
    };
  }
  return {
    key: "low",
    label: "Stable",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    solid: "bg-emerald-600 text-white",
    card: "border-slate-200",
    text: "text-emerald-600",
    soft: "bg-emerald-50"
  };
}

export function timeAgo(dateValue) {
  if (!dateValue) return "Just now";
  const then = new Date(dateValue).getTime();
  const delta = Math.max(0, Date.now() - then);
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function reasonValue(reasons, factor) {
  const match = (reasons || []).find((item) => item.factor === factor);
  return match?.value ?? null;
}

export function occupancyRate(beds) {
  if (!beds.length) return 0;
  const occupied = beds.filter((bed) => bed.status === "OCCUPIED").length;
  return Math.round((occupied / beds.length) * 1000) / 10;
}
