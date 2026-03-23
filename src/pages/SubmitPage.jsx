import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const REPORTS_COLLECTION = "reports";
const SCAN_SESSIONS_COLLECTION = "scanSessions";

function SubmitPage({ mobileMode = false }) {
  const { user, role, profile, logout } = useAuth();
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const scanFeedbackTimerRef = useRef(null);
  const scanLockRef = useRef(false);
  const [scannerOn, setScannerOn] = useState(false);
  const [showScannerUI, setShowScannerUI] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [reports, setReports] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [usePhoneScanner, setUsePhoneScanner] = useState(false);
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [selectedSerialMode, setSelectedSerialMode] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [scanCaptured, setScanCaptured] = useState(false);
  const [handoffSessionId, setHandoffSessionId] = useState("");
  const hasScannedSerial = Boolean(serialNumber.trim());
  const hasSelectedSerialMode = Boolean(selectedSerialMode);
  const serialInputReadOnly = selectedSerialMode === "camera" || selectedSerialMode === "phone";
  const mobileSessionId = useMemo(() => {
    if (!mobileMode || typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get("session") || "";
  }, [mobileMode]);
  const isPhoneHandoff = mobileMode && Boolean(mobileSessionId);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncScreenMode = () => {
      setIsDesktop(window.innerWidth >= 960);
    };

    syncScreenMode();
    window.addEventListener("resize", syncScreenMode);

    return () => window.removeEventListener("resize", syncScreenMode);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (mobileMode) {
      setShareUrl(window.location.href);
      return;
    }

    if (!handoffSessionId) {
      setShareUrl("");
      return;
    }

    setShareUrl(`${window.location.origin}/mobile-scan?session=${handoffSessionId}`);
  }, [handoffSessionId, mobileMode]);

  useEffect(() => {
    return () => {
      if (scanFeedbackTimerRef.current) {
        window.clearTimeout(scanFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, REPORTS_COLLECTION), orderBy("submittedAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
      setReports(entries);
    });

    return () => {
      unsub();
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (mobileMode || !db) {
      return undefined;
    }

    const sessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const sessionRef = doc(db, SCAN_SESSIONS_COLLECTION, sessionId);

    setHandoffSessionId(sessionId);

    const unsubscribe = onSnapshot(sessionRef, async (snapshot) => {
      const data = snapshot.data();
      const incomingSerial = String(data?.serialNumber || "").replace(/\D/g, "").slice(0, 12);

      if (!incomingSerial) {
        return;
      }

      setSerialNumber(incomingSerial);
      triggerScanConfirmation();
      setFeedback("Serial received from phone scanner.", "success");
      setUsePhoneScanner(false);
      setShowScannerUI(false);
      setSelectedSerialMode("phone");

      try {
        await deleteDoc(sessionRef);
      } catch {
        // Ignore cleanup issues for completed handoff sessions.
      }
    });

    return () => {
      unsubscribe();
      deleteDoc(sessionRef).catch(() => undefined);
    };
  }, [mobileMode]);

  const scopedReports = useMemo(() => {
    if (role === "manager" || role === "gm" || role === "admin") {
      return reports;
    }

    if (profile?.branchId) {
      return reports.filter((entry) => entry.branchId === profile.branchId);
    }

    return reports.filter((entry) => entry.submittedByUid === user.uid);
  }, [reports, role, profile?.branchId, user.uid]);

  const setFeedback = (text, type) => {
    setMessage({ text, type });
  };

  const triggerScanConfirmation = () => {
    setScanCaptured(true);

    if (scanFeedbackTimerRef.current) {
      window.clearTimeout(scanFeedbackTimerRef.current);
    }

    scanFeedbackTimerRef.current = window.setTimeout(() => {
      setScanCaptured(false);
    }, 1400);

    try {
      const audioContext = new window.AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
      oscillator.onended = () => {
        audioContext.close().catch(() => undefined);
      };
    } catch {
      // Ignore audio playback issues in restricted browsers.
    }

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(120);
    }
  };

  const startScanner = async () => {
    if (scannerRef.current || scannerOn) {
      return;
    }

    setManualEntryMode(false);
    setSelectedSerialMode("camera");
    setShowScannerUI(true);
    setUsePhoneScanner(false);

    const scanner = new Html5Qrcode("reader");

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 260, height: 120 } },
        async (decodedText) => {
          if (scanLockRef.current) {
            return;
          }

          scanLockRef.current = true;

          try {
            const normalizedSerial = decodedText.replace(/\D/g, "").slice(0, 12);

            if (!/^00\d{10}$/.test(normalizedSerial)) {
              setFeedback("Scanned serial must be 12 digits and start with 00.", "error");
              return;
            }

            if (isPhoneHandoff && mobileSessionId && db) {
              await setDoc(doc(db, SCAN_SESSIONS_COLLECTION, mobileSessionId), {
                serialNumber: normalizedSerial,
                submittedByUid: user.uid,
                submittedAt: new Date().toISOString(),
              });

              triggerScanConfirmation();
              setFeedback("Serial sent to desktop successfully.", "success");
              await stopScanner();
              return;
            }

            setSerialNumber(normalizedSerial);
            triggerScanConfirmation();
            setFeedback("Barcode scanned successfully.", "success");
            await stopScanner();
          } finally {
            window.setTimeout(() => {
              scanLockRef.current = false;
            }, 400);
          }
        },
        () => {
          // Ignore per-frame decode warnings.
        }
      );

      scannerRef.current = scanner;
      setScannerOn(true);
    } catch {
      setFeedback("Camera access failed. Allow permission and retry.", "error");
      scannerRef.current = null;
      setScannerOn(false);
      setShowScannerUI(false);
    }
  };

  const stopScanner = async () => {
    if (!scannerRef.current) {
      setScannerOn(false);
      setShowScannerUI(false);
      return;
    }

    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch {
      // Scanner stop can fail if already stopped.
    }

    scannerRef.current = null;
    setScannerOn(false);
    setShowScannerUI(false);
  };

  const validate = () => {
    if (!serialNumber.trim()) {
      return "Scan barcode first to capture serial number.";
    }

    if (!/^00\d{10}$/.test(serialNumber.trim())) {
      return "Serial number must be exactly 12 digits and start with 00.";
    }

    if (!customerName.trim()) {
      return "Customer name is required.";
    }

    if (!/^\d{10}$/.test(phoneNumber)) {
      return "Number must be exactly 10 digits.";
    }

    if (!/^GHA-\d{9}-\d$/.test(idNumber.toUpperCase())) {
      return "ID number must be in format GHA-XXXXXXXXX-X.";
    }

    return null;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();

    if (validationError) {
      setFeedback(validationError, "error");
      return;
    }

    try {
      await addDoc(collection(db, REPORTS_COLLECTION), {
        serialNumber: serialNumber.trim(),
        customerName: customerName.trim(),
        phoneNumber,
        idNumber: idNumber.toUpperCase(),
        branchId: profile?.branchId || null,
        submittedByUid: user.uid,
        submittedByEmail: user.email,
        submittedAt: new Date().toISOString(),
      });

      setCustomerName("");
      setPhoneNumber("");
      setIdNumber("");
      setSerialNumber("");
      setFeedback("Report submitted successfully. Opening dashboard...", "success");
      setTimeout(() => {
        navigate("/dashboard");
      }, 350);
    } catch {
      setFeedback("Submission failed. Check Firebase permissions.", "error");
    }
  };

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const togglePhoneScanner = async () => {
    if (!usePhoneScanner && scannerOn) {
      await stopScanner();
    }

    if (!usePhoneScanner) {
      setManualEntryMode(false);
      setSelectedSerialMode("phone");
      setUsePhoneScanner(true);
      setShowScannerUI(true);
      return;
    }

    setSelectedSerialMode("");
    setUsePhoneScanner(false);
    setShowScannerUI(false);
  };

  const enableManualEntry = async () => {
    if (scannerOn || scannerRef.current) {
      await stopScanner();
    }

    setUsePhoneScanner(false);
    setShowScannerUI(false);
    setManualEntryMode(true);
    setSelectedSerialMode("manual");
    setFeedback("Manual serial entry enabled.", "success");
  };

  return (
    <main className={`app-shell ${mobileMode ? "mobile-scan-shell" : ""}`}>
      <header className="topbar panel">
        <div>
          <p className="eyebrow">{mobileMode ? "Mobile Scanner" : "Branch Operations"}</p>
          <h1>{mobileMode ? "Phone SIM Scanner" : "SIM Registration Submit"}</h1>
          <p className="subtitle">Signed in as {profile?.name || user.email}</p>
          <p className="subtitle">BRANCH : {profile?.branchId || "Manager Access"}</p>
          <p className="subtitle">
            <span className="role-pill">{(role || "branch").toUpperCase()}</span>
          </p>
        </div>
        <div className="actions">
          {!mobileMode ? (
            <button className="btn ghost" type="button" onClick={() => navigate("/dashboard")}>
              Open Dashboard
            </button>
          ) : null}
          {role === "manager" || role === "gm" || role === "admin" ? (
            <button className="btn ghost" onClick={() => navigate("/admin")} type="button">
              Manager Portal
            </button>
          ) : null}
          <button className="btn danger" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      <section className="workspace-grid submit-grid">
        <article className="panel scan-panel">
          <div className="panel-head">
            <h2>1. Scan SIM Barcode</h2>
            <div className="scan-actions">
              {isDesktop && !mobileMode ? (
                <button
                  className={`btn ghost mode-btn ${selectedSerialMode === "phone" ? "active" : ""}`}
                  type="button"
                  onClick={togglePhoneScanner}
                >
                  {usePhoneScanner ? "Use Desktop Camera" : "Use Phone Scanner"}
                </button>
              ) : null}
              <button
                className={`btn ghost mode-btn ${selectedSerialMode === "camera" ? "active" : ""}`}
                type="button"
                onClick={scannerOn ? stopScanner : startScanner}
                disabled={usePhoneScanner}
              >
                {scannerOn ? "Stop Camera" : "Start Camera"}
              </button>
              <button
                className={`btn ghost mode-btn ${selectedSerialMode === "manual" ? "active" : ""}`}
                type="button"
                onClick={enableManualEntry}
              >
                Input Manually
              </button>
            </div>
          </div>
          <p className="helper">
            {mobileMode
              ? isPhoneHandoff
                ? "Use your phone camera to scan the SIM barcode. The serial will be sent to the desktop form instantly."
                : "Use your phone camera to scan the SIM barcode. The form opens after a successful scan."
              : selectedSerialMode === "manual"
                ? "Manual entry is active. Enter the 12-digit serial number below. Scanner preview is hidden."
                : !hasSelectedSerialMode
                  ? "Select a mode to begin serial capture."
                : "Scan barcode first. The form will open automatically after scan."}
          </p>
          {!mobileMode && !hasSelectedSerialMode ? (
            <div className="empty-state-panel">
              <p className="helper">Choose Start Camera, Use Phone Scanner, or Input Manually to continue.</p>
            </div>
          ) : null}
          {showScannerUI && (
            <>
              {usePhoneScanner ? (
                <div className={`reader reader-modern phone-handoff ${scanCaptured ? "scan-success" : ""}`}>
                  <p className="stat-label">Phone Scanner Access</p>
                  <QRCodeSVG value={shareUrl || "https://simsreport.netlify.app/"} size={172} includeMargin />
                  <p className="helper">
                    Scan this QR code with a phone, open the scanner there, and the captured serial will fill this desktop form.
                  </p>
                </div>
              ) : (
                <div className={`reader-shell ${scanCaptured ? "scan-success" : ""}`}>
                  <div id="reader" className="reader reader-modern" />
                  {scanCaptured ? <div className="scan-badge">Captured</div> : null}
                </div>
              )}
            </>
          )}

          {hasSelectedSerialMode ? (
            <>
              <label htmlFor="serialNumber">Serial Number (12 digits)</label>
              <input
                id="serialNumber"
                inputMode="numeric"
                value={serialNumber}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setSerialNumber(cleaned);
                }}
                maxLength={12}
                placeholder="000000000000"
                readOnly={serialInputReadOnly}
              />
            </>
          ) : null}
        </article>

        <article className="panel form-panel-modern">
          <h2>2. Customer Details</h2>
          {!hasScannedSerial ? (
            <div className="empty-state-panel">
              <p className="helper">
                {isPhoneHandoff
                  ? "Use the phone scanner to send the serial here. This form will unlock on the desktop as soon as the scan is received."
                  : "Scan barcode first, then the form will appear automatically."}
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <label htmlFor="customerName">Customer Name</label>
              <input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />

              <label htmlFor="phoneNumber">Number (10 digits)</label>
              <input
                id="phoneNumber"
                inputMode="numeric"
                value={phoneNumber}
                maxLength={10}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="0123456789"
                required
              />

              <label htmlFor="idNumber">ID Number NO HYPHEN</label>
              <input
                id="idNumber"
                value={idNumber}
                onChange={(e) => {
                  const input = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                  
                  // Remove all chars, then rebuild with format
                  let clean = input;
                  
                  // Ensure GHA is at start
                  if (!clean.startsWith("GHA")) {
                    clean = "GHA" + clean.replace(/[^0-9]/g, "");
                  }
                  
                  // Extract digits after GHA (max 10: 9 + 1)
                  const digits = clean.substring(3).replace(/[^0-9]/g, "").slice(0, 10);
                  
                  // Format: GHA-{9 digits}-{1 digit}
                  let formatted = "GHA-";
                  if (digits.length > 9) {
                    formatted += digits.substring(0, 9) + "-" + digits.substring(9);
                  } else {
                    formatted += digits;
                  }
                  
                  setIdNumber(formatted);
                }}
                placeholder="GHA0078142706"
                maxLength={15}
                required
              />

              <button className="btn primary" type="submit">
                Submit Report
              </button>

              {message.text ? <p className={`form-message ${message.type}`}>{message.text}</p> : null}
            </form>
          )}

          {!message.text || hasScannedSerial ? null : (
            <p className={`form-message ${message.type}`}>{message.text}</p>
          )}
        </article>
      </section>
    </main>
  );
}

export default SubmitPage;
