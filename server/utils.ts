// Utility functions for the certification platform

export function getBadgeFromScore(score: number): string {
  if (score >= 90) return "platinum";
  if (score >= 80) return "gold";
  if (score >= 70) return "silver";
  if (score >= 50) return "bronze";
  return "bronze"; // minimum badge for passing
}

export function generateCertificateNumber(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OCT-${timestamp.slice(-8)}-${random}`;
}

export function generateUniqueTransactionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `TXN${timestamp}${random}`.toUpperCase();
}

export function calculateExpiryDate(): Date {
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 2); // 2 years validity
  return expiryDate;
}

export function getBadgeColor(badge: string): string {
  switch (badge) {
    case "platinum": return "#E5E7EB";
    case "gold": return "#FCD34D";
    case "silver": return "#D1D5DB";
    case "bronze": return "#F59E0B";
    default: return "#F59E0B";
  }
}

export function getBadgeIcon(badge: string): string {
  switch (badge) {
    case "platinum": return "💎";
    case "gold": return "🥇";
    case "silver": return "🥈";
    case "bronze": return "🥉";
    default: return "🥉";
  }
}