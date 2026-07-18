"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

function money(n) {
  return "$" + (Number(n) || 0).toFixed(2);
}

// Formats a rate tier's maxMinutes into a friendly label, e.g.
// 30 -> "30 min", 45 -> "45 min", 60 -> "1 hour", 90 -> "1 hr 30 min",
// 240 -> "4 hours".
function formatTierDuration(maxHours) {
  if (maxHours === null || maxHours === undefined) return "Anything beyond";
  const hours = Math.floor(maxHours);
  const mins = Math.round((maxHours - hours) * 60);
  if (hours === 0) return `Up to ${mins} min`;
  if (mins === 0) return `Up to ${hours} hour${hours === 1 ? "" : "s"}`;
  return `Up to ${hours} hr ${mins} min`;
}

// Parses "hours.minutes" notation like a clock reading — NOT a decimal
// fraction. "1.45" = 1 hour 45 min, "0.30" = 30 min, "2" = 2 hours.
// Returns { hours } as a float on success, or { error } on invalid input.
function parseHoursMinutesInput(raw) {
  const str = String(raw ?? "").trim();
  if (str === "") return { hours: null }; // open-ended tier

  if (!str.includes(".")) {
    const h = parseInt(str, 10);
    if (isNaN(h) || h < 0) return { error: "Enter a valid number of hours." };
    return { hours: h };
  }

  const [hoursPart, minutesPart] = str.split(".");
  const h = hoursPart === "" ? 0 : parseInt(hoursPart, 10);
  const m = parseInt(minutesPart, 10);

  if (isNaN(h) || h < 0) return { error: "Enter a valid number of hours." };
  if (isNaN(m) || m < 0 || m > 59) {
    return { error: `"${str}" isn't valid — the part after the decimal is minutes (0–59). Example: 1.45 = 1 hr 45 min.` };
  }
  // Store as float hours: 1 hr 45 min = 1.7500
  return { hours: h + m / 60 };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState("");
  const [appSettings, setAppSettings] = useState({});
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.replace("/login");
        } else {
          setUser(d.user);
          if (d.user.role === "EMPLOYEE" || d.user.role === "GARAGE_MANAGER") setTab("checkin");
          else if (d.user.role === "SUPER_ADMIN") setTab("garages");
          else setTab("revenue");
        }
      });
    // Load branding settings (logo, company name) for all roles.
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => { if (s && !s.error) setAppSettings(s); })
      .catch(() => {});
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (user === undefined) return null;
  if (!user) return null;

  const isOperational = user.role === "EMPLOYEE" || user.role === "GARAGE_MANAGER";
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="" className="logo" />
          <div>
            <span className="mark">Integral Revenue</span>
            <div style={{ fontSize: 10, color: "var(--slate2)", lineHeight: 1.2 }}>
              {user.garage?.name
                ? user.garage.name
                : user.role.replace(/_/g, " ")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {(user.garage?.logoUrl || appSettings.logoUrl) && (
            <img
              src={user.garage?.logoUrl || appSettings.logoUrl}
              alt="Company logo"
              style={{ height: 36, maxWidth: 120, objectFit: "contain" }}
            />
          )}
          <button
            className="btn-ghost"
            style={{ width: "auto", padding: "8px 14px", borderRadius: 20, fontSize: 11 }}
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </header>
      <main>
        {isOperational && (
          <div className="tabs">
            <button className={tab === "checkin" ? "active" : ""} onClick={() => setTab("checkin")}>
              Check-In
            </button>
            <button className={tab === "checkout" ? "active" : ""} onClick={() => setTab("checkout")}>
              Check-Out
            </button>
            <button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>
              Active
            </button>
            <button className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>
              My Reports
            </button>
            {user.role === "GARAGE_MANAGER" && (
              <button className={tab === "employees" ? "active" : ""} onClick={() => setTab("employees")}>
                Employees
              </button>
            )}
            {user.role === "GARAGE_MANAGER" && (
              <button className={tab === "garage-reports" ? "active" : ""} onClick={() => setTab("garage-reports")}>
                Garage Reports
              </button>
            )}
            {user.role === "GARAGE_MANAGER" && (
              <button className={tab === "ticket-history" ? "active" : ""} onClick={() => setTab("ticket-history")}>
                Ticket History
              </button>
            )}
            {user.role === "GARAGE_MANAGER" && (
              <button className={tab === "daily-closed" ? "active" : ""} onClick={() => setTab("daily-closed")}>
                Daily Closed
              </button>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="tabs">
            <button className={tab === "revenue" ? "active" : ""} onClick={() => setTab("revenue")}>
              Revenue
            </button>
            <button className={tab === "garages" ? "active" : ""} onClick={() => setTab("garages")}>
              Garages
            </button>
            <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
              Users
            </button>
            <button className={tab === "ticket-history" ? "active" : ""} onClick={() => setTab("ticket-history")}>
              Ticket History
            </button>
            <button className={tab === "daily-closed" ? "active" : ""} onClick={() => setTab("daily-closed")}>
              Daily Closed
            </button>
            <button className={tab === "branding" ? "active" : ""} onClick={() => setTab("branding")}>
              Branding
            </button>
            <button className={tab === "vouchers" ? "active" : ""} onClick={() => setTab("vouchers")}>
              N/C Vouchers
            </button>
          </div>
        )}

        {isSuperAdmin && (
          <div className="tabs">
            <button className={tab === "garages" ? "active" : ""} onClick={() => setTab("garages")}>
              Garages
            </button>
            <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
              Admins
            </button>
            <button className={tab === "branding" ? "active" : ""} onClick={() => setTab("branding")}>
              Branding
            </button>
          </div>
        )}

        {tab === "checkin" && isOperational && <CheckInView />}
        {tab === "checkout" && isOperational && <CheckOutView />}
        {tab === "active" && isOperational && <ActiveTicketsView />}
        {tab === "reports" && isOperational && (
          <MyReportsView user={user} />
        )}
        {tab === "employees" && user.role === "GARAGE_MANAGER" && <UsersView currentUser={user} />}
        {tab === "garage-reports" && user.role === "GARAGE_MANAGER" && <GarageReportsView user={user} />}
        {tab === "ticket-history" && (user.role === "GARAGE_MANAGER" || isAdmin) && <TicketHistoryView user={user} showGarageFilter={isAdmin} logoUrl={appSettings.logoUrl} companyName={appSettings.companyName} />}
        {tab === "daily-closed" && (user.role === "GARAGE_MANAGER" || isAdmin) && <DailyClosedView user={user} showGarageFilter={isAdmin} logoUrl={appSettings.logoUrl} companyName={appSettings.companyName} />}
        {tab === "branding" && (isAdmin || isSuperAdmin) && <BrandingView settings={appSettings} onSaved={setAppSettings} />}
        {tab === "vouchers" && (isAdmin || user.role === "GARAGE_MANAGER") && <VouchersView user={user} isAdmin={isAdmin} />}
        {tab === "revenue" && isAdmin && <RevenueDashboard user={user} />}
        {tab === "garages" && (isAdmin || isSuperAdmin) && <GaragesView currentUser={user} />}
        {tab === "users" && (isAdmin || isSuperAdmin) && <UsersView currentUser={user} />}

        {showPasswordPanel && <ChangePasswordPanel onClose={() => setShowPasswordPanel(false)} />}
      </main>
      <footer className="note">
        Signed in as {user.name} ({user.username})
        {" · "}
        <button
          onClick={() => setShowPasswordPanel((v) => !v)}
          style={{
            background: "none", border: "none", color: "var(--brass-light)", fontSize: 11,
            cursor: "pointer", padding: 0, textDecoration: "underline",
          }}
        >
          Change password
        </button>
      </footer>
    </div>
  );
}

// ---------------- CHANGE PASSWORD ----------------
function ChangePasswordPanel({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 className="title" style={{ marginBottom: 0, fontSize: 18 }}>Change password</h1>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--slate2)", cursor: "pointer" }}>
          Close
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}
      {success ? (
        <p style={{ color: "var(--green)", fontSize: 14 }}>Password updated successfully.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn btn-primary" type="submit">Update password</button>
        </form>
      )}
    </div>
  );
}

// ---------------- SHIFT REPORT FORM (shared by Employee & Garage Manager) ----------------
// ---------------- CHECK-IN ----------------
function CheckInView() {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ticket, setTicket] = useState(null);

  const [apartmentNumber, setApartmentNumber] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [parkingLocation, setParkingLocation] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanNotice, setScanNotice] = useState("");
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  function resizeImageFile(file, maxDimension = 1024, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError("");
    setScanNotice("");
    setScanning(true);
    try {
      const dataUrl = await resizeImageFile(file);
      setPhotoPreview(dataUrl);

      // Upload the photo so it can be attached to the printed receipt,
      // regardless of whether AI scanning is set up or succeeds.
      fetch("/api/tickets/upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      })
        .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }) => {
          if (ok) setVehiclePhotoUrl(d.url);
        })
        .catch(() => {});

      const res = await fetch("/api/vehicle-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error);
        return;
      }
      if (data.make) setVehicleMake(data.make);
      if (data.model) setVehicleModel(data.model);
      if (data.color) setVehicleColor(data.color);
      if (data.licensePlate) setLicensePlate(data.licensePlate);
      setScanNotice("Filled in from photo — please double check before submitting.");
    } catch (err) {
      setScanError("Couldn't process that photo. Try again or enter details manually.");
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = { apartmentNumber, vehicleMake, vehicleModel, vehicleColor, licensePlate, parkingLocation, photoUrl: vehiclePhotoUrl };
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setSmsStatus(null);
    setTicket(data);
    setApartmentNumber(""); setVehicleMake(""); setVehicleModel("");
    setVehicleColor(""); setLicensePlate(""); setParkingLocation("");
    setScanNotice(""); setVehiclePhotoUrl(null); setPhotoPreview(null);
  }

  async function sendSms(ticketId, phone) {
    setSmsSending(true); setSmsStatus(null);
    const res = await fetch("/api/tickets/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, phone }),
    });
    const data = await res.json();
    setSmsSending(false);
    setSmsStatus(res.ok ? "sent" : data.error || "Failed to send.");
  }

  if (ticket) {
    return (
      <>
        <div className="hero-line">Vehicle checked in</div>
        <h1 className="title">Ticket #{ticket.ticketNumber}</h1>
        <div className="card" style={{ textAlign: "center" }}>
          <img src={ticket.qrDataUrl} alt="QR code" style={{ width: 220, height: 220, margin: "0 auto" }} />
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, color: "var(--brass-light)", marginTop: 12 }}>
            #{ticket.ticketNumber}
          </div>
          <div style={{ fontSize: 12, color: "var(--slate2)", marginTop: 4 }}>
            {new Date(ticket.checkInTime).toLocaleString()}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => printTicketInPopup(ticket)}>
          Print 2 ticket copies
        </button>

        {/* SMS ticket to guest */}
        <div className="card" style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 10 }}>
            Text ticket to guest
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={guestPhone}
              onChange={(e) => { setGuestPhone(e.target.value); setSmsStatus(null); }}
              placeholder="Guest phone number"
              type="tel"
              inputMode="tel"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-ghost"
              style={{ width: "auto", padding: "0 14px", flexShrink: 0 }}
              disabled={smsSending || !guestPhone.trim()}
              onClick={() => sendSms(ticket.id, guestPhone)}
            >
              {smsSending ? "Sending..." : "Send"}
            </button>
          </div>
          {smsStatus === "sent" && (
            <div style={{ fontSize: 12, color: "var(--green)", marginTop: 8 }}>✓ Ticket texted to guest</div>
          )}
          {smsStatus && smsStatus !== "sent" && (
            <div style={{ fontSize: 12, color: "var(--red)", marginTop: 8 }}>✗ {smsStatus}</div>
          )}
        </div>

        <button className="btn btn-ghost" onClick={() => { setTicket(null); setGuestPhone(""); setSmsStatus(null); }}>
          Check in another vehicle
        </button>

        {/* Hidden except when printing — rendered twice for the two copies. */}
        <div className="print-ticket">
          {[0, 1].map((copy) => (
            <div key={copy} style={{ marginBottom: copy === 0 ? "20mm" : 0 }}>
              <div className="pt-center pt-big">{ticket.garage?.name || "Garage"}</div>
              <div className="pt-center" style={{ fontSize: 17, fontWeight: 600 }}>{copy === 0 ? "CUSTOMER COPY" : "GARAGE COPY"}</div>
              <div className="pt-line"></div>
              <div className="pt-center" style={{ fontSize: 32, fontWeight: 700 }}>#{ticket.ticketNumber}</div>
              <div className="pt-center"><img src={ticket.qrDataUrl} alt="" style={{ width: "140px" }} /></div>
              <div className="pt-line"></div>
              <div className="pt-row"><span>Checked in</span><span>{new Date(ticket.checkInTime).toLocaleString()}</span></div>
              {ticket.apartmentNumber && <div className="pt-row"><span>Unit</span><span>{ticket.apartmentNumber}</span></div>}
              {ticket.licensePlate && <div className="pt-row"><span>Plate</span><span>{ticket.licensePlate}</span></div>}
              {(ticket.vehicleMake || ticket.vehicleModel) && (
                <div className="pt-row"><span>Vehicle</span><span>{[ticket.vehicleColor, ticket.vehicleMake, ticket.vehicleModel].filter(Boolean).join(" ")}</span></div>
              )}
              {ticket.parkingLocation && <div className="pt-row"><span>Location</span><span>{ticket.parkingLocation}</span></div>}
              {ticket.photoUrl && (
                <div className="pt-center" style={{ marginTop: "4mm" }}>
                  <img src={ticket.photoUrl} alt="" style={{ width: "100%", maxHeight: "60mm", objectFit: "cover" }} />
                </div>
              )}
              {copy === 0 && (
                <div style={{ textAlign: "center", marginTop: "8mm", borderTop: "2px dashed #000", paddingTop: "4mm", fontSize: 12, letterSpacing: "0.1em" }}>
                  ✂ CUT HERE
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="hero-line">New arrival</div>
      <h1 className="title">Check In a Vehicle</h1>
      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>Scan vehicle photo (optional)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ flex: 1, marginTop: 0 }}
            onClick={() => cameraInputRef.current?.click()}
            disabled={scanning}
          >
            📷 Take Photo
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ flex: 1, marginTop: 0 }}
            onClick={() => galleryInputRef.current?.click()}
            disabled={scanning}
          >
            🖼️ Choose Photo
          </button>
        </div>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display: "none" }} />
        <input ref={galleryInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: "none" }} />
        {scanning && <div className="field-hint">Analyzing photo...</div>}
        {scanError && <div className="error-box" style={{ marginTop: 10 }}>{scanError}</div>}
        {scanNotice && !scanError && (
          <p style={{ color: "var(--green)", fontSize: 12, marginTop: 8 }}>{scanNotice}</p>
        )}
        {photoPreview && (
          <img src={photoPreview} alt="Vehicle preview" style={{ marginTop: 10, maxWidth: "100%", borderRadius: 8, maxHeight: 160 }} />
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Apartment / Unit number (optional)</label>
          <input value={apartmentNumber} onChange={(e) => setApartmentNumber(e.target.value)} />
        </div>
        <div className="field">
          <label>Vehicle make</label>
          <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} placeholder="e.g. Toyota" />
        </div>
        <div className="field">
          <label>Vehicle model</label>
          <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="e.g. Camry" />
        </div>
        <div className="field">
          <label>Color</label>
          <input value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} />
        </div>
        <div className="field">
          <label>License plate</label>
          <input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
        </div>
        <div className="field">
          <label>Parking location (optional)</label>
          <input value={parkingLocation} onChange={(e) => setParkingLocation(e.target.value)} placeholder="e.g. Level 2, Spot 14" />
        </div>
        <div className="field">
          <label>Guest phone number (optional)</label>
          <input
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            placeholder="e.g. 312-555-0100"
            type="tel"
            inputMode="tel"
          />
          <div className="field-hint">If provided, we'll offer to text them their ticket QR code after check-in.</div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Checking in..." : "Check in & generate ticket"}
        </button>
      </form>
    </>
  );
}

// ---------------- CHECK-OUT ----------------
function CheckOutView() {
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherStatus, setVoucherStatus] = useState(null);
  const [voucherPhotoUrl, setVoucherPhotoUrl] = useState(null);
  const [voucherPhotoUploading, setVoucherPhotoUploading] = useState(false);
  const voucherPhotoInputRef = useRef(null); // null | { valid, error, voucher }
  const [paymentNote, setPaymentNote] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(null);
  const [enabledMethods, setEnabledMethods] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Read Square callback params from URL on mount — Square redirects back
  // here after a payment with ?square_success=1&ticket_number=...&amount=...
  // or ?square_error=... in case of cancellation or failure.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const squareSuccess = params.get("square_success");
    const squareError = params.get("square_error");
    const ticketNumber = params.get("ticket_number");
    const amount = params.get("amount");

    if (squareSuccess === "1") {
      setCompleted({
        ticketNumber,
        feeAmount: parseFloat(amount || "0"),
        paymentMethod: "CREDIT_CARD",
        durationMinutes: null, // not available in URL, that's ok
        _squarePaid: true,
      });
      // Clean URL without reloading
      window.history.replaceState({}, "", "/dashboard?tab=checkout");
    } else if (squareError) {
      const msg = squareError === "cancelled"
        ? "Payment was cancelled. You can try again."
        : `Payment failed (${squareError}). Please try again or use a different method.`;
      setError(msg);
      window.history.replaceState({}, "", "/dashboard?tab=checkout");
    }
  }, []);

  const METHOD_LABELS = {
    CASH: "Cash", CREDIT_CARD: "Credit Card", COUPON: "Coupon",
    CHARGE_BACK: "Charge Back", NC: "N/C", LOANER: "Loaner",
  };

  const loadEnabledMethods = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    const meData = await meRes.json();
    if (!meData.user?.garageId) return;
    setCurrentUserId(meData.user.id);
    const res = await fetch(`/api/garages/${meData.user.garageId}/payment-methods`);
    if (res.ok) {
      const methods = await res.json();
      setEnabledMethods(methods);
      if (methods.length > 0) setPaymentMethod(methods[0].method);
    }
  }, []);

  useEffect(() => { loadEnabledMethods(); }, [loadEnabledMethods]);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanLoopRef = useRef(null);

  // Separate camera for voucher QR scanning
  const [voucherCameraOpen, setVoucherCameraOpen] = useState(false);
  const voucherVideoRef = useRef(null);
  const voucherStreamRef = useRef(null);
  const voucherScanLoopRef = useRef(null);

  async function openVoucherCamera() {
    setVoucherCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      voucherStreamRef.current = stream;
      if (voucherVideoRef.current) {
        voucherVideoRef.current.srcObject = stream;
        await voucherVideoRef.current.play();
      }
      const jsQR = (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      function tick() {
        if (!voucherVideoRef.current || voucherVideoRef.current.readyState !== voucherVideoRef.current.HAVE_ENOUGH_DATA) {
          voucherScanLoopRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = voucherVideoRef.current.videoWidth;
        canvas.height = voucherVideoRef.current.videoHeight;
        ctx.drawImage(voucherVideoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result?.data) {
          closeVoucherCamera();
          setVoucherCode(result.data.toUpperCase());
          setVoucherStatus(null);
          // Auto-validate after scan
          fetch(`/api/vouchers/validate?code=${encodeURIComponent(result.data.trim().toUpperCase())}&garageId=${ticket?.garageId}`)
            .then(r => r.json()).then(setVoucherStatus).catch(() => {});
          return;
        }
        voucherScanLoopRef.current = requestAnimationFrame(tick);
      }
      voucherScanLoopRef.current = requestAnimationFrame(tick);
    } catch {
      setVoucherCameraOpen(false);
    }
  }

  function closeVoucherCamera() {
    if (voucherScanLoopRef.current) cancelAnimationFrame(voucherScanLoopRef.current);
    if (voucherStreamRef.current) {
      voucherStreamRef.current.getTracks().forEach(t => t.stop());
      voucherStreamRef.current = null;
    }
    setVoucherCameraOpen(false);
  }

  useEffect(() => { return () => closeVoucherCamera(); }, []);

  async function lookupByCode(rawCode) {
    setError("");
    setTicket(null);
    const trimmed = (rawCode || "").trim();
    if (!trimmed) return;
    const res = await fetch(`/api/tickets/lookup?code=${encodeURIComponent(trimmed)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setCode("");
      return;
    }
    setTicket(data);
  }

  async function lookup(e) {
    e.preventDefault();
    await lookupByCode(code);
  }

  async function openCamera() {
    setCameraError("");
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const jsQR = (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      function tick() {
        if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
          scanLoopRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result?.data) {
          closeCamera();
          setCode(result.data);
          lookupByCode(result.data);
          return;
        }
        scanLoopRef.current = requestAnimationFrame(tick);
      }
      scanLoopRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setCameraError("Couldn't access the camera. Check your browser's camera permission and try again.");
    }
  }

  function closeCamera() {
    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  useEffect(() => {
    return () => closeCamera();
  }, []);

  // Launches Square POS app via deep link with amount pre-filled.
  // Works in native Android app (Capacitor wrapper) — the deep link
  // square-commerce-v1:// is handled natively, unlike Chrome WebView.
  // Square Reader processes the card, then returns to the app via callback.
  function launchSquarePOS() {
    if (!ticket || !currentUserId) return;
    setError("");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const callbackUrl = `${appUrl}/api/square/callback`;
    const amountCents = Math.round((ticket.previewFee || 0) * 100);
    const clientId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;

    if (!clientId) {
      setError("Square is not configured yet. Contact your administrator.");
      return;
    }

    if (amountCents <= 0) {
      setError("Cannot charge $0. Please check the fee calculation.");
      return;
    }

    const customData = `${ticket.id}|${currentUserId}`;

    // Square POS API — JSON data parameter format
    const dataParameter = {
      amount_money: {
        amount: String(amountCents),
        currency_code: "USD",
      },
      callback_url: callbackUrl,
      client_id: clientId,
      version: "1.3",
      notes: customData,
      options: {
        supported_tender_types: ["CREDIT_CARD", "CARD_ON_FILE"],
      },
    };

    window.location.href = `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(dataParameter))}`;
  }

  async function completeCheckout() {
    setCompleting(true);
    setError("");
    const res = await fetch(`/api/tickets/${ticket.id}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod, paymentNote, voucherCode: paymentMethod === "NC" ? voucherCode : undefined, voucherPhotoUrl: paymentMethod === "NC" ? voucherPhotoUrl : undefined }),
    });
    const data = await res.json();
    setCompleting(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setCompleted(data);
    setTicket(null);
    setCode("");
  }

  if (completed) {
    return (
      <>
        <div className="hero-line">Checkout complete</div>
        <h1 className="title">Ticket #{completed.ticketNumber}</h1>
        <div className="card">
          <div className="totals-grid">
            {!completed._squarePaid && completed.durationMinutes !== null && (
              <div className="totals-cell"><div className="label">Duration</div><div className="value" style={{ fontSize: 16 }}>{Math.floor(completed.durationMinutes / 60)}h {completed.durationMinutes % 60}m</div></div>
            )}
            <div className="totals-cell"><div className="label">Amount charged</div><div className="value">{money(completed.feeAmount)}</div></div>
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--slate2)" }}>
            {completed._squarePaid
              ? "✓ Contactless payment approved via Square Tap to Pay. Added to your shift report automatically."
              : `Paid by ${completed.paymentMethod === "CASH" ? "cash" : "credit card"}. This has been added to your shift report automatically.`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCompleted(null)}>
          Check out another vehicle
        </button>
      </>
    );
  }

  if (ticket) {
    const ZERO_FEE_METHODS = new Set(["NC", "LOANER"]);
    const displayedFee = ZERO_FEE_METHODS.has(paymentMethod) ? 0 : ticket.previewFee;

    return (
      <>
        <div className="hero-line">Confirm checkout</div>
        <h1 className="title">Ticket #{ticket.ticketNumber}</h1>
        {error && <div className="error-box">{error}</div>}
        <div className="card">
          <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
            <span style={{ color: "var(--slate2)" }}>Checked in</span>
            <span>{new Date(ticket.checkInTime).toLocaleString()}</span>
          </div>
          {ticket.apartmentNumber && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Unit</span><span>{ticket.apartmentNumber}</span>
            </div>
          )}
          {(ticket.vehicleMake || ticket.licensePlate) && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Vehicle</span>
              <span>{[ticket.vehicleColor, ticket.vehicleMake, ticket.vehicleModel].filter(Boolean).join(" ")}{ticket.licensePlate ? ` · ${ticket.licensePlate}` : ""}</span>
            </div>
          )}
          <div className="totals-grid" style={{ marginTop: 12 }}>
            <div className="totals-cell"><div className="label">Time parked</div><div className="value" style={{ fontSize: 16 }}>{Math.floor(ticket.previewMinutes / 60)}h {ticket.previewMinutes % 60}m</div></div>
            <div className="totals-cell">
              <div className="label">Fee due</div>
              <div className="value">{ZERO_FEE_METHODS.has(paymentMethod) ? "No charge" : money(displayedFee)}</div>
            </div>
          </div>
        </div>

        <div className="field">
          <label>Payment method</label>
          {enabledMethods.length === 0 ? (
            <p style={{ color: "var(--red)", fontSize: 13 }}>
              No payment methods are set up for this garage yet. Ask your Admin to configure them in the Garages tab.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {enabledMethods.map((m) => (
                <button
                  key={m.method}
                  type="button"
                  onClick={() => { setPaymentMethod(m.method); setVoucherCode(""); setVoucherStatus(null); setVoucherPhotoUrl(null); }}
                  style={{
                    padding: "10px 16px", borderRadius: 8, fontSize: 14, cursor: "pointer",
                    background: paymentMethod === m.method ? "var(--brass)" : "var(--navy-2)",
                    color: paymentMethod === m.method ? "var(--navy)" : "var(--cream)",
                    border: paymentMethod === m.method ? "none" : "1px solid var(--line)",
                    fontWeight: paymentMethod === m.method ? 700 : 400,
                  }}
                >
                  {METHOD_LABELS[m.method] || m.method}
                </button>
              ))}
            </div>
          )}
        </div>

        {paymentMethod === "NC" && (
          <div className="field">
            <label>N/C Voucher code (optional)</label>

            {/* Row 1: manual code entry + validate */}
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input
                value={voucherCode}
                onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherStatus(null); }}
                placeholder="Enter voucher code manually"
                style={{ fontFamily: "monospace", letterSpacing: "0.05em", flex: 1 }}
                maxLength={20}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "auto", padding: "0 14px", flexShrink: 0 }}
                disabled={!voucherCode.trim()}
                onClick={async () => {
                  const res = await fetch(`/api/vouchers/validate?code=${encodeURIComponent(voucherCode.trim())}&garageId=${ticket.garageId}`);
                  const data = await res.json();
                  setVoucherStatus(data);
                }}
              >
                Validate
              </button>
            </div>

            {/* Row 2: scan from photo (reads QR + saves as audit photo in one step) */}
            <input
              ref={voucherPhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setVoucherPhotoUploading(true);
                setVoucherStatus(null);

                // Convert file to data URL
                const dataUrl = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (ev) => resolve(ev.target.result);
                  reader.readAsDataURL(file);
                });

                // Step 1: read QR code from the photo
                try {
                  const { default: jsQR } = await import("jsqr");
                  const img = await new Promise((resolve, reject) => {
                    const i = new Image();
                    i.onload = () => resolve(i);
                    i.onerror = reject;
                    i.src = dataUrl;
                  });

                  // Try at different scales to improve detection
                  let result = null;
                  for (const scale of [1, 0.5, 0.25]) {
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    result = jsQR(imageData.data, imageData.width, imageData.height, {
                      inversionAttempts: "attemptBoth",
                    });
                    if (result?.data) break;
                  }

                  if (result?.data) {
                    const code = result.data.trim().toUpperCase();
                    setVoucherCode(code);
                    const vRes = await fetch(`/api/vouchers/validate?code=${encodeURIComponent(code)}&garageId=${ticket.garageId}`);
                    setVoucherStatus(await vRes.json());
                  } else {
                    setVoucherStatus({ valid: false, error: "No QR code found in photo. Make sure the full QR code is visible and in focus, or enter the code manually above." });
                  }
                } catch (err) {
                  console.error("QR read error:", err);
                  setVoucherStatus({ valid: false, error: "Couldn't process the photo. Try again or enter the code manually." });
                }

                // Step 2: upload photo to Blob for audit
                try {
                  const res = await fetch("/api/tickets/upload-photo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageBase64: dataUrl }),
                  });
                  const data = await res.json();
                  if (data.url) setVoucherPhotoUrl(data.url);
                } catch {}

                setVoucherPhotoUploading(false);
              }}
            />

            {voucherPhotoUrl ? (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <img src={voucherPhotoUrl} alt="Voucher" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8 }} />
                <button
                  type="button"
                  onClick={() => { setVoucherPhotoUrl(null); setVoucherCode(""); setVoucherStatus(null); }}
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.65)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
                >
                  Retake
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: "100%", marginBottom: 8 }}
                onClick={() => voucherPhotoInputRef.current?.click()}
                disabled={voucherPhotoUploading}
              >
                {voucherPhotoUploading ? "Processing..." : "📷 Take photo of voucher — scans QR & saves for audit"}
              </button>
            )}

            {/* Live camera as fallback */}
            {!voucherPhotoUrl && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: "100%", marginBottom: 8, fontSize: 12 }}
                onClick={() => voucherCameraOpen ? closeVoucherCamera() : openVoucherCamera()}
              >
                {voucherCameraOpen ? "✕ Close camera" : "🔍 Live camera scan instead"}
              </button>
            )}

            {voucherCameraOpen && (
              <div style={{ marginBottom: 8, position: "relative" }}>
                <video ref={voucherVideoRef} style={{ width: "100%", borderRadius: 8, background: "#000" }} playsInline muted />
                <button
                  onClick={closeVoucherCamera}
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}
                >
                  ✕ Close
                </button>
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--slate2)", marginTop: 4 }}>
                  Point camera at voucher QR code
                </div>
              </div>
            )}

            {/* Validation result */}
            {voucherStatus && (
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: voucherStatus.valid ? "var(--green)" : "var(--red)" }}>
                {voucherStatus.valid ? "✓ Valid voucher — parking will be N/C" : `✗ ${voucherStatus.error}`}
              </div>
            )}

            <div className="field-hint">Leave blank to proceed as N/C without a voucher.</div>
          </div>
        )}

        <div className="field">
          <label>Payment note (optional)</label>
          <input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g. last 4 digits, terminal reference" />
        </div>

        {paymentMethod === "CREDIT_CARD" ? (
          <button className="btn btn-primary" disabled={!paymentMethod} onClick={launchSquarePOS}>
            💳 Charge card — {money(displayedFee)}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={completing || !paymentMethod} onClick={completeCheckout}>
            {completing
              ? "Processing..."
              : ZERO_FEE_METHODS.has(paymentMethod)
              ? "Complete checkout — No charge"
              : `Complete checkout — ${money(displayedFee)}`}
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => setTicket(null)} disabled={completing}>
          Cancel
        </button>
      </>
    );
  }

  return (
    <>
      <div className="hero-line">Customer departing</div>
      <h1 className="title">Check Out a Vehicle</h1>
      {error && <div className="error-box">{error}</div>}

      {cameraOpen && (
        <div className="card" style={{ textAlign: "center" }}>
          {cameraError && <div className="error-box">{cameraError}</div>}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", borderRadius: 10, background: "#000" }}
          />
          <p style={{ fontSize: 12, color: "var(--slate2)", marginTop: 8 }}>
            Point the camera at the ticket's QR code — it'll scan automatically.
          </p>
          <button className="btn btn-ghost" onClick={closeCamera}>
            Cancel scanning
          </button>
        </div>
      )}

      <button className="btn btn-primary" onClick={openCamera} disabled={cameraOpen} style={{ marginBottom: 14 }}>
        📷 Scan with Camera
      </button>

      <form onSubmit={lookup}>
        <div className="field">
          <label>Or scan with a handheld scanner, or type ticket number</label>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Scan here or type e.g. 0042"
          />
          <div className="field-hint">A handheld scanner will fill this in automatically and submit — no need to press Enter yourself.</div>
        </div>
        <button className="btn btn-primary" type="submit">Look up ticket</button>
      </form>
    </>
  );
}

// ---------------- ACTIVE TICKETS ----------------
// Prints via a hidden iframe on the same page, rather than window.open().
// window.open() proved unreliable on some Android browsers/WebViews — the
// popup can get detached from this page's JS after an await, leaving it
// stuck showing whatever placeholder was written first. An iframe stays in
// this page's own context the whole time, so it doesn't have that problem.
function printHtmlViaIframe(html) {
  let iframe = document.getElementById("__ir_print_iframe");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "__ir_print_iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
  }
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };
}

