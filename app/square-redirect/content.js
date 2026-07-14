"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SquareRedirectContent() {
  const searchParams = useSearchParams();
  const [intentUrl, setIntentUrl] = useState("");
  const [error, setError] = useState("");
  const [squareLaunched, setSquareLaunched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const amountCents = searchParams.get("amount");
  const customData = searchParams.get("data");
  const ticketNumber = searchParams.get("ticket");
  const dollars = ((parseInt(amountCents || "0")) / 100).toFixed(2);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const callbackUrl = `${appUrl}/api/square/callback`;

    if (!clientId || !amountCents || !customData) {
      setError("Missing payment parameters. Please go back and try again.");
      return;
    }

    const squareParams = new URLSearchParams({
      client_id: clientId,
      amount_money: amountCents,
      currency_code: "USD",
      callback_url: callbackUrl,
      data: customData,
      options: JSON.stringify({
        supported_tender_types: ["CREDIT_CARD", "CARD_ON_FILE"],
      }),
    });

    setIntentUrl(`square-commerce-v1://payment/create?${squareParams.toString()}`);
  }, [searchParams]);

  async function confirmPayment() {
    const ticketId = customData?.split("|")[0];
    if (!ticketId) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/square/manual-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
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

  if (error) {
    return (
      <div style={{ fontFamily: "sans-serif", padding: 32, textAlign: "center" }}>
        <p style={{ color: "red" }}>{error}</p>
        <a href="/dashboard?tab=checkout" style={{ color: "#0070f3" }}>← Go back</a>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div style={{ fontFamily: "sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", background: "#fff" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Payment confirmed!</h1>
        <p style={{ color: "#666" }}>Returning to checkout...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", background: "#fff" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Tap to Pay</h1>
      <p style={{ fontSize: 18, color: "#444", marginBottom: 8 }}>
        Amount: <strong>${dollars}</strong>
      </p>

      {!squareLaunched ? (
        <>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 32 }}>
            Tap the button below to open Square and process the payment.
          </p>
          {intentUrl && (
            <a
              href={intentUrl}
              onClick={() => setSquareLaunched(true)}
              style={{ display: "block", background: "#006aff", color: "#fff", padding: "18px 40px", borderRadius: 12, fontSize: 18, fontWeight: 700, textDecoration: "none", marginBottom: 24 }}
            >
              Open Square — ${dollars}
            </a>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
            Complete the payment in Square, then tap below to confirm.
          </p>
          <button
            onClick={confirmPayment}
            disabled={confirming}
            style={{ display: "block", width: "100%", maxWidth: 320, background: "#22c55e", color: "#fff", padding: "18px 40px", borderRadius: 12, fontSize: 18, fontWeight: 700, border: "none", cursor: "pointer", marginBottom: 16 }}
          >
            {confirming ? "Confirming..." : "✓ Payment received — confirm"}
          </button>
          <a
            href={intentUrl}
            style={{ display: "block", background: "#006aff", color: "#fff", padding: "14px 32px", borderRadius: 12, fontSize: 15, fontWeight: 600, textDecoration: "none", marginBottom: 24 }}
          >
            Re-open Square
          </a>
        </>
      )}

      <a href="/dashboard?tab=checkout" style={{ fontSize: 14, color: "#666" }}>
        ← Cancel and go back
      </a>
    </div>
  );
}
