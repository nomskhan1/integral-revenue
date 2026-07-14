"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SquareRedirectContent() {
  const searchParams = useSearchParams();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const amountCents = searchParams.get("amount");
  const customData = searchParams.get("data");
  const ticketNumber = searchParams.get("ticket");
  const employeeId = searchParams.get("employee");
  const dollars = ((parseInt(amountCents || "0")) / 100).toFixed(2);

  async function confirmPayment() {
    const ticketId = customData?.split("|")[0];
    if (!ticketId) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/square/manual-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, employeeId }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmed(true);
        setTimeout(() => {
          window.location.href = `/dashboard?tab=checkout&square_success=1&ticket_number=${data.ticketNumber}&amount=${data.feeAmount}`;
        }, 1500);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  if (confirmed) {
    return (
      <div style={{ fontFamily: "sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", background: "#fff" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Payment confirmed!</h1>
        <p style={{ color: "#666" }}>Returning to checkout...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", background: "#fff" }}>

      {/* Step 1 — Amount to charge */}
      <div style={{ background: "#f0f9ff", border: "2px solid #0ea5e9", borderRadius: 16, padding: "24px 40px", marginBottom: 32, width: "100%", maxWidth: 320 }}>
        <div style={{ fontSize: 13, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Ticket #{ticketNumber} — Amount to charge
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, color: "#0c4a6e" }}>
          ${dollars}
        </div>
      </div>

      {/* Step 2 — Instructions */}
      <div style={{ marginBottom: 32, maxWidth: 320 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, textAlign: "left" }}>
          <div style={{ background: "#0ea5e9", color: "#fff", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>1</div>
          <p style={{ margin: 0, fontSize: 15, color: "#333" }}>Open <strong>Square POS</strong> app and enter <strong>${dollars}</strong></p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, textAlign: "left" }}>
          <div style={{ background: "#0ea5e9", color: "#fff", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>2</div>
          <p style={{ margin: 0, fontSize: 15, color: "#333" }}>Have customer tap or chip their card on the <strong>Square Reader</strong></p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left" }}>
          <div style={{ background: "#0ea5e9", color: "#fff", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>3</div>
          <p style={{ margin: 0, fontSize: 15, color: "#333" }}>Once approved, tap the button below</p>
        </div>
      </div>

      {error && <p style={{ color: "red", marginBottom: 16 }}>{error}</p>}

      {/* Step 3 — Confirm */}
      <button
        onClick={confirmPayment}
        disabled={confirming}
        style={{ width: "100%", maxWidth: 320, background: confirming ? "#999" : "#22c55e", color: "#fff", padding: "18px 0", borderRadius: 12, fontSize: 18, fontWeight: 700, border: "none", cursor: confirming ? "default" : "pointer", marginBottom: 16 }}
      >
        {confirming ? "Confirming..." : "✓ Payment approved — confirm"}
      </button>

      <a href="/dashboard?tab=checkout" style={{ fontSize: 14, color: "#666" }}>
        ← Cancel and go back
      </a>
    </div>
  );
}