async function printTicketInPopup(ticket) {
  // Generate QR code server-side so it works reliably in the print output.
  let qrSrc = "";
  const qrToken = ticket.qrToken || ticket.ticketNumber;
  try {
    const res = await fetch(`/api/qr?token=${encodeURIComponent(qrToken)}`);
    const data = await res.json();
    if (data.dataUrl) qrSrc = data.dataUrl;
  } catch {}

  const checkIn = new Date(ticket.checkInTime).toLocaleString();
  const veh = [ticket.vehicleColor, ticket.vehicleMake, ticket.vehicleModel].filter(Boolean).join(" ");

  function copy(label) {
    return `
      <div style="font-family:Courier New,monospace;font-size:18px;width:80mm;padding:4mm;color:#000;">
        <div style="text-align:center;font-size:30px;font-weight:700;">${ticket.garage?.name || "Garage"}</div>
        <div style="text-align:center;font-size:17px;font-weight:600;">${label}</div>
        <div style="border-top:2px dashed #000;margin:10px 0;"></div>
        <div style="text-align:center;font-size:32px;font-weight:700;">#${ticket.ticketNumber}</div>
        ${qrSrc ? `<div style="text-align:center;"><img src="${qrSrc}" style="width:140px;height:140px;"/></div>` : ""}
        <div style="border-top:2px dashed #000;margin:10px 0;"></div>
        <div style="display:flex;justify-content:space-between;margin:6px 0;"><span style="font-weight:600;">Checked in</span><span>${checkIn}</span></div>
        ${ticket.apartmentNumber ? `<div style="display:flex;justify-content:space-between;margin:6px 0;"><span style="font-weight:600;">Unit</span><span>${ticket.apartmentNumber}</span></div>` : ""}
        ${ticket.licensePlate ? `<div style="display:flex;justify-content:space-between;margin:6px 0;"><span style="font-weight:600;">Plate</span><span>${ticket.licensePlate}</span></div>` : ""}
        ${veh ? `<div style="display:flex;justify-content:space-between;margin:6px 0;"><span style="font-weight:600;">Vehicle</span><span>${veh}</span></div>` : ""}
        ${ticket.parkingLocation ? `<div style="display:flex;justify-content:space-between;margin:6px 0;"><span style="font-weight:600;">Location</span><span>${ticket.parkingLocation}</span></div>` : ""}
        ${ticket.photoUrl ? `<div style="text-align:center;margin-top:4mm;"><img src="${ticket.photoUrl}" style="width:100%;max-height:60mm;object-fit:cover;"/></div>` : ""}
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html><html><head>
    <title>Ticket #${ticket.ticketNumber}</title>
    <style>
      @media print { @page { margin: 0; } body { margin: 0; } }
      body { margin: 0; background: #fff; }
    </style>
    </head><body>
      ${copy("CUSTOMER COPY")}
      <div style="text-align:center;border-top:2px dashed #000;padding:4mm 0;font-size:12px;letter-spacing:0.1em;">✂ CUT HERE</div>
      ${copy("GARAGE COPY")}
    </body></html>
  `;
  printHtmlViaIframe(html);
}

function ReprintTicket({ ticket }) { return null; }



function ActiveTicketsView() {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/tickets?status=PARKED");
    if (res.ok) setTickets(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function cancelTicket(id) {
    setError("");
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    load();
  }

  function handleReprint(t) {
    printTicketInPopup(t);
  }

  return (
    <>
      <div className="queue-header">
        <h1 className="title" style={{ marginBottom: 2 }}>Active Tickets</h1>
        <span className="count-badge">{tickets.length} parked</span>
      </div>
      {error && <div className="error-box">{error}</div>}
      {tickets.length === 0 ? (
        <div className="empty-state">
          <div className="big">No vehicles currently parked</div>
          Checked-in vehicles will show up here until checkout.
        </div>
      ) : (
        tickets.map((t) => (
          <div key={t.id} className="list-row" style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>#{t.ticketNumber}</div>
                <div style={{ fontSize: 12, color: "var(--slate2)" }}>
                  {[t.vehicleColor, t.vehicleMake, t.vehicleModel].filter(Boolean).join(" ") || "No vehicle details"}
                  {t.licensePlate ? ` · ${t.licensePlate}` : ""}
                </div>
                <div style={{ fontSize: 11, color: "var(--slate2)" }}>
                  Checked in {new Date(t.checkInTime).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  style={{ background: "none", border: "none", color: "var(--brass-light)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
                  onClick={() => handleReprint(t)}
                >
                  Reprint
                </button>
                <button
                  className="role-tag"
                  style={{ background: "none", cursor: "pointer", color: "var(--red)", height: "fit-content" }}
                  onClick={() => { if (window.confirm(`Cancel ticket #${t.ticketNumber}?`)) cancelTicket(t.id); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}

// ---------------- TICKET HISTORY (Garage Manager / Admin) ----------------
function TicketHistoryView({ user, showGarageFilter, logoUrl, companyName }) {
  const [tickets, setTickets] = useState([]);
  const [garages, setGarages] = useState([]);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [garageFilter, setGarageFilter] = useState("");
  const [viewing, setViewing] = useState(null);
  const [viewingVoucher, setViewingVoucher] = useState(null);
  const [voucherQr, setVoucherQr] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState([]); // multi-select

  const ALL_CATEGORIES = [
    { value: "CASH", label: "Cash" },
    { value: "CREDIT_CARD", label: "Credit Card" },
    { value: "COUPON", label: "Coupon" },
    { value: "CHARGE_BACK", label: "Charge Back" },
    { value: "NC", label: "N/C" },
    { value: "LOANER", label: "Loaner" },
  ];

  function toggleCategory(val) {
    setCategoryFilter(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    );
  }

  // Apply category filter client-side after fetching
  const filteredTickets = categoryFilter.length === 0
    ? tickets
    : tickets.filter(t => categoryFilter.includes(t.paymentMethod));

  // Load voucher info when viewing an N/C ticket
  useEffect(() => {
    setViewingVoucher(null);
    setVoucherQr(null);
    if (viewing?.paymentMethod === "NC") {
      fetch(`/api/vouchers?ticketId=${viewing.id}`)
        .then(r => r.json())
        .then(async (data) => {
          if (data?.length > 0) {
            const v = data[0];
            setViewingVoucher(v);
            // Generate QR code for the voucher
            try {
              const qrRes = await fetch(`/api/qr?token=${encodeURIComponent(v.code)}`);
              const qrData = await qrRes.json();
              if (qrData.dataUrl) setVoucherQr(qrData.dataUrl);
            } catch {}
          }
        }).catch(() => {});
    }
  }, [viewing]);

  function handleReprint(t) {
    printTicketInPopup(t);
  }

  const loadGarages = useCallback(async () => {
    if (!showGarageFilter) return;
    const res = await fetch("/api/garages");
    if (res.ok) setGarages(await res.json());
  }, [showGarageFilter]);

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (showGarageFilter && garageFilter) params.set("garageId", garageFilter);
    const res = await fetch(`/api/tickets?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setTickets(data);
  }, [fromDate, toDate, search, statusFilter, garageFilter, showGarageFilter]);

  useEffect(() => { loadGarages(); }, [loadGarages]);
  useEffect(() => { load(); }, [load]);

  const STATUS_LABELS = { PARKED: "Parked", COMPLETED: "Completed", CANCELLED: "Cancelled" };
  const METHOD_LABELS = {
    CASH: "Cash", CREDIT_CARD: "Credit Card", COUPON: "Coupon",
    CHARGE_BACK: "Charge Back", NC: "N/C", LOANER: "Loaner",
  };

  if (viewing) {
    return (
      <>
        <div className="hero-line">Ticket #{viewing.ticketNumber}</div>
        <h1 className="title">{viewing.garage?.name}</h1>
        <div className="card">
          {viewing.photoUrl && (
            <img src={viewing.photoUrl} alt="Vehicle" style={{ width: "100%", borderRadius: 8, marginBottom: 14, maxHeight: 220, objectFit: "cover" }} />
          )}
          <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
            <span style={{ color: "var(--slate2)" }}>Status</span>
            <span className={`status-tag status-${viewing.status === "COMPLETED" ? "SUBMITTED" : "DRAFT"}`}>
              {STATUS_LABELS[viewing.status]}
            </span>
          </div>
          <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
            <span style={{ color: "var(--slate2)" }}>Checked in</span>
            <span>{new Date(viewing.checkInTime).toLocaleString()}</span>
          </div>
          {viewing.checkOutTime && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Checked out</span>
              <span>{new Date(viewing.checkOutTime).toLocaleString()}</span>
            </div>
          )}
          {viewing.apartmentNumber && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Unit</span><span>{viewing.apartmentNumber}</span>
            </div>
          )}
          {(viewing.vehicleMake || viewing.licensePlate) && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Vehicle</span>
              <span>{[viewing.vehicleColor, viewing.vehicleMake, viewing.vehicleModel].filter(Boolean).join(" ")}{viewing.licensePlate ? ` · ${viewing.licensePlate}` : ""}</span>
            </div>
          )}
          {viewing.parkingLocation && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Location</span><span>{viewing.parkingLocation}</span>
            </div>
          )}
          {viewing.checkedInBy && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Checked in by</span><span>{viewing.checkedInBy.name}</span>
            </div>
          )}
          {viewing.checkedOutBy && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Checked out by</span><span>{viewing.checkedOutBy.name}</span>
            </div>
          )}
          {viewing.status === "COMPLETED" && (
            <div className="totals-grid" style={{ marginTop: 12 }}>
              <div className="totals-cell"><div className="label">Duration</div><div className="value" style={{ fontSize: 16 }}>{viewing.durationMinutes ? `${Math.floor(viewing.durationMinutes/60)}h ${viewing.durationMinutes%60}m` : "—"}</div></div>
              <div className="totals-cell"><div className="label">Payment</div><div className="value" style={{ fontSize: 16 }}>{METHOD_LABELS[viewing.paymentMethod] || viewing.paymentMethod}</div></div>
              <div className="totals-cell"><div className="label">Amount</div><div className="value">{["NC","LOANER"].includes(viewing.paymentMethod) ? "No charge" : money(viewing.feeAmount)}</div></div>
            </div>
          )}
          {viewing.paymentNote && (
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--slate2)" }}>Note: {viewing.paymentNote}</p>
          )}

          {/* Voucher audit section — shown when ticket was paid with a tracked N/C voucher */}
          {viewing.paymentMethod === "NC" && viewingVoucher && (
            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 10 }}>
                N/C Voucher Used
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                {voucherQr && (
                  <img src={voucherQr} alt="Voucher QR" style={{ width: 90, height: 90, flexShrink: 0, borderRadius: 6 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 4 }}>
                    {viewingVoucher.code}
                  </div>
                  {viewingVoucher.note && (
                    <div style={{ fontSize: 12, color: "var(--slate2)", marginBottom: 4 }}>{viewingVoucher.note}</div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--slate2)" }}>
                    Issued by: {viewingVoucher.createdBy?.name || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--slate2)" }}>
                    Used: {new Date(viewingVoucher.usedAt).toLocaleString()}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 8px", borderRadius: 10, background: "var(--green)", color: "var(--navy)" }}>
                      VERIFIED USED
                    </span>
                  </div>
                </div>
              </div>
              {viewingVoucher.voucherPhotoUrl && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--slate2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Voucher photo
                  </div>
                  <img
                    src={viewingVoucher.voucherPhotoUrl}
                    alt="Voucher photo"
                    style={{ width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 8, background: "var(--navy-2)" }}
                  />
                </div>
              )}
            </div>
          )}

          {viewing.paymentMethod === "NC" && !viewingVoucher && viewing.status === "COMPLETED" && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--slate2)", fontStyle: "italic" }}>
              No voucher was linked to this N/C ticket.
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => handleReprint(viewing)} style={{ marginBottom: 10 }}>
          Reprint ticket
        </button>
        <button className="btn btn-ghost" onClick={() => setViewing(null)}>Back</button>
      </>
    );
  }

  return (
    <>
      <div className="queue-header">
        <h1 className="title" style={{ marginBottom: 2 }}>Ticket History</h1>
        <span className="count-badge">{tickets.length} tickets</span>
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>Search — ticket #, plate, unit, make, or model</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. 42 or 8XJ-201" />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label>From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label>To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="PARKED">Parked</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        {showGarageFilter && (
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Garage</label>
            <select value={garageFilter} onChange={(e) => setGarageFilter(e.target.value)}>
              <option value="">All garages</option>
              {garages.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Multi-select category filter */}
      <div className="field">
        <label>
          Category
          {categoryFilter.length > 0 && (
            <button
              onClick={() => setCategoryFilter([])}
              style={{ marginLeft: 10, background: "none", border: "none", color: "var(--brass-light)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
            >
              Clear
            </button>
          )}
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {ALL_CATEGORIES.map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => toggleCategory(cat.value)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                background: categoryFilter.includes(cat.value) ? "var(--brass)" : "var(--navy-2)",
                color: categoryFilter.includes(cat.value) ? "var(--navy)" : "var(--cream)",
                border: categoryFilter.includes(cat.value) ? "none" : "1px solid var(--line)",
                fontWeight: categoryFilter.includes(cat.value) ? 700 : 400,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {categoryFilter.length > 0 && (
          <div className="field-hint">{filteredTickets.length} of {tickets.length} tickets match selected categories</div>
        )}
      </div>

      <DownloadTicketListButton
        title="Ticket History"
        dateLabel={fromDate || toDate ? `${fromDate || "Any"} to ${toDate || "Any"}` : "All dates"}
        garageLabel={showGarageFilter ? (garages.find(g => g.id === garageFilter)?.name || "All garages") : undefined}
        tickets={filteredTickets}
        showGarageColumn={showGarageFilter}
        logoUrl={logoUrl}
        companyName={companyName}
      />

      {filteredTickets.length === 0 ? (
        <div className="empty-state">
          <div className="big">No tickets match this search</div>
        </div>
      ) : (
        filteredTickets.map((t) => (
          <div key={t.id} className="list-row" onClick={() => setViewing(t)} style={{ cursor: "pointer", display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  #{t.ticketNumber}
                  {showGarageFilter && <span style={{ fontSize: 12, color: "var(--slate2)", fontWeight: 400 }}> · {t.garage?.name}</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--slate2)" }}>
                  {[t.vehicleColor, t.vehicleMake, t.vehicleModel].filter(Boolean).join(" ") || "No vehicle details"}
                  {t.licensePlate ? ` · ${t.licensePlate}` : ""}
                </div>
                <div style={{ fontSize: 11, color: "var(--slate2)" }}>
                  {new Date(t.checkInTime).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {t.status === "COMPLETED" && (
                  <div style={{ fontFamily: "Oswald, sans-serif", color: "var(--brass-light)", fontSize: 15 }}>
                    {["NC","LOANER"].includes(t.paymentMethod) ? "No charge" : money(t.feeAmount)}
                  </div>
                )}
                <span className={`status-tag status-${t.status === "COMPLETED" ? "SUBMITTED" : "DRAFT"}`} style={t.status === "CANCELLED" ? { borderColor: "var(--red)", color: "var(--red)" } : {}}>
                  {STATUS_LABELS[t.status]}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}

// ---------------- DAILY CLOSED TICKETS (Garage Manager / Admin) ----------------
function DailyClosedView({ user, showGarageFilter, logoUrl, companyName }) {
  const [tickets, setTickets] = useState([]);
  const [garages, setGarages] = useState([]);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("single"); // "single" | "range"
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [rangeFrom, setRangeFrom] = useState(todayStr());
  const [rangeTo, setRangeTo] = useState(todayStr());
  const [garageFilter, setGarageFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewing, setViewing] = useState(null);

  const METHOD_LABELS = {
    CASH: "Cash", CREDIT_CARD: "Credit Card", COUPON: "Coupon",
    CHARGE_BACK: "Charge Back", NC: "N/C", LOANER: "Loaner",
  };
  const ZERO_FEE = new Set(["NC", "LOANER"]);

  const loadGarages = useCallback(async () => {
    if (!showGarageFilter) return;
    const res = await fetch("/api/garages");
    if (res.ok) setGarages(await res.json());
  }, [showGarageFilter]);

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    if (mode === "single") {
      params.set("from", selectedDate);
      params.set("to", selectedDate);
    } else {
      params.set("from", rangeFrom);
      params.set("to", rangeTo);
    }
    params.set("status", "COMPLETED");
    if (showGarageFilter && garageFilter) params.set("garageId", garageFilter);
    const res = await fetch(`/api/tickets?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setTickets(data);
  }, [mode, selectedDate, rangeFrom, rangeTo, garageFilter, showGarageFilter]);

  useEffect(() => { loadGarages(); }, [loadGarages]);
  useEffect(() => { load(); }, [load]);

  // Apply the category filter client-side, on top of the server-side date/garage/status filters.
  const filteredTickets = categoryFilter
    ? tickets.filter((t) => (t.paymentMethod || "OTHER") === categoryFilter)
    : tickets;

  // Running total broken down by category — N/C and Loaner are counted, not summed in dollars.
  // Counts (of tickets) are tracked for every category, dollar totals only for the paid ones.
  const totalsByMethod = {};
  const countsByMethod = {};
  let grandTotal = 0;
  tickets.forEach((t) => {
    const key = t.paymentMethod || "OTHER";
    countsByMethod[key] = (countsByMethod[key] || 0) + 1;
    if (ZERO_FEE.has(key)) {
      totalsByMethod[key] = (totalsByMethod[key] || 0) + 1;
    } else {
      totalsByMethod[key] = (totalsByMethod[key] || 0) + (t.feeAmount || 0);
      grandTotal += t.feeAmount || 0;
    }
  });

  function shiftDay(delta) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  }

  const reportLabel = mode === "single" ? selectedDate : `${rangeFrom} to ${rangeTo}`;

  if (viewing) {
    return (
      <>
        <div className="hero-line">Ticket #{viewing.ticketNumber}</div>
        <h1 className="title">{viewing.garage?.name}</h1>
        <div className="card">
          {viewing.photoUrl && (
            <img src={viewing.photoUrl} alt="Vehicle" style={{ width: "100%", borderRadius: 8, marginBottom: 14, maxHeight: 220, objectFit: "cover" }} />
          )}
          <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
            <span style={{ color: "var(--slate2)" }}>Checked in</span>
            <span>{new Date(viewing.checkInTime).toLocaleString()}</span>
          </div>
          <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
            <span style={{ color: "var(--slate2)" }}>Checked out</span>
            <span>{new Date(viewing.checkOutTime).toLocaleString()}</span>
          </div>
          {viewing.apartmentNumber && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Unit</span><span>{viewing.apartmentNumber}</span>
            </div>
          )}
          {(viewing.vehicleMake || viewing.licensePlate) && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Vehicle</span>
              <span>{[viewing.vehicleColor, viewing.vehicleMake, viewing.vehicleModel].filter(Boolean).join(" ")}{viewing.licensePlate ? ` · ${viewing.licensePlate}` : ""}</span>
            </div>
          )}
          {viewing.checkedInBy && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Checked in by</span><span>{viewing.checkedInBy.name}</span>
            </div>
          )}
          {viewing.checkedOutBy && (
            <div className="list-row" style={{ borderBottom: "none", padding: "4px 0" }}>
              <span style={{ color: "var(--slate2)" }}>Checked out by</span><span>{viewing.checkedOutBy.name}</span>
            </div>
          )}
          <div className="totals-grid" style={{ marginTop: 12 }}>
            <div className="totals-cell"><div className="label">Duration</div><div className="value" style={{ fontSize: 16 }}>{viewing.durationMinutes ? `${Math.floor(viewing.durationMinutes/60)}h ${viewing.durationMinutes%60}m` : "—"}</div></div>
            <div className="totals-cell"><div className="label">Payment</div><div className="value" style={{ fontSize: 16 }}>{METHOD_LABELS[viewing.paymentMethod] || viewing.paymentMethod}</div></div>
            <div className="totals-cell"><div className="label">Amount</div><div className="value">{ZERO_FEE.has(viewing.paymentMethod) ? "No charge" : money(viewing.feeAmount)}</div></div>
          </div>
          {viewing.paymentNote && (
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--slate2)" }}>Note: {viewing.paymentNote}</p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => handleReprint(viewing)} style={{ marginBottom: 10 }}>
          Reprint ticket
        </button>
        <button className="btn btn-ghost" onClick={() => setViewing(null)}>Back</button>
      </>
    );
  }

  return (
    <>
      <div className="queue-header">
        <h1 className="title" style={{ marginBottom: 2 }}>Daily Closed Tickets</h1>
        <span className="count-badge">{filteredTickets.length} tickets</span>
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>Single day</button>
        <button className={mode === "range" ? "active" : ""} onClick={() => setMode("range")}>Date range</button>
      </div>

      {mode === "single" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button className="btn btn-ghost" style={{ width: "auto", padding: "13px 16px", marginTop: 0 }} onClick={() => shiftDay(-1)}>←</button>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Date</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <button className="btn btn-ghost" style={{ width: "auto", padding: "13px 16px", marginTop: 0 }} onClick={() => shiftDay(1)}>→</button>
          {selectedDate !== todayStr() && (
            <button className="btn btn-ghost" style={{ width: "auto", padding: "13px 16px", marginTop: 0 }} onClick={() => setSelectedDate(todayStr())}>Today</button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>From</label>
            <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>To</label>
            <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {showGarageFilter && (
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Garage</label>
            <select value={garageFilter} onChange={(e) => setGarageFilter(e.target.value)}>
              <option value="">All garages</option>
              {garages.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label>Category</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {Object.keys(METHOD_LABELS).map((key) => (
              <option key={key} value={key}>{METHOD_LABELS[key]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 10 }}>
          Totals for {reportLabel}
        </div>
        {tickets.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--slate2)" }}>No tickets closed on this date.</p>
        ) : (
          <>
            <div className="totals-grid">
              {Object.entries(totalsByMethod).map(([method, value]) => (
                <div key={method} className="totals-cell">
                  <div className="label">{METHOD_LABELS[method] || method}</div>
                  <div className="value" style={{ fontSize: 18 }}>
                    {ZERO_FEE.has(method) ? `${value} tickets` : money(value)}
                  </div>
                  {!ZERO_FEE.has(method) && (
                    <div className="field-hint" style={{ marginTop: 2 }}>{countsByMethod[method]} ticket{countsByMethod[method] === 1 ? "" : "s"}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="totals-cell" style={{ marginTop: 10 }}>
              <div className="label">Running Total</div>
              <div className="value" style={{ fontSize: 26 }}>{money(grandTotal)}</div>
              <div className="field-hint" style={{ marginTop: 2 }}>{tickets.length} ticket{tickets.length === 1 ? "" : "s"} total</div>
            </div>
          </>
        )}
      </div>

      <DownloadTicketListButton
        title="Daily Closed Tickets"
        dateLabel={reportLabel}
        garageLabel={showGarageFilter ? (garages.find(g => g.id === garageFilter)?.name || "All garages") : undefined}
        tickets={filteredTickets}
        showGarageColumn={showGarageFilter}
        logoUrl={logoUrl}
        companyName={companyName}
      />

      {filteredTickets.length === 0 && tickets.length > 0 ? (
        <div className="empty-state">
          <div className="big">No tickets in this category</div>
        </div>
      ) : (
        filteredTickets.map((t) => (
          <div key={t.id} className="list-row" onClick={() => setViewing(t)} style={{ cursor: "pointer", display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  #{t.ticketNumber}
                  {showGarageFilter && <span style={{ fontSize: 12, color: "var(--slate2)", fontWeight: 400 }}> · {t.garage?.name}</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--slate2)" }}>
                  {[t.vehicleColor, t.vehicleMake, t.vehicleModel].filter(Boolean).join(" ") || "No vehicle details"}
                  {t.licensePlate ? ` · ${t.licensePlate}` : ""}
                </div>
                <div style={{ fontSize: 11, color: "var(--slate2)" }}>
                  Closed {new Date(t.checkOutTime).toLocaleTimeString()} · {METHOD_LABELS[t.paymentMethod] || t.paymentMethod}
                </div>
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", color: "var(--brass-light)", fontSize: 15 }}>
                {ZERO_FEE.has(t.paymentMethod) ? "No charge" : money(t.feeAmount)}
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}

function ShiftReportForm({ existing, onSaved, onCancel, readOnly }) {
  const [shiftDate, setShiftDate] = useState(existing?.shiftDate || todayStr());
  const [startTime, setStartTime] = useState(existing?.startTime || "");
  const [endTime, setEndTime] = useState(existing?.endTime || "");
  const [couponRevenue, setCouponRevenue] = useState(existing?.couponRevenue ?? "");
  const [cashRevenue, setCashRevenue] = useState(existing?.cashRevenue ?? "");
  const [creditCardRevenue, setCreditCardRevenue] = useState(existing?.creditCardRevenue ?? "");
  const [chargeBackRevenue, setChargeBackRevenue] = useState(existing?.chargeBackRevenue ?? "");
  const [otherRevenue, setOtherRevenue] = useState(existing?.otherRevenue ?? "");
  const [otherDescription, setOtherDescription] = useState(existing?.otherDescription || "");
  const [adjustments, setAdjustments] = useState(existing?.adjustments ?? "");
  const [adjustmentsNote, setAdjustmentsNote] = useState(existing?.adjustmentsNote || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [shiftTemplates, setShiftTemplates] = useState([]);

  // Load shift templates for this garage so the employee can select one.
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.user?.garageId) {
          fetch(`/api/garages/${d.user.garageId}/shift-templates`)
            .then(r => r.json())
            .then(templates => { if (Array.isArray(templates)) setShiftTemplates(templates); });
        }
      });
  }, []);

  function applyTemplate(templateId) {
    if (!templateId) return;
    const t = shiftTemplates.find(t => t.id === templateId);
    if (t) { setStartTime(t.startTime); setEndTime(t.endTime); }
  }

  const ncTickets = existing?.tickets?.filter(t => t.paymentMethod === "NC") || [];
  const loanerTickets = existing?.tickets?.filter(t => t.paymentMethod === "LOANER") || [];
  const allTickets = existing?.tickets || [];

  // Group tickets by payment method for the total processed section.
  const ticketGroups = allTickets.reduce((acc, t) => {
    const key = t.paymentMethod || "UNKNOWN";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const METHOD_LABELS_SHORT = {
    CASH: "Cash", CREDIT_CARD: "Credit Card", COUPON: "Coupon",
    CHARGE_BACK: "Charge Back", NC: "N/C", LOANER: "Loaner",
  };

  const cash = parseFloat(cashRevenue) || 0;
  const credit = parseFloat(creditCardRevenue) || 0;
  const coupon = parseFloat(couponRevenue) || 0;
  const chargeBack = parseFloat(chargeBackRevenue) || 0;
  const other = parseFloat(otherRevenue) || 0;
  const adj = parseFloat(adjustments) || 0;
  const gross = cash + credit + coupon + chargeBack + other;
  const net = gross - adj;

  // A helper to render a revenue field — read-only display for employees,
  // editable input for Garage Managers and Admins.
  function RevenueField({ label, value, onChange, hint }) {
    if (readOnly) {
      return (
        <div className="totals-cell" style={{ marginBottom: 10 }}>
          <div className="label">{label}</div>
          <div className="value" style={{ fontSize: 20 }}>{money(parseFloat(value) || 0)}</div>
          {hint && <div className="field-hint">{hint}</div>}
        </div>
      );
    }
    return (
      <div className="field">
        <label>{label}</label>
        <input type="number" step="0.01" min="0" value={value} onChange={e => onChange(e.target.value)} placeholder="0.00" />
        {hint && <div className="field-hint">{hint}</div>}
      </div>
    );
  }

  async function save(submit) {
    setError("");
    setSaving(true);
    const body = {
      shiftDate, startTime, endTime,
      cashRevenue: cash, creditCardRevenue: credit,
      couponRevenue: coupon, chargeBackRevenue: chargeBack,
      otherRevenue: other, otherDescription,
      adjustments: adj, adjustmentsNote, notes, submit,
    };
    const url = existing ? `/api/shift-reports/${existing.id}` : "/api/shift-reports";
    const method = existing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    onSaved();
  }

  return (
    <div className="card">
      {error && <div className="error-box">{error}</div>}

      {readOnly && (
        <div style={{ background: "rgba(201,162,39,0.1)", border: "1px solid var(--brass)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "var(--brass-light)" }}>
          Revenue totals are automatically calculated from ticket checkouts and cannot be manually edited.
        </div>
      )}

      <div className="field">
        <label>Shift date</label>
        <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} required disabled={readOnly} />
      </div>

      {shiftTemplates.length > 0 && !readOnly && (
        <div className="field">
          <label>Select shift (auto-fills times)</label>
          <select
            defaultValue=""
            onChange={(e) => applyTemplate(e.target.value)}
            style={{ background: "var(--navy-2)", border: "1px solid var(--line)", color: "var(--cream)", padding: "13px 14px", borderRadius: 8, fontSize: 16, width: "100%" }}
          >
            <option value="" disabled>Choose a shift…</option>
            {shiftTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.startTime} – {t.endTime})</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Start time</label>
          <input type="text" placeholder="e.g. 7:00 AM" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={readOnly} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>End time</label>
          <input type="text" placeholder="e.g. 3:00 PM" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={readOnly} />
        </div>
      </div>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", margin: "8px 0 10px" }}>
        Revenue by payment method
      </div>

      {readOnly ? (
        <div className="totals-grid">
          <RevenueField label="Cash" value={cashRevenue} onChange={setCashRevenue} />
          <RevenueField label="Credit Card" value={creditCardRevenue} onChange={setCreditCardRevenue} />
          {coupon > 0 && <RevenueField label="Coupon" value={couponRevenue} onChange={setCouponRevenue} />}
          {chargeBack > 0 && <RevenueField label="Charge Back" value={chargeBackRevenue} onChange={setChargeBackRevenue} />}
          {other > 0 && <RevenueField label="Other" value={otherRevenue} onChange={setOtherRevenue} />}
        </div>
      ) : (
        <>
          <RevenueField label="Cash" value={cashRevenue} onChange={setCashRevenue} />
          <RevenueField label="Credit Card" value={creditCardRevenue} onChange={setCreditCardRevenue} />
          <RevenueField label="Coupon" value={couponRevenue} onChange={setCouponRevenue} />
          <RevenueField label="Charge Back" value={chargeBackRevenue} onChange={setChargeBackRevenue} />
          <RevenueField label="Other revenue" value={otherRevenue} onChange={setOtherRevenue} />
          {other !== 0 && (
            <div className="field">
              <label>Other revenue — description</label>
              <input type="text" value={otherDescription} onChange={(e) => setOtherDescription(e.target.value)} placeholder="What is this from?" />
            </div>
          )}
        </>
      )}

      {/* N/C and Loaner — count display only, never a dollar input */}
      {(ncTickets.length > 0 || loanerTickets.length > 0) && (
        <div className="totals-grid" style={{ marginBottom: 12, marginTop: readOnly ? 10 : 0 }}>
          {ncTickets.length > 0 && (
            <div className="totals-cell">
              <div className="label">N/C tickets</div>
              <div className="value" style={{ fontSize: 18 }}>{ncTickets.length}</div>
              <div className="field-hint" style={{ marginTop: 2 }}>No charge — not counted in revenue</div>
            </div>
          )}
          {loanerTickets.length > 0 && (
            <div className="totals-cell">
              <div className="label">Loaner tickets</div>
              <div className="value" style={{ fontSize: 18 }}>{loanerTickets.length}</div>
              <div className="field-hint" style={{ marginTop: 2 }}>No charge — not counted in revenue</div>
            </div>
          )}
        </div>
      )}

      {/* Total processed tickets */}
      {allTickets.length > 0 && (
        <div style={{ marginBottom: 16, marginTop: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 10 }}>
            Total processed tickets — {allTickets.length}
          </div>
          <div className="totals-grid">
            {Object.entries(ticketGroups).map(([method, count]) => (
              <div key={method} className="totals-cell">
                <div className="label">{METHOD_LABELS_SHORT[method] || method}</div>
                <div className="value" style={{ fontSize: 18 }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          <div className="field">
            <label>Adjustments / discrepancies (subtracted from gross)</label>
            <input type="number" step="0.01" min="0" value={adjustments} onChange={(e) => setAdjustments(e.target.value)} placeholder="0.00" />
            <div className="field-hint">Use this for refunds, cash drawer shortages, or any correction to the gross total.</div>
          </div>
          {adj !== 0 && (
            <div className="field">
              <label>Adjustment note</label>
              <input type="text" value={adjustmentsNote} onChange={(e) => setAdjustmentsNote(e.target.value)} placeholder="Reason for the adjustment" />
            </div>
          )}
        </>
      )}

      <div className="totals-grid">
        <div className="totals-cell">
          <div className="label">Gross total</div>
          <div className="value">{money(gross)}</div>
        </div>
        <div className="totals-cell">
          <div className="label">Net total</div>
          <div className="value">{money(net)}</div>
        </div>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Notes (optional)</label>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} />
      </div>

      {!readOnly && (
        <button className="btn btn-ghost" disabled={saving} onClick={() => save(false)}>
          Save as draft
        </button>
      )}
      <button
        className="btn btn-primary"
        style={{ marginTop: 10 }}
        disabled={saving}
        onClick={() => {
          if (window.confirm("Submit this shift report? Once submitted, it will be locked and can no longer be edited.")) {
            save(true);
          }
        }}
      >
        Submit shift report
      </button>
      {onCancel && (
        <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      )}
    </div>
  );
}

// ---------------- REPORT SUMMARY ROW ----------------
const METHOD_LABELS_DISPLAY = {
  CASH: "Cash", CREDIT_CARD: "Credit Card", COUPON: "Coupon",
  CHARGE_BACK: "Charge Back", NC: "N/C", LOANER: "Loaner",
};

// Zero-fee methods — shown as count only, not dollar amounts.
const ZERO_FEE_METHODS = new Set(["NC", "LOANER"]);

function PrintableShiftReport({ report }) {
  if (!report) return null;
  const allTickets = report.tickets || [];
  const METHOD_LABELS = {
    CASH: "Cash", CREDIT_CARD: "Credit Card", COUPON: "Coupon",
    CHARGE_BACK: "Charge Back", NC: "N/C", LOANER: "Loaner",
  };
  const ZERO_FEE = new Set(["NC", "LOANER"]);
  const groups = {};
  allTickets.forEach((t) => {
    const key = t.paymentMethod || "OTHER";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  return (
    <div className="print-report">
      <div className="pr-header">
        <div className="pr-title">{report.garage?.name || "Integral Revenue"} — Shift Report</div>
        <div className="pr-meta">
          <span><b>Garage:</b> {report.garage?.name}</span>
          <span><b>Employee:</b> {report.employee?.name}</span>
          <span><b>Date:</b> {report.shiftDate}</span>
          {report.startTime && <span><b>Shift:</b> {report.startTime} – {report.endTime || "?"}</span>}
          <span><b>Status:</b> {report.status}</span>
        </div>
      </div>

      <div className="pr-section">
        <div className="pr-section-title">Revenue Summary</div>
        <div className="pr-grid">
          <div className="pr-cell"><div className="label">Cash</div><div className="value">{money(report.cashRevenue)}</div></div>
          <div className="pr-cell"><div className="label">Credit Card</div><div className="value">{money(report.creditCardRevenue)}</div></div>
          {(report.couponRevenue > 0) && <div className="pr-cell"><div className="label">Coupon</div><div className="value">{money(report.couponRevenue)}</div></div>}
          {(report.chargeBackRevenue > 0) && <div className="pr-cell"><div className="label">Charge Back</div><div className="value">{money(report.chargeBackRevenue)}</div></div>}
          {(report.otherRevenue > 0) && <div className="pr-cell"><div className="label">Other</div><div className="value">{money(report.otherRevenue)}</div></div>}
          {allTickets.filter(t => t.paymentMethod === "NC").length > 0 && (
            <div className="pr-cell"><div className="label">N/C Tickets</div><div className="value">{allTickets.filter(t => t.paymentMethod === "NC").length} tickets</div></div>
          )}
          {allTickets.filter(t => t.paymentMethod === "LOANER").length > 0 && (
            <div className="pr-cell"><div className="label">Loaner Tickets</div><div className="value">{allTickets.filter(t => t.paymentMethod === "LOANER").length} tickets</div></div>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="pr-totals-row"><span>Gross Total</span><span>{money(report.grossTotal)}</span></div>
          {(report.adjustments > 0) && <div className="pr-totals-row"><span>Adjustments</span><span>- {money(report.adjustments)}{report.adjustmentsNote ? ` (${report.adjustmentsNote})` : ""}</span></div>}
          <div className="pr-net">Net Total: {money(report.netTotal)}</div>
        </div>
      </div>

      {allTickets.length > 0 && (
        <div className="pr-section">
          <div className="pr-section-title">Ticket Transactions ({allTickets.length} total)</div>
          {Object.entries(groups).map(([method, tickets]) => (
            <div key={method} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>{METHOD_LABELS[method] || method}</div>
              <table className="pr-table">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Unit</th>
                    <th>Vehicle</th>
                    <th>Duration</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td>#{t.ticketNumber}</td>
                      <td>{t.apartmentNumber || "—"}</td>
                      <td>{[t.vehicleColor, t.vehicleMake, t.vehicleModel].filter(Boolean).join(" ") || "—"}{t.licensePlate ? ` · ${t.licensePlate}` : ""}</td>
                      <td>{t.durationMinutes ? `${Math.floor(t.durationMinutes/60)}h ${t.durationMinutes%60}m` : "—"}</td>
                      <td>{ZERO_FEE.has(method) ? "No charge" : money(t.feeAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {report.notes && (
        <div className="pr-section">
          <div className="pr-section-title">Notes</div>
          <p style={{ margin: 0, fontSize: 12 }}>{report.notes}</p>
        </div>
      )}

      <div className="pr-footer">
        <span>{report.garage?.name || "Integral Revenue"}</span>
        <span>Printed {new Date().toLocaleString()}</span>
        {report.submittedAt && <span>Submitted {new Date(report.submittedAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}

function PrintableTicketList({ title, dateLabel, garageLabel, tickets, showGarageColumn, logoUrl, companyName }) {
  if (!tickets) return null;
  const appName = companyName || "Integral Revenue";
  const METHOD_LABELS = {
    CASH: "Cash", CREDIT_CARD: "Credit Card", COUPON: "Coupon",
    CHARGE_BACK: "Charge Back", NC: "N/C", LOANER: "Loaner",
  };
  const ZERO_FEE = new Set(["NC", "LOANER"]);

  // Track both total amount and ticket count per method
  const totalsByMethod = {};
  const countsByMethod = {};
  let grandTotal = 0;
  tickets.forEach((t) => {
    const key = t.paymentMethod || "OTHER";
    countsByMethod[key] = (countsByMethod[key] || 0) + 1;
    if (ZERO_FEE.has(key)) {
      totalsByMethod[key] = (totalsByMethod[key] || 0) + 1;
    } else if (t.status === "COMPLETED") {
      totalsByMethod[key] = (totalsByMethod[key] || 0) + (t.feeAmount || 0);
      grandTotal += t.feeAmount || 0;
    }
  });

  return (
    <div className="print-report">
      <div className="pr-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div className="pr-title">{appName} — {title}</div>
            <div className="pr-meta">
              {garageLabel && <span><b>Garage:</b> {garageLabel}</span>}
              <span><b>Date range:</b> {dateLabel}</span>
              <span><b>Total tickets:</b> {tickets.length}</span>
            </div>
          </div>
          {logoUrl && (
            <img src={logoUrl} alt="Logo" style={{ height: 56, maxWidth: 160, objectFit: "contain" }} />
          )}
        </div>
      </div>

      {Object.keys(totalsByMethod).length > 0 && (
        <div className="pr-section">
          <div className="pr-section-title">Totals by Category</div>
          <div className="pr-grid">
            {Object.entries(totalsByMethod).map(([method, value]) => (
              <div key={method} className="pr-cell">
                <div className="label">{METHOD_LABELS[method] || method}</div>
                <div className="value">{ZERO_FEE.has(method) ? `${value} tickets` : money(value)}</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                  {countsByMethod[method]} ticket{countsByMethod[method] === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>
          <div className="pr-net">Running Total: {money(grandTotal)}</div>
        </div>
      )}

      <div className="pr-section">
        <div className="pr-section-title">Ticket Detail</div>
        <table className="pr-table">
          <thead>
            <tr>
              <th>Ticket #</th>
              {showGarageColumn && <th>Garage</th>}
              <th>Unit</th>
              <th>Vehicle</th>
              <th>Check-In</th>
              <th>Check-Out</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>#{t.ticketNumber}</td>
                {showGarageColumn && <td>{t.garage?.name || "—"}</td>}
                <td>{t.apartmentNumber || "—"}</td>
                <td>{[t.vehicleColor, t.vehicleMake, t.vehicleModel].filter(Boolean).join(" ") || "—"}{t.licensePlate ? ` · ${t.licensePlate}` : ""}</td>
                <td>{new Date(t.checkInTime).toLocaleString()}</td>
                <td>{t.checkOutTime ? new Date(t.checkOutTime).toLocaleString() : "—"}</td>
                <td>{t.status}</td>
                <td>{METHOD_LABELS[t.paymentMethod] || t.paymentMethod || "—"}</td>
                <td>{t.status === "COMPLETED" ? (ZERO_FEE.has(t.paymentMethod) ? "No charge" : money(t.feeAmount)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pr-footer">
        <span>{appName}</span>
        <span>Printed {new Date().toLocaleString()}</span>
      </div>
    </div>
  );
}

function DownloadTicketListButton({ title, dateLabel, garageLabel, tickets, showGarageColumn, logoUrl, companyName }) {
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);

  function handlePrint() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 150);
  }

  async function handleExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const appName = companyName || "Integral Revenue";
      const METHOD_LABELS = {
        CASH: "Cash", CREDIT_CARD: "Credit Card", COUPON: "Coupon",
        CHARGE_BACK: "Charge Back", NC: "N/C", LOANER: "Loaner",
      };
      const ZERO_FEE = new Set(["NC", "LOANER"]);

      // ── Summary sheet ──────────────────────────────────────────
      const summaryRows = [
        [appName + " — " + title],
        [],
        ["Date Range:", dateLabel],
        garageLabel ? ["Garage:", garageLabel] : null,
        ["Total Tickets:", tickets.length],
        ["Generated:", new Date().toLocaleString()],
        [],
        ["TOTALS BY CATEGORY"],
        ["Category", "Amount", "Ticket Count"],
      ].filter(Boolean);

      // Count and total per method
      const totals = {};
      const counts = {};
      let grandTotal = 0;
      tickets.forEach((t) => {
        const key = t.paymentMethod || "OTHER";
        counts[key] = (counts[key] || 0) + 1;
        if (!ZERO_FEE.has(key) && t.status === "COMPLETED") {
          totals[key] = (totals[key] || 0) + (t.feeAmount || 0);
          grandTotal += t.feeAmount || 0;
        } else if (ZERO_FEE.has(key)) {
          totals[key] = 0;
        }
      });

      Object.entries(totals).forEach(([method, amount]) => {
        summaryRows.push([
          METHOD_LABELS[method] || method,
          ZERO_FEE.has(method) ? "No charge" : amount,
          counts[method],
        ]);
      });

      summaryRows.push([]);
      summaryRows.push(["Running Total:", grandTotal]);

      // ── Detail sheet ───────────────────────────────────────────
      const headers = [
        "Ticket #", ...(showGarageColumn ? ["Garage"] : []),
        "Unit", "Vehicle", "Plate",
        "Check-In", "Check-Out", "Duration",
        "Status", "Payment", "Amount",
      ];

      const detailRows = [headers];
      tickets.forEach((t) => {
        const dur = t.durationMinutes
          ? `${Math.floor(t.durationMinutes / 60)}h ${t.durationMinutes % 60}m`
          : "";
        detailRows.push([
          "#" + t.ticketNumber,
          ...(showGarageColumn ? [t.garage?.name || ""] : []),
          t.apartmentNumber || "",
          [t.vehicleColor, t.vehicleMake, t.vehicleModel].filter(Boolean).join(" "),
          t.licensePlate || "",
          t.checkInTime ? new Date(t.checkInTime).toLocaleString() : "",
          t.checkOutTime ? new Date(t.checkOutTime).toLocaleString() : "",
          dur,
          t.status || "",
          METHOD_LABELS[t.paymentMethod] || t.paymentMethod || "",
          t.status === "COMPLETED"
            ? (ZERO_FEE.has(t.paymentMethod) ? "No charge" : (t.feeAmount || 0))
            : "",
        ]);
      });

      // ── Build workbook ────────────────────────────────────────
      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
      wsDetail["!cols"] = headers.map((h) =>
        h === "Vehicle" ? { wch: 28 } : h.includes("Check") ? { wch: 20 } : { wch: 14 }
      );
      XLSX.utils.book_append_sheet(wb, wsDetail, "Tickets");

      // ── Download ──────────────────────────────────────────────
      const fileName = `${appName} - ${title} - ${new Date().toLocaleDateString()}.xlsx`
        .replace(/[/\\?%*:|"<>]/g, "-");
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Excel export failed. Try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={handlePrint} disabled={printing || !tickets || tickets.length === 0}
          style={{ flex: 1 }}>
          {printing ? "Preparing..." : "🖨️ Print / PDF Report"}
        </button>
        <button className="btn btn-ghost" onClick={handleExcel} disabled={exporting || !tickets || tickets.length === 0}
          style={{ flex: 1 }}>
          {exporting ? "Exporting..." : "📊 Download Excel"}
        </button>
      </div>
      <PrintableTicketList title={title} dateLabel={dateLabel} garageLabel={garageLabel} tickets={tickets} showGarageColumn={showGarageColumn} logoUrl={logoUrl} companyName={companyName} />
    </>
  );
}

function DownloadReportButton({ report }) {
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 150);
  }

  return (
    <>
      <button
        className="btn btn-ghost"
        onClick={handlePrint}
        disabled={printing}
        style={{ marginTop: 10 }}
      >
        {printing ? "Preparing..." : "⬇ Download / Print Report"}
      </button>
      <PrintableShiftReport report={report} />
    </>
  );
}

function TicketTransactionsList({ tickets }) {
  const [activeTab, setActiveTab] = useState(null);

  if (!tickets || tickets.length === 0) return null;

  // Group tickets by payment method.
  const groups = {};
  tickets.forEach((t) => {
    const key = t.paymentMethod || "UNKNOWN";
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  const groupKeys = Object.keys(groups);
  const currentTab = activeTab || groupKeys[0];

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 10 }}>
        Ticket Transactions ({tickets.length})
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {groupKeys.map((key) => {
          const isZero = ZERO_FEE_METHODS.has(key);
          const groupTotal = isZero ? null : groups[key].reduce((s, t) => s + (t.feeAmount || 0), 0);
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: "6px 12px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                background: currentTab === key ? "var(--brass)" : "var(--navy-2)",
                color: currentTab === key ? "var(--navy)" : "var(--cream)",
                border: currentTab === key ? "none" : "1px solid var(--line)",
                fontWeight: currentTab === key ? 700 : 400,
              }}
            >
              {METHOD_LABELS_DISPLAY[key] || key}
              {" "}
              <span style={{ opacity: 0.8 }}>
                {isZero ? `(${groups[key].length})` : money(groupTotal)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tickets in active tab */}
      <div style={{ borderTop: "1px solid var(--line)" }}>
        {groups[currentTab]?.map((t) => (
          <div key={t.id} className="list-row" style={{ padding: "10px 0", display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: 600, fontFamily: "Oswald, sans-serif", color: "var(--brass-light)" }}>
                  #{t.ticketNumber}
                </span>
                {t.apartmentNumber && (
                  <span style={{ fontSize: 12, color: "var(--slate2)", marginLeft: 8 }}>Unit {t.apartmentNumber}</span>
                )}
                {(t.vehicleMake || t.vehicleColor) && (
                  <div style={{ fontSize: 12, color: "var(--slate2)" }}>
                    {[t.vehicleColor, t.vehicleMake, t.vehicleModel].filter(Boolean).join(" ")}
                    {t.licensePlate ? ` · ${t.licensePlate}` : ""}
                  </div>
                )}
                {t.durationMinutes && (
                  <div style={{ fontSize: 11, color: "var(--slate2)" }}>
                    {Math.floor(t.durationMinutes / 60)}h {t.durationMinutes % 60}m
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                {ZERO_FEE_METHODS.has(currentTab) ? (
                  <span style={{ fontSize: 13, color: "var(--slate2)", fontStyle: "italic" }}>No charge</span>
                ) : (
                  <span style={{ color: "var(--brass-light)", fontFamily: "Oswald, sans-serif", fontSize: 16 }}>
                    {money(t.feeAmount)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportRow({ r, showEmployee, onClick }) {
  return (
    <div className="list-row" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{r.shiftDate}{r.startTime ? ` · ${r.startTime}–${r.endTime || "?"}` : ""}</div>
          <div style={{ fontSize: 12, color: "var(--slate2)" }}>
            {r.garage?.name}
            {showEmployee && r.employee ? ` · ${r.employee.name}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", color: "var(--brass-light)", fontSize: 16 }}>
            {money(r.netTotal)}
          </div>
          <span className={`status-tag status-${r.status}`}>{r.status}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------- MY REPORTS (Employee / Garage Manager's own) ----------------
function MyReportsView({ user }) {
  const [reports, setReports] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shift-reports");
    if (res.ok) setReports(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasOpenDraft = reports.some((r) => r.status === "DRAFT");

  if (viewing) {
    return (
      <>
        <div className="hero-line">Shift report</div>
        <h1 className="title">{viewing.shiftDate}</h1>
        <div className="card">
          <div className="totals-grid">
            <div className="totals-cell"><div className="label">Cash</div><div className="value">{money(viewing.cashRevenue)}</div></div>
            <div className="totals-cell"><div className="label">Credit Card</div><div className="value">{money(viewing.creditCardRevenue)}</div></div>
            {(viewing.couponRevenue > 0) && <div className="totals-cell"><div className="label">Coupon</div><div className="value">{money(viewing.couponRevenue)}</div></div>}
            {(viewing.chargeBackRevenue > 0) && <div className="totals-cell"><div className="label">Charge Back</div><div className="value">{money(viewing.chargeBackRevenue)}</div></div>}
            {viewing.tickets?.filter(t => t.paymentMethod === "NC").length > 0 && (
              <div className="totals-cell"><div className="label">N/C</div><div className="value" style={{fontSize:16}}>{viewing.tickets.filter(t=>t.paymentMethod==="NC").length} tickets</div></div>
            )}
            {viewing.tickets?.filter(t => t.paymentMethod === "LOANER").length > 0 && (
              <div className="totals-cell"><div className="label">Loaner</div><div className="value" style={{fontSize:16}}>{viewing.tickets.filter(t=>t.paymentMethod==="LOANER").length} tickets</div></div>
            )}
            <div className="totals-cell"><div className="label">Other</div><div className="value">{money(viewing.otherRevenue)}</div></div>
            <div className="totals-cell"><div className="label">Adjustments</div><div className="value">{money(viewing.adjustments)}</div></div>
            <div className="totals-cell"><div className="label">Gross total</div><div className="value">{money(viewing.grossTotal)}</div></div>
            <div className="totals-cell"><div className="label">Net total</div><div className="value">{money(viewing.netTotal)}</div></div>
          </div>
          {viewing.notes && (
            <p style={{ marginTop: 14, fontSize: 13, color: "var(--slate2)" }}>Notes: {viewing.notes}</p>
          )}
          <TicketTransactionsList tickets={viewing.tickets} />
          <p style={{ marginTop: 10, fontSize: 12, color: "var(--slate2)" }}>
            Status: <span className={`status-tag status-${viewing.status}`}>{viewing.status}</span>
            {viewing.submittedAt ? ` · Submitted ${new Date(viewing.submittedAt).toLocaleString()}` : ""}
          </p>
        </div>
        <DownloadReportButton report={viewing} />
        <button className="btn btn-ghost" onClick={() => setViewing(null)} style={{ marginTop: 10 }}>Back</button>
      </>
    );
  }

  if (showForm || editing) {
    return (
      <>
        <div className="hero-line">{editing ? "Edit draft" : "New shift report"}</div>
        <h1 className="title">Shift Report</h1>
        <ShiftReportForm
          existing={editing}
          readOnly={user.role === "EMPLOYEE" || user.role === "GARAGE_MANAGER"}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      </>
    );
  }

  return (
    <>
      <div className="queue-header">
        <h1 className="title" style={{ marginBottom: 2 }}>My Shift Reports</h1>
        <span className="count-badge">{reports.length} total</span>
      </div>

      {!hasOpenDraft && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ marginBottom: 18 }}>
          + New shift report
        </button>
      )}

      {reports.length === 0 ? (
        <div className="empty-state">
          <div className="big">No reports yet</div>
          Start your first shift report above.
        </div>
      ) : (
        reports.map((r) => (
          <div key={r.id}>
            <ReportRow r={r} onClick={() => (r.status === "DRAFT" ? setEditing(r) : setViewing(r))} />
            {r.status === "DRAFT" && (
              <p style={{ fontSize: 11, color: "var(--brass-light)", marginTop: -8, marginBottom: 10 }}>
                Draft — tap to continue editing
              </p>
            )}
          </div>
        ))
      )}
    </>
  );
}

// ---------------- GARAGE REPORTS (Garage Manager viewing their whole garage) ----------------
function GarageReportsView({ user }) {
  const [reports, setReports] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  const CATEGORY_OPTIONS = [
    { key: "CASH", label: "Cash" }, { key: "CREDIT_CARD", label: "Credit Card" },
    { key: "COUPON", label: "Coupon" }, { key: "CHARGE_BACK", label: "Charge Back" },
    { key: "NC", label: "N/C" }, { key: "LOANER", label: "Loaner" },
  ];
  const CATEGORY_TO_FIELD = {
    CASH: "cashRevenue", CREDIT_CARD: "creditCardRevenue",
    COUPON: "couponRevenue", CHARGE_BACK: "chargeBackRevenue",
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/shift-reports");
    if (res.ok) setReports(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredReports = categoryFilter
    ? reports.filter((r) => {
        if (categoryFilter === "NC" || categoryFilter === "LOANER") {
          return r.tickets?.some(t => t.paymentMethod === categoryFilter);
        }
        const field = CATEGORY_TO_FIELD[categoryFilter];
        return field ? (r[field] || 0) > 0 : false;
      })
    : reports;

  if (viewing) {
    return (
      <>
        <h1 className="title">{viewing.shiftDate} — {viewing.employee?.name}</h1>
        <div className="card">
          <div className="totals-grid">
            <div className="totals-cell"><div className="label">Cash</div><div className="value">{money(viewing.cashRevenue)}</div></div>
            <div className="totals-cell"><div className="label">Credit Card</div><div className="value">{money(viewing.creditCardRevenue)}</div></div>
            {(viewing.couponRevenue > 0) && <div className="totals-cell"><div className="label">Coupon</div><div className="value">{money(viewing.couponRevenue)}</div></div>}
            {(viewing.chargeBackRevenue > 0) && <div className="totals-cell"><div className="label">Charge Back</div><div className="value">{money(viewing.chargeBackRevenue)}</div></div>}
            {viewing.tickets?.filter(t => t.paymentMethod === "NC").length > 0 && (
              <div className="totals-cell"><div className="label">N/C</div><div className="value" style={{fontSize:16}}>{viewing.tickets.filter(t=>t.paymentMethod==="NC").length} tickets</div></div>
            )}
            {viewing.tickets?.filter(t => t.paymentMethod === "LOANER").length > 0 && (
              <div className="totals-cell"><div className="label">Loaner</div><div className="value" style={{fontSize:16}}>{viewing.tickets.filter(t=>t.paymentMethod==="LOANER").length} tickets</div></div>
            )}
            <div className="totals-cell"><div className="label">Other</div><div className="value">{money(viewing.otherRevenue)}</div></div>
            <div className="totals-cell"><div className="label">Adjustments</div><div className="value">{money(viewing.adjustments)}</div></div>
            <div className="totals-cell"><div className="label">Gross total</div><div className="value">{money(viewing.grossTotal)}</div></div>
            <div className="totals-cell"><div className="label">Net total</div><div className="value">{money(viewing.netTotal)}</div></div>
          </div>
          <TicketTransactionsList tickets={viewing.tickets} />
        </div>
        <DownloadReportButton report={viewing} />
        <button className="btn btn-ghost" onClick={() => setViewing(null)} style={{ marginTop: 10 }}>Back</button>
      </>
    );
  }

  const totalNet = filteredReports.reduce((sum, r) => sum + r.netTotal, 0);

  return (
    <>
      <div className="queue-header">
        <h1 className="title" style={{ marginBottom: 2 }}>Garage Reports</h1>
        <span className="count-badge">{money(totalNet)} net</span>
      </div>
      <div className="field">
        <label>Filter by category</label>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      {filteredReports.length === 0 ? (
        <div className="empty-state">
          <div className="big">No reports match this filter</div>
          {!categoryFilter && "Reports submitted by your team will show up here."}
        </div>
      ) : (
        filteredReports.map((r) => <ReportRow key={r.id} r={r} showEmployee onClick={() => setViewing(r)} />)
      )}
    </>
  );
}

// ---------------- REVENUE DASHBOARD (Super Admin / Admin) ----------------
function RevenueDashboard({ user }) {
  const [reports, setReports] = useState([]);
  const [garages, setGarages] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [garageFilter, setGarageFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewing, setViewing] = useState(null);

  const CATEGORY_OPTIONS = [
    { key: "CASH", label: "Cash" },
    { key: "CREDIT_CARD", label: "Credit Card" },
    { key: "COUPON", label: "Coupon" },
    { key: "CHARGE_BACK", label: "Charge Back" },
    { key: "NC", label: "N/C" },
    { key: "LOANER", label: "Loaner" },
  ];

  const CATEGORY_TO_FIELD = {
    CASH: "cashRevenue", CREDIT_CARD: "creditCardRevenue",
    COUPON: "couponRevenue", CHARGE_BACK: "chargeBackRevenue",
  };

  const loadFilters = useCallback(async () => {
    const [gRes, uRes] = await Promise.all([fetch("/api/garages"), fetch("/api/users")]);
    if (gRes.ok) setGarages(await gRes.json());
    if (uRes.ok) setEmployees((await uRes.json()).filter((u) => u.role === "EMPLOYEE" || u.role === "GARAGE_MANAGER"));
  }, []);

  const loadReports = useCallback(async () => {
    const params = new URLSearchParams();
    if (garageFilter) params.set("garageId", garageFilter);
    if (employeeFilter) params.set("employeeId", employeeFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const res = await fetch(`/api/shift-reports?${params.toString()}`);
    if (res.ok) setReports(await res.json());
  }, [garageFilter, employeeFilter, fromDate, toDate]);

  useEffect(() => { loadFilters(); }, [loadFilters]);
  useEffect(() => { loadReports(); }, [loadReports]);

  // Client-side category filter — only show reports that have
  // revenue or tickets in the selected payment category.
  const filteredReports = categoryFilter
    ? reports.filter((r) => {
        if (categoryFilter === "NC" || categoryFilter === "LOANER") {
          return r.tickets?.some(t => t.paymentMethod === categoryFilter);
        }
        const field = CATEGORY_TO_FIELD[categoryFilter];
        return field ? (r[field] || 0) > 0 : false;
      })
    : reports;

  const totals = filteredReports.reduce(
    (acc, r) => ({
      cash: acc.cash + (r.cashRevenue || 0),
      credit: acc.credit + (r.creditCardRevenue || 0),
      coupon: acc.coupon + (r.couponRevenue || 0),
      chargeBack: acc.chargeBack + (r.chargeBackRevenue || 0),
      other: acc.other + (r.otherRevenue || 0),
      gross: acc.gross + r.grossTotal,
      net: acc.net + r.netTotal,
      ncCount: acc.ncCount + (r.tickets?.filter(t => t.paymentMethod === "NC").length || 0),
      loanerCount: acc.loanerCount + (r.tickets?.filter(t => t.paymentMethod === "LOANER").length || 0),
    }),
    { cash: 0, credit: 0, coupon: 0, chargeBack: 0, other: 0, gross: 0, net: 0, ncCount: 0, loanerCount: 0 }
  );

  function exportCsv() {
    const rows = [
      ["Date", "Garage", "Employee", "Status", "Cash", "Credit Card", "Coupon", "Charge Back", "Other", "Adjustments", "Gross", "Net", "N/C Count", "Loaner Count"],
      ...filteredReports.map((r) => [
        r.shiftDate, r.garage?.name || "", r.employee?.name || "", r.status,
        r.cashRevenue, r.creditCardRevenue, r.couponRevenue || 0, r.chargeBackRevenue || 0,
        r.otherRevenue, r.adjustments, r.grossTotal, r.netTotal,
        r.tickets?.filter(t => t.paymentMethod === "NC").length || 0,
        r.tickets?.filter(t => t.paymentMethod === "LOANER").length || 0,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-export-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (viewing) {
    return (
      <>
        <h1 className="title">{viewing.shiftDate} — {viewing.employee?.name}</h1>
        <div className="card">
          <p style={{ fontSize: 13, color: "var(--slate2)", marginBottom: 10 }}>{viewing.garage?.name}</p>
          <div className="totals-grid">
            <div className="totals-cell"><div className="label">Cash</div><div className="value">{money(viewing.cashRevenue)}</div></div>
            <div className="totals-cell"><div className="label">Credit Card</div><div className="value">{money(viewing.creditCardRevenue)}</div></div>
            {(viewing.couponRevenue > 0) && <div className="totals-cell"><div className="label">Coupon</div><div className="value">{money(viewing.couponRevenue)}</div></div>}
            {(viewing.chargeBackRevenue > 0) && <div className="totals-cell"><div className="label">Charge Back</div><div className="value">{money(viewing.chargeBackRevenue)}</div></div>}
            {viewing.tickets?.filter(t => t.paymentMethod === "NC").length > 0 && (
              <div className="totals-cell"><div className="label">N/C</div><div className="value" style={{fontSize:16}}>{viewing.tickets.filter(t=>t.paymentMethod==="NC").length} tickets</div></div>
            )}
            {viewing.tickets?.filter(t => t.paymentMethod === "LOANER").length > 0 && (
              <div className="totals-cell"><div className="label">Loaner</div><div className="value" style={{fontSize:16}}>{viewing.tickets.filter(t=>t.paymentMethod==="LOANER").length} tickets</div></div>
            )}
            <div className="totals-cell"><div className="label">Other</div><div className="value">{money(viewing.otherRevenue)}</div></div>
            <div className="totals-cell"><div className="label">Adjustments</div><div className="value">{money(viewing.adjustments)}</div></div>
            <div className="totals-cell"><div className="label">Gross total</div><div className="value">{money(viewing.grossTotal)}</div></div>
            <div className="totals-cell"><div className="label">Net total</div><div className="value">{money(viewing.netTotal)}</div></div>
          </div>
          {viewing.notes && <p style={{ marginTop: 14, fontSize: 13, color: "var(--slate2)" }}>Notes: {viewing.notes}</p>}
          <TicketTransactionsList tickets={viewing.tickets} />
        </div>
        <DownloadReportButton report={viewing} />
        <button className="btn btn-ghost" onClick={() => setViewing(null)} style={{ marginTop: 10 }}>Back</button>
      </>
    );
  }

  return (
    <>
      <div className="queue-header">
        <h1 className="title" style={{ marginBottom: 2 }}>Central Revenue</h1>
        <span className="count-badge">{filteredReports.length} reports</span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label>Garage</label>
          <select value={garageFilter} onChange={(e) => setGarageFilter(e.target.value)}>
            <option value="">All garages</option>
            {garages.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label>Employee</label>
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
            <option value="">All employees</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label>From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label>To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Category</label>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      <div className="card">
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 10 }}>
          Totals for this filter
        </div>
        <div className="totals-grid">
          <div className="totals-cell"><div className="label">Cash</div><div className="value">{money(totals.cash)}</div></div>
          <div className="totals-cell"><div className="label">Credit Card</div><div className="value">{money(totals.credit)}</div></div>
          {totals.coupon > 0 && <div className="totals-cell"><div className="label">Coupon</div><div className="value">{money(totals.coupon)}</div></div>}
          {totals.chargeBack > 0 && <div className="totals-cell"><div className="label">Charge Back</div><div className="value">{money(totals.chargeBack)}</div></div>}
          {totals.other > 0 && <div className="totals-cell"><div className="label">Other</div><div className="value">{money(totals.other)}</div></div>}
          {totals.ncCount > 0 && <div className="totals-cell"><div className="label">N/C</div><div className="value" style={{fontSize:16}}>{totals.ncCount} tickets</div></div>}
          {totals.loanerCount > 0 && <div className="totals-cell"><div className="label">Loaner</div><div className="value" style={{fontSize:16}}>{totals.loanerCount} tickets</div></div>}
          <div className="totals-cell"><div className="label">Gross</div><div className="value">{money(totals.gross)}</div></div>
        </div>
        <div className="totals-cell" style={{ marginTop: 10 }}>
          <div className="label">Net total</div>
          <div className="value" style={{ fontSize: 26 }}>{money(totals.net)}</div>
        </div>
        <button className="btn btn-ghost" onClick={exportCsv} style={{ marginTop: 14 }}>
          Export to CSV
        </button>
      </div>

      {filteredReports.length === 0 ? (
        <div className="empty-state">
          <div className="big">No reports match this filter</div>
        </div>
      ) : (
        filteredReports.map((r) => <ReportRow key={r.id} r={r} showEmployee onClick={() => setViewing(r)} />)
      )}
    </>
  );
}

// ---------------- GARAGES (Super Admin / Admin) ----------------
async function printVouchersInPopup(vouchers) {
  // Generate all QR codes server-side first (same approach as ticket reprint)
  const withQr = await Promise.all(
    vouchers.map(async (v) => {
      try {
        const res = await fetch(`/api/qr?token=${encodeURIComponent(v.code)}`);
        const data = await res.json();
        return { ...v, qrDataUrl: data.dataUrl || "" };
      } catch {
        return { ...v, qrDataUrl: "" };
      }
    })
  );

  const rows = withQr.map((v, i) => `
    <div style="width:80mm;padding:4mm 4mm 8mm 4mm;text-align:center;font-family:'Courier New',monospace;${i === 0 ? "margin-top:-12mm;" : ""}${i < withQr.length - 1 ? "page-break-after:always;" : ""}">
      <div style="font-size:22px;font-weight:700;margin-bottom:2px;">${v.garage?.name || "Garage"}</div>
      <div style="font-size:14px;letter-spacing:0.06em;margin-bottom:6px;">N/C PARKING VOUCHER</div>
      <div style="border-top:2px dashed #000;margin:6px 0;"></div>
      ${v.qrDataUrl ? `<img src="${v.qrDataUrl}" style="width:180px;height:180px;display:block;margin:6px auto;" />` : ""}
      <div style="font-size:22px;font-weight:700;letter-spacing:0.2em;margin:6px 0;">${v.code}</div>
      <div style="border-top:2px dashed #000;margin:6px 0;"></div>
      ${v.note ? `<div style="font-size:15px;margin-bottom:6px;">${v.note}</div>` : ""}
      <div style="font-size:14px;text-align:left;margin:8px 0 4px;">Issued to:</div>
      <div style="border-bottom:1px solid #000;margin-bottom:14px;height:22px;"></div>
      <div style="font-size:14px;text-align:left;margin:8px 0 4px;">Authorized by:</div>
      <div style="border-bottom:1px solid #000;margin-bottom:14px;height:22px;"></div>
      <div style="font-size:14px;text-align:left;margin:8px 0 4px;">Signature:</div>
      <div style="border-bottom:1px solid #000;margin-bottom:14px;height:32px;"></div>
      <div style="border-top:2px dashed #000;margin:6px 0;"></div>
      <div style="font-size:13px;margin-top:4px;">Present at checkout · Single use</div>
      <div style="font-size:13px;">Valid at this garage only</div>
    </div>
  `).join("");

  const html = `<!DOCTYPE html><html><head>
    <title>N/C Vouchers</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #fff; }
      @media print {
        @page { margin: 0; size: 80mm auto; }
      }
    </style>
  </head><body>
    <div>${rows}</div>
  </body></html>`;
  printHtmlViaIframe(html);
}

function VouchersView({ user, isAdmin }) {
  const [garages, setGarages] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [garageFilter, setGarageFilter] = useState(user.garageId || "");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [genGarage, setGenGarage] = useState(user.garageId || "");
  const [genQty, setGenQty] = useState("10");
  const [genNote, setGenNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/garages").then(r => r.json()).then(setGarages);
    }
  }, [isAdmin]);

  async function loadVouchers() {
    const params = new URLSearchParams();
    if (garageFilter) params.set("garageId", garageFilter);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/vouchers?${params}`);
    if (res.ok) setVouchers(await res.json());
  }

  useEffect(() => { loadVouchers(); }, [garageFilter, statusFilter]);

  async function generate() {
    setError(""); setSuccess(""); setGenerating(true);
    const res = await fetch("/api/vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ garageId: genGarage, quantity: parseInt(genQty), note: genNote }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) { setError(data.error); return; }
    setSuccess(`${data.length} voucher${data.length === 1 ? "" : "s"} created.`);
    setGenNote(""); loadVouchers();
    // Augment with garage name in case the API response doesn't include it
    const garageName = garages.find(g => g.id === genGarage)?.name || user.garage?.name || "";
    const withGarage = data.map(v => ({ ...v, garage: v.garage || { name: garageName } }));
    printVouchersInPopup(withGarage);
  }

  async function cancelVoucher(id) {
    if (!window.confirm("Cancel this voucher? It can no longer be used.")) return;
    const res = await fetch(`/api/vouchers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (res.ok) loadVouchers();
  }

  const activeCount = vouchers.filter(v => v.status === "ACTIVE").length;
  const usedCount = vouchers.filter(v => v.status === "USED").length;

  return (
    <>
      <h1 className="title">N/C Vouchers</h1>

      {/* Generate form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 14 }}>
          Generate New Vouchers
        </div>
        {error && <div className="error-box" style={{ marginBottom: 10 }}>{error}</div>}
        {success && <div style={{ color: "var(--green)", fontSize: 13, marginBottom: 10 }}>{success}</div>}
        {isAdmin && (
          <div className="field">
            <label>Garage</label>
            <select value={genGarage} onChange={e => setGenGarage(e.target.value)}>
              <option value="">— select garage —</option>
              {garages.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: "flex", gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Quantity</label>
            <input type="number" min={1} max={500} value={genQty} onChange={e => setGenQty(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label>Label / note (optional)</label>
            <input value={genNote} onChange={e => setGenNote(e.target.value)} placeholder="e.g. Resident Discount, Monthly Pass" />
          </div>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={generating || !genGarage || !genQty}>
          {generating ? "Generating..." : `Generate & Print ${genQty || ""} Vouchers`}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {[["Active", activeCount, "var(--green)"], ["Used", usedCount, "var(--slate2)"]].map(([label, count, color]) => (
          <div key={label} className="card" style={{ flex: 1, textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color }}>{count}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--slate2)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {isAdmin && (
          <select value={garageFilter} onChange={e => setGarageFilter(e.target.value)} style={{ flex: 1 }}>
            <option value="">All garages</option>
            {garages.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: 1 }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="USED">Used</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        {vouchers.filter(v => v.status === "ACTIVE").length > 0 && (
          <button className="btn btn-ghost" style={{ width: "auto", padding: "0 14px" }}
            onClick={() => {
              const active = vouchers.filter(v => v.status === "ACTIVE").map(v => ({
                ...v, garage: v.garage || { name: garages.find(g => g.id === v.garageId)?.name || user.garage?.name || "" }
              }));
              printVouchersInPopup(active);
            }}>
            Print All Active
          </button>
        )}
      </div>

      {/* Voucher list */}
      {vouchers.length === 0 ? (
        <div className="empty-state">No vouchers found.</div>
      ) : vouchers.map(v => (
        <div key={v.id} className="list-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, letterSpacing: "0.08em" }}>{v.code}</div>
            <div style={{ fontSize: 11, color: "var(--slate2)" }}>
              {v.garage?.name} · Created {new Date(v.createdAt).toLocaleDateString()} by {v.createdBy?.name}
              {v.note && ` · ${v.note}`}
            </div>
            {v.status === "USED" && <div style={{ fontSize: 11, color: "var(--slate2)" }}>Used {new Date(v.usedAt).toLocaleString()}</div>}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 12,
              background: v.status === "ACTIVE" ? "var(--green)" : v.status === "USED" ? "var(--navy-2)" : "var(--red)",
              color: v.status === "ACTIVE" ? "var(--navy)" : "var(--cream)",
            }}>{v.status}</span>
            {v.status === "ACTIVE" && (
              <>
                <button style={{ background: "none", border: "none", color: "var(--brass-light)", fontSize: 11, cursor: "pointer" }}
                  onClick={() => {
                    const withGarage = { ...v, garage: v.garage || { name: garages.find(g => g.id === v.garageId)?.name || user.garage?.name || "" } };
                    printVouchersInPopup([withGarage]);
                  }}>Reprint</button>
                <button style={{ background: "none", border: "none", color: "var(--red)", fontSize: 11, cursor: "pointer" }}
                  onClick={() => cancelVoucher(v.id)}>Cancel</button>
              </>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function GarageLogoUploader({ garage, onUpdated }) {
  const [preview, setPreview] = useState(garage.logoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef(null);

  async function resizeAndSave(file) {
    setUploading(true); setMsg("");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const dataUrl = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const maxW = 400;
            const scale = img.width > maxW ? maxW / img.width : 1;
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png", 0.85));
          };
          img.src = ev.target.result;
        });
        const res = await fetch(`/api/garages/${garage.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoUrl: dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) { setMsg("Failed: " + (data.error || res.status)); return; }
        setPreview(dataUrl);
        onUpdated({ ...garage, logoUrl: dataUrl });
        setMsg("Saved!");
        setTimeout(() => setMsg(""), 2000);
      } catch (err) {
        setMsg("Error: " + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function removeLogo() {
    const res = await fetch(`/api/garages/${garage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: null }),
    });
    if (res.ok) { setPreview(null); onUpdated({ ...garage, logoUrl: null }); }
  }

  return (
    <div className="list-row" style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{garage.name}</div>
          {msg && (
            <div style={{ fontSize: 11, marginTop: 2, color: msg.startsWith("Failed") || msg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>
              {msg}
            </div>
          )}
        </div>
        {preview && (
          <img src={preview} alt="" style={{ height: 40, maxWidth: 120, objectFit: "contain", borderRadius: 6, background: "var(--navy-2)", padding: 4 }} />
        )}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <input ref={inputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && resizeAndSave(e.target.files[0])} style={{ display: "none" }} />
          <button className="btn btn-ghost" style={{ width: "auto", padding: "0 12px", fontSize: 12 }}
            onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? "Saving..." : preview ? "Change" : "Upload"}
          </button>
          {preview && (
            <button className="btn btn-ghost" style={{ width: "auto", padding: "0 10px", fontSize: 12, color: "var(--red)" }}
              onClick={removeLogo}>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BrandingView({ settings, onSaved }) {
  const [companyName, setCompanyName] = useState(settings.companyName || "");
  const [logoPreview, setLogoPreview] = useState(settings.logoUrl || null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [garages, setGarages] = useState([]);
  const logoInputRef = useRef(null);

  useEffect(() => {
    fetch("/api/garages").then(r => r.json()).then(d => { if (Array.isArray(d)) setGarages(d); }).catch(() => {});
  }, []);

  async function handleLogoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true); setError("");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const dataUrl = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const maxW = 400;
            const scale = img.width > maxW ? maxW / img.width : 1;
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png", 0.85));
          };
          img.src = ev.target.result;
        });
        setLogoPreview(dataUrl);
        const saveRes = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoUrl: dataUrl }),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok) { setError(saveData.error || "Save failed."); return; }
        onSaved(saveData);
        setSuccess("Logo saved!");
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        setError("Failed: " + err.message);
      } finally {
        setUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    onSaved(data);
    setSuccess("Settings saved!");
    setTimeout(() => setSuccess(""), 3000);
  }

  return (
    <>
      <h1 className="title">Branding</h1>
      {error && <div className="error-box">{error}</div>}
      {success && <div style={{ color: "var(--green)", fontSize: 13, marginBottom: 12 }}>{success}</div>}

      <div className="card">
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 14 }}>
          Default App Logo
        </div>
        {logoPreview && (
          <img src={logoPreview} alt="Logo preview" style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain", marginBottom: 14, borderRadius: 8 }} />
        )}
        <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoSelect} style={{ display: "none" }} />
        <button className="btn btn-ghost" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
          {uploadingLogo ? "Saving..." : logoPreview ? "Change logo" : "Upload logo"}
        </button>
        <div className="field-hint" style={{ marginTop: 8 }}>
          Shown in the header for all users. Garages without their own logo will use this one.
        </div>
      </div>

      <form onSubmit={saveSettings} style={{ marginTop: 16 }}>
        <div className="field">
          <label>Company / App name</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Carlyle Parking" />
          <div className="field-hint">Shown in the header next to your logo. Leave blank to use "Integral".</div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </form>

      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 4 }}>
          Per-Garage Logos
        </div>
        <div className="field-hint" style={{ marginBottom: 14 }}>
          Upload a logo for each garage. Employees and managers at that garage will see it in the header.
          If no garage logo is set, the default logo above is used.
        </div>
        {garages.length === 0 ? (
          <div className="empty-state">No garages found.</div>
        ) : garages.map(g => (
          <GarageLogoUploader
            key={g.id}
            garage={g}
            onUpdated={(updated) => setGarages(prev => prev.map(x => x.id === updated.id ? updated : x))}
          />
        ))}
      </div>
    </>
  );
}

function GaragesView({ currentUser }) {
  const isAdmin = currentUser?.role === "ADMIN";
  const [garages, setGarages] = useState([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editError, setEditError] = useState("");

  const [tiersGarageId, setTiersGarageId] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [tiersError, setTiersError] = useState("");
  const [tierMaxHours, setTierMaxHours] = useState("");
  const [tierFee, setTierFee] = useState("");
  const [tierLabel, setTierLabel] = useState("");

  const [pmGarageId, setPmGarageId] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [pmError, setPmError] = useState("");

  const [stGarageId, setStGarageId] = useState(null);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [stError, setStError] = useState("");
  const [stName, setStName] = useState("");
  const [stStart, setStStart] = useState("");
  const [stEnd, setStEnd] = useState("");

  const ALL_METHODS = [
    { key: "CASH", label: "Cash" },
    { key: "CREDIT_CARD", label: "Credit Card" },
    { key: "COUPON", label: "Coupon" },
    { key: "CHARGE_BACK", label: "Charge Back" },
    { key: "NC", label: "N/C" },
    { key: "LOANER", label: "Loaner" },
  ];

  const load = useCallback(async () => {
    const res = await fetch("/api/garages");
    if (res.ok) setGarages(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadTiers(garageId) {
    setTiersError("");
    const res = await fetch(`/api/garages/${garageId}/rate-tiers`);
    if (res.ok) setTiers(await res.json());
  }

  async function loadPaymentMethods(garageId) {
    setPmError("");
    const res = await fetch(`/api/garages/${garageId}/payment-methods`);
    if (res.ok) setPaymentMethods(await res.json());
  }

  function togglePaymentMethods(garageId) {
    if (pmGarageId === garageId) {
      setPmGarageId(null);
    } else {
      setPmGarageId(garageId);
      setTiersGarageId(null);
      loadPaymentMethods(garageId);
    }
  }

  async function addPaymentMethod(method) {
    setPmError("");
    const res = await fetch(`/api/garages/${pmGarageId}/payment-methods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    const data = await res.json();
    if (!res.ok) { setPmError(data.error); return; }
    loadPaymentMethods(pmGarageId);
  }

  async function removePaymentMethod(pmId) {
    setPmError("");
    const res = await fetch(`/api/garages/${pmGarageId}/payment-methods/${pmId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setPmError(data.error); return; }
    loadPaymentMethods(pmGarageId);
  }

  async function loadShiftTemplates(garageId) {
    setStError("");
    const res = await fetch(`/api/garages/${garageId}/shift-templates`);
    if (res.ok) setShiftTemplates(await res.json());
  }

  function toggleShiftTemplates(garageId) {
    if (stGarageId === garageId) {
      setStGarageId(null);
    } else {
      setStGarageId(garageId);
      setTiersGarageId(null);
      setPmGarageId(null);
      setStName(""); setStStart(""); setStEnd("");
      loadShiftTemplates(garageId);
    }
  }

  async function addShiftTemplate(e) {
    e.preventDefault();
    setStError("");
    const res = await fetch(`/api/garages/${stGarageId}/shift-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: stName, startTime: stStart, endTime: stEnd }),
    });
    const data = await res.json();
    if (!res.ok) { setStError(data.error); return; }
    setStName(""); setStStart(""); setStEnd("");
    loadShiftTemplates(stGarageId);
  }

  async function removeShiftTemplate(templateId) {
    setStError("");
    const res = await fetch(`/api/garages/${stGarageId}/shift-templates/${templateId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setStError(data.error); return; }
    loadShiftTemplates(stGarageId);
  }

  function toggleTiers(garageId) {
    if (tiersGarageId === garageId) {
      setTiersGarageId(null);
    } else {
      setTiersGarageId(garageId);
      setTierMaxHours(""); setTierFee(""); setTierLabel("");
      loadTiers(garageId);
    }
  }

  async function addTier(e) {
    e.preventDefault();
    setTiersError("");
    const parsed = parseHoursMinutesInput(tierMaxHours);
    if (parsed.error) { setTiersError(parsed.error); return; }
    try {
      const res = await fetch(`/api/garages/${tiersGarageId}/rate-tiers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: tierLabel, maxHours: parsed.hours, fee: tierFee }),
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) { setTiersError(data.error || `Server error ${res.status}`); return; }
      setTierMaxHours(""); setTierFee(""); setTierLabel("");
      loadTiers(tiersGarageId);
    } catch (err) {
      setTiersError("Network error: " + err.message);
    }
  }

  async function removeTier(tierId) {
    setTiersError("");
    const res = await fetch(`/api/garages/${tiersGarageId}/rate-tiers/${tierId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setTiersError(data.error); return; }
    loadTiers(tiersGarageId);
  }

  async function addGarage(e) {
    e.preventDefault();
    setError("");
    const form = e.target;
    const body = { name: form.name.value, address: form.address.value, hourlyRate: form.hourlyRate.value };
    const res = await fetch("/api/garages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    form.reset();
    setShowForm(false);
    load();
  }

  async function removeGarage(id) {
    setError("");
    const res = await fetch(`/api/garages/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    load();
  }

  function startEdit(g) {
    setEditId(g.id);
    setEditName(g.name);
    setEditAddress(g.address || "");
    setEditRate(g.hourlyRate ?? "");
    setEditError("");
  }

  async function saveEdit(id) {
    setEditError("");
    const res = await fetch(`/api/garages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, address: editAddress, hourlyRate: editRate }),
    });
    const data = await res.json();
    if (!res.ok) { setEditError(data.error); return; }
    setEditId(null);
    load();
  }

  return (
    <>
      <div className="queue-header">
        <h1 className="title" style={{ marginBottom: 2 }}>Garages</h1>
        <span className="count-badge">{garages.length} locations</span>
      </div>
      {error && <div className="error-box">{error}</div>}

      {garages.map((g) => (
        <div key={g.id}>
          <div className="list-row">
            <div>
              <div style={{ fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: "var(--slate2)" }}>
                {g.address || "No address on file"} · {g._count?.users ?? 0} accounts · {g._count?.shiftReports ?? 0} reports
                {g.hourlyRate ? ` · $${g.hourlyRate}/hr` : " · No hourly rate set"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => (editId === g.id ? setEditId(null) : startEdit(g))}
                style={{ background: "none", border: "none", color: "var(--brass-light)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
              >
                Edit
              </button>
              {isAdmin && (
                <button
                  onClick={() => toggleTiers(g.id)}
                  style={{ background: "none", border: "none", color: "var(--brass-light)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
                >
                  Rate Tiers
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => togglePaymentMethods(g.id)}
                  style={{ background: "none", border: "none", color: "var(--brass-light)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
                >
                  Payment Methods
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => toggleShiftTemplates(g.id)}
                  style={{ background: "none", border: "none", color: "var(--brass-light)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
                >
                  Shift Timings
                </button>
              )}
              <button
                className="role-tag"
                style={{ background: "none", cursor: "pointer", color: "var(--red)" }}
                onClick={() => {
                  if (window.confirm(`Remove ${g.name}?`)) removeGarage(g.id);
                }}
              >
                Remove
              </button>
            </div>
          </div>
          {editId === g.id && (
            <div style={{ padding: "10px 0 14px", borderBottom: "1px solid var(--line)" }}>
              {editError && <div className="error-box">{editError}</div>}
              <div className="field">
                <label>Garage name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="field">
                <label>Address</label>
                <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
              </div>
              <div className="field">
                <label>Hourly parking rate ($) — used only when no rate tiers are set below</label>
                <input type="number" step="0.01" min="0" value={editRate} onChange={(e) => setEditRate(e.target.value)} placeholder="0.00" />
              </div>
              <button className="mini-btn start" onClick={() => saveEdit(g.id)}>Save changes</button>
            </div>
          )}

          {tiersGarageId === g.id && (
            <div style={{ padding: "10px 0 14px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 10 }}>
                Rate Tiers — {g.name}
              </div>
              {tiersError && <div className="error-box">{tiersError}</div>}
              {tiers.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--slate2)", marginBottom: 10 }}>
                  No tiers set — this garage is using its flat hourly rate (${g.hourlyRate || 0}/hr) for every ticket.
                </p>
              )}
              {tiers.map((t) => (
                <div key={t.id} className="list-row" style={{ padding: "8px 0" }}>
                  <span>
                    {t.label ? `${t.label} — ` : ""}
                    {formatTierDuration(t.maxHours)}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "var(--brass-light)" }}>{money(t.fee)}</span>
                    <button
                      style={{ background: "none", border: "none", color: "var(--red)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
                      onClick={() => { if (window.confirm("Remove this rate tier?")) removeTier(t.id); }}
                    >
                      Remove
                    </button>
                  </span>
                </div>
              ))}

              <form onSubmit={addTier} style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Label (optional)</label>
                  <input value={tierLabel} onChange={(e) => setTierLabel(e.target.value)} placeholder="e.g. Overnight" />
                </div>
                <div className="field">
                  <label>Up to how many hours? (e.g. 1 = 1 hour, 1.45 = 1 hr 45 min, 0.30 = 30 min — leave blank for the open-ended "anything beyond" tier)</label>
                  <input type="text" inputMode="decimal" value={tierMaxHours} onChange={(e) => setTierMaxHours(e.target.value)} placeholder="e.g. 1, 1.45, or 0.30" />
                  {tierMaxHours.trim() !== "" && !parseHoursMinutesInput(tierMaxHours).error && (
                    <div className="field-hint">= {formatTierDuration(parseHoursMinutesInput(tierMaxHours).hours)}</div>
                  )}
                </div>
                <div className="field">
                  <label>Fee for this tier ($)</label>
                  <input type="number" step="0.01" min="0" required value={tierFee} onChange={(e) => setTierFee(e.target.value)} placeholder="0.00" />
                </div>
                <button className="mini-btn start" type="submit">Add tier</button>
              </form>
            </div>
          )}

          {pmGarageId === g.id && (
            <div style={{ padding: "10px 0 14px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 10 }}>
                Payment Methods — {g.name}
              </div>
              {pmError && <div className="error-box">{pmError}</div>}
              {paymentMethods.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--slate2)", marginBottom: 12 }}>
                  No payment methods enabled yet — employees won't be able to check out vehicles until at least one is added.
                </p>
              )}
              {paymentMethods.map((pm) => (
                <div key={pm.id} className="list-row" style={{ padding: "8px 0" }}>
                  <span style={{ fontWeight: 600 }}>{ALL_METHODS.find((m) => m.key === pm.method)?.label || pm.method}</span>
                  <button
                    style={{ background: "none", border: "none", color: "var(--red)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
                    onClick={() => { if (window.confirm("Remove this payment method?")) removePaymentMethod(pm.id); }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "var(--slate2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Add method:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {ALL_METHODS.filter((m) => !paymentMethods.find((pm) => pm.method === m.key)).map((m) => (
                    <button
                      key={m.key}
                      onClick={() => addPaymentMethod(m.key)}
                      style={{
                        background: "var(--navy)", border: "1px solid var(--brass)", color: "var(--brass-light)",
                        borderRadius: 20, padding: "6px 14px", fontSize: 12, cursor: "pointer",
                      }}
                    >
                      + {m.label}
                    </button>
                  ))}
                  {ALL_METHODS.every((m) => paymentMethods.find((pm) => pm.method === m.key)) && (
                    <span style={{ fontSize: 12, color: "var(--slate2)" }}>All methods enabled.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {stGarageId === g.id && (
            <div style={{ padding: "10px 0 14px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--brass-light)", marginBottom: 10 }}>
                Shift Timings — {g.name}
              </div>
              {stError && <div className="error-box">{stError}</div>}
              {shiftTemplates.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--slate2)", marginBottom: 12 }}>
                  No shift timings defined yet. Add shifts below and employees can select them when filing reports.
                </p>
              )}
              {shiftTemplates.map((t) => (
                <div key={t.id} className="list-row" style={{ padding: "10px 0" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "var(--slate2)" }}>{t.startTime} → {t.endTime}</div>
                  </div>
                  <button
                    style={{ background: "none", border: "none", color: "var(--red)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
                    onClick={() => { if (window.confirm(`Remove "${t.name}" shift?`)) removeShiftTemplate(t.id); }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <form onSubmit={addShiftTemplate} style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Shift name</label>
                  <input value={stName} onChange={(e) => setStName(e.target.value)} placeholder="e.g. Morning, Evening, Night" required />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label>Start time</label>
                    <input value={stStart} onChange={(e) => setStStart(e.target.value)} placeholder="e.g. 7:00 AM" required />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>End time</label>
                    <input value={stEnd} onChange={(e) => setStEnd(e.target.value)} placeholder="e.g. 3:00 PM" required />
                  </div>
                </div>
                <button className="mini-btn start" type="submit">Add shift</button>
              </form>
            </div>
          )}
        </div>
      ))}

      {showForm ? (
        <form onSubmit={addGarage} style={{ marginTop: 18 }}>
          <div className="field">
            <label>Garage name</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>Address (optional)</label>
            <input name="address" />
          </div>
          <div className="field">
            <label>Hourly parking rate ($)</label>
            <input name="hourlyRate" type="number" step="0.01" min="0" placeholder="0.00" />
          </div>
          <button className="btn btn-primary" type="submit">Save garage</button>
          <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
        </form>
      ) : (
        currentUser.role === "SUPER_ADMIN" && (
          <button className="btn btn-ghost" onClick={() => setShowForm(true)} style={{ marginTop: 14 }}>
            + Add a garage
          </button>
        )
      )}
    </>
  );
}

// ---------------- USERS (Super Admin / Admin / Garage Manager) ----------------
function UsersView({ currentUser }) {
  const isGarageManager = currentUser.role === "GARAGE_MANAGER";
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const [users, setUsers] = useState([]);
  const [garages, setGarages] = useState([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [role, setRole] = useState(isGarageManager ? "EMPLOYEE" : isSuperAdmin ? "ADMIN" : "GARAGE_MANAGER");
  const [resetId, setResetId] = useState(null);
  const [resetValue, setResetValue] = useState("");
  const [resetError, setResetError] = useState("");

  // Garage assignment panel state (Super Admin only)
  const [assignId, setAssignId] = useState(null);
  const [assignGarageIds, setAssignGarageIds] = useState([]);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignError, setAssignError] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

  const load = useCallback(async () => {
    const requests = [fetch("/api/users")];
    if (!isGarageManager) requests.push(fetch("/api/garages"));
    if (isSuperAdmin) requests.push(fetch("/api/admin-garages"));
    const results = await Promise.all(requests);
    if (results[0].ok) setUsers(await results[0].json());
    if (!isGarageManager && results[1]?.ok) setGarages(await results[1].json());
    // Merge admin garage assignments into user list
    if (isSuperAdmin && results[2]?.ok) {
      const adminData = await results[2].json();
      setUsers((prev) => prev.map((u) => {
        const a = adminData.find((ad) => ad.id === u.id);
        return a ? { ...u, adminGarages: a.adminGarages, reportEmail: a.reportEmail } : u;
      }));
    }
  }, [isGarageManager, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  function openAssign(u) {
    setAssignId(u.id);
    setAssignGarageIds((u.adminGarages || []).map((ag) => ag.garageId));
    setAssignEmail(u.reportEmail || "");
    setAssignError("");
  }

  function toggleGarage(garageId) {
    setAssignGarageIds((prev) =>
      prev.includes(garageId) ? prev.filter((id) => id !== garageId) : [...prev, garageId]
    );
  }

  async function saveAssignment() {
    setAssignError("");
    setAssignSaving(true);
    const res = await fetch("/api/admin-garages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: assignId, garageIds: assignGarageIds, reportEmail: assignEmail }),
    });
    const data = await res.json();
    setAssignSaving(false);
    if (!res.ok) { setAssignError(data.error); return; }
    setAssignId(null);
    load();
  }

  useEffect(() => { load(); }, [load]);

  async function createUser(e) {
    e.preventDefault();
    setError("");
    const form = e.target;
    const body = {
      name: form.name.value,
      username: form.username.value,
      password: form.password.value,
      role: form.role.value,
      garageId: form.garageId ? form.garageId.value : undefined,
    };
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    form.reset();
    setShowForm(false);
    load();
  }

  async function removeUser(id) {
    setError("");
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    load();
  }

  async function saveReset(id) {
    setResetError("");
    if (!resetValue || resetValue.length < 6) {
      setResetError("New password must be at least 6 characters.");
      return;
    }
    const res = await fetch(`/api/users/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: resetValue }),
    });
    const data = await res.json();
    if (!res.ok) { setResetError(data.error); return; }
    setResetId(null);
    setResetValue("");
  }

  const roleOptions = isGarageManager
    ? ["EMPLOYEE"]
    : isSuperAdmin
    ? ["ADMIN"]
    : ["GARAGE_MANAGER", "EMPLOYEE"];

  // Admin accounts are global (no garage), same as Super Admin — only
  // Garage Manager/Employee actually need one selected.
  const needsGarage = role === "GARAGE_MANAGER" || role === "EMPLOYEE";

  return (
    <>
      <div className="queue-header">
        <h1 className="title" style={{ marginBottom: 2 }}>{isGarageManager ? "Employees" : isSuperAdmin ? "Admins" : "Users"}</h1>
        <span className="count-badge">{users.length} accounts</span>
      </div>
      {error && <div className="error-box">{error}</div>}

      {users.map((u) => (
        <div key={u.id}>
          <div className="list-row">
            <div>
              <div style={{ fontWeight: 600 }}>{u.name}</div>
              <div style={{ fontSize: 12, color: "var(--slate2)" }}>
                {u.username}{u.garage ? ` · ${u.garage.name}` : ""}
                {isSuperAdmin && u.adminGarages?.length > 0 && (
                  <span> · {u.adminGarages.map((ag) => ag.garage?.name).join(", ")}</span>
                )}
                {isSuperAdmin && u.reportEmail && (
                  <span> · 📧 {u.reportEmail}</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="role-tag">{u.role.replace("_", " ")}</span>
              {isSuperAdmin && (
                <button
                  onClick={() => assignId === u.id ? setAssignId(null) : openAssign(u)}
                  style={{ background: "none", border: "none", color: "var(--brass-light)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
                >
                  Assign
                </button>
              )}
              <button
                onClick={() => { setResetId(resetId === u.id ? null : u.id); setResetValue(""); setResetError(""); }}
                style={{ background: "none", border: "none", color: "var(--brass-light)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
              >
                Reset
              </button>
              <button
                onClick={() => { if (window.confirm(`Remove ${u.name}?`)) removeUser(u.id); }}
                style={{ background: "none", border: "none", color: "var(--red)", fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}
              >
                Remove
              </button>
            </div>
          </div>

          {assignId === u.id && (
            <div style={{ padding: "12px 0 16px", borderBottom: "1px solid var(--line)" }}>
              {assignError && <div className="error-box">{assignError}</div>}
              <div style={{ fontSize: 12, color: "var(--slate2)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Assigned garages
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {garages.map((g) => (
                  <label key={g.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={assignGarageIds.includes(g.id)}
                      onChange={() => toggleGarage(g.id)}
                      style={{ width: "auto" }}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
              <div className="field">
                <label>Report email (daily revenue report goes here)</label>
                <input
                  type="email"
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ width: "auto", padding: "10px 18px" }} onClick={saveAssignment} disabled={assignSaving}>
                  {assignSaving ? "Saving…" : "Save"}
                </button>
                <button className="btn btn-ghost" style={{ width: "auto", padding: "10px 18px", marginTop: 0 }} onClick={() => setAssignId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {resetId === u.id && (
            <div style={{ padding: "10px 0 14px", borderBottom: "1px solid var(--line)" }}>
              {resetError && <div className="error-box">{resetError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <input type="password" placeholder="New password" value={resetValue} onChange={(e) => setResetValue(e.target.value)} style={{ flex: 1, background: "var(--navy-2)", border: "1px solid var(--line)", color: "var(--cream)", padding: "10px 12px", borderRadius: 8 }} />
                <button className="btn btn-primary" style={{ width: "auto", padding: "10px 16px" }} onClick={() => saveReset(u.id)}>Save</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showForm ? (
        <form onSubmit={createUser} style={{ marginTop: 18 }}>
          <div className="field">
            <label>Name</label>
            <input name="name" required />
          </div>
          <div className="field">
            <label>Username</label>
            <input name="username" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input name="password" type="password" required minLength={6} />
          </div>
          {!isGarageManager && (
            <div className="field">
              <label>Role</label>
              <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
                {roleOptions.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
              </select>
            </div>
          )}
          {isGarageManager && <input type="hidden" name="role" value="EMPLOYEE" />}
          {!isGarageManager && needsGarage && (
            <div className="field">
              <label>Garage</label>
              <select name="garageId" required>
                <option value="" disabled>Select a garage…</option>
                {garages.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
          <button className="btn btn-primary" type="submit">Create account</button>
          <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
        </form>
      ) : (
        <button className="btn btn-ghost" onClick={() => setShowForm(true)} style={{ marginTop: 14 }}>
          + Add {isGarageManager ? "an employee" : "a user"}
        </button>
      )}
    </>
  );
}
