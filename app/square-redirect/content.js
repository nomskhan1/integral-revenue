"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SquareRedirectContent() {
  const searchParams = useSearchParams();
  const [intentUrl, setIntentUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const callbackUrl = `${appUrl}/api/square/callback`;

    const amountCents = searchParams.get("amount");
    const customData = searchParams.get("data");
    const ticketNumber = searchParams.get("ticket");

    if (!clientId || !amountCents || !customData) {
      setError("Missing payment parameters. Please go back and try again.");
      return;
    }

    // Use the simple square-commerce-v1:// scheme directly as an anchor href.
    // This is Square's documented web deep link format and works when tapped
    // as a real anchor element on Android.
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

  const dollars = ((parseInt(searchParams.get("amount") || "0")) / 100).toFixed(2);

  if (error) {
    return (
      <div style={{ fontFamily: "sans-serif", padding: 32, textAlign: "center" }}>
        <p style={{ color: "red" }}>{error}</p>
        <a href="/dashboard?tab=checkout" style={{ color: "#0070f3" }}>← Go back</a>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "sans-serif",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      textAlign: "center",
      background: "#fff",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Tap to Pay
      </h1>
      <p style={{ fontSize: 18, color: "#444", marginBottom: 8 }}>
        Amount: <strong>${dollars}</strong>
      </p>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 32 }}>
        Tap the button below to open Square and process the payment.
      </p>

      {intentUrl && (
        <a
          href={intentUrl}
          style={{
            display: "block",
            background: "#006aff",
            color: "#fff",
            padding: "18px 40px",
            borderRadius: 12,
            fontSize: 18,
            fontWeight: 700,
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          Open Square — ${dollars}
        </a>
      )}

      <a
        href="/dashboard?tab=checkout"
        style={{ fontSize: 14, color: "#666" }}
      >
        ← Cancel and go back
      </a>
    </div>
  );
}
