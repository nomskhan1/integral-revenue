"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SquareRedirectContent() {
  const searchParams = useSearchParams();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [launched, setLaunched] = useState(false);
  const [squareUrl, setSquareUrl] = useState("");

  const amountCents = searchParams.get("amount");
  const customData = searchParams.get("data");
  const ticketNumber = searchParams.get("ticket");
  const employeeId = searchParams.get("employee");
  const dollars = ((parseInt(amountCents || "0")) / 100).toFixed(2);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const callbackUrl = `${appUrl}/api/square/callback`;

    if (!clientId || !amountCents || !customData) return;

    // Square's documented JSON format for mobile web
    const dataParameter = {
      amount_money: {
        amount: String(amountCents),
        currency_code: "USD",
      },
      callback_url: callbackUrl,
      client_id: clientId,
      version: "1.3",
      notes: customData, // stores ticketId|employeeId - returned in callback
      options: {
        supported_tender_types: ["CREDIT_CARD", "CARD_ON_FILE"],
      },
    };

    const url = `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(dataParameter))}`;
    setSquareUrl(url);

    // Auto-launch Square POS after a short delay so the page renders first
    const timer = setTimeout(() => {
      window.location.href = url;
      setLaunched(true);
    }, 800);

    return () => clearTimeout(timer);
  }, [searchParams]);

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

      <div style={{ background: "#f0f9ff", border: "2px solid #0ea5e9", borderRadius: 16, padding: "24px 40px", marginBottom: 32, width: "100%", maxWidth: 320 }}>
        <div style={{ fontSize: 13, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Ticket #{ticketNumber} — Amount
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, color: "#0c4a6e" }}>
          ${dollars}
        </div>
      </div>

      {!launched ? (
        <p style={{ fontSize: 15, color: "#666", marginBottom: 24 }}>Opening Square POS...</p>
      ) : (
        <p style={{ fontSize: 15, color: "#666", marginBottom: 24 }}>
          Complete the payment in Square, then tap confirm below.
        </p>
      )}

      {/* Manual launch button in case auto-launch doesn't work */}
      {squareUrl && (
        <a
          href={squareUrl}
          onClick={() => setLaunched(true)}
          style={{ display: "block", background: "#006aff", color: "#fff", padding: "14px 32px", borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: "none", marginBottom: 24, width: "100%", maxWidth: 320 }}
        >
          Open Square POS
        </a>
      )}

      {error && <p style={{ color: "red", marginBottom: 16 }}>{error}</p>}

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
