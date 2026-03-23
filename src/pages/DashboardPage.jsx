import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const REPORTS_COLLECTION = "Sims_reports";

function DashboardPage() {
  const { user, role, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [activeFilter, setActiveFilter] = useState("today");
  const [loadError, setLoadError] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!db || !user?.uid) {
      setReports([]);
      return undefined;
    }

    let reportsQuery;
    if (role === "gm") {
      reportsQuery = query(collection(db, REPORTS_COLLECTION), orderBy("submittedAt", "desc"));
    } else {
      reportsQuery = query(
        collection(db, REPORTS_COLLECTION),
        where("agentId", "==", user.uid),
        orderBy("submittedAt", "desc")
      );
    }

    const unsub = onSnapshot(
      reportsQuery,
      (snapshot) => {
        setLoadError("");
        const entries = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
        setReports(entries);
      },
      (error) => {
        setReports([]);
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code === "permission-denied") {
          setLoadError("Access denied: your role must be agent or branch_head, and each report must include agentId equal to your UID.");
          return;
        }
        if (code === "failed-precondition") {
          setLoadError("Query needs a Firestore index. Create the suggested index in Firebase Console, then refresh.");
          return;
        }
        if (code === "unavailable") {
          setLoadError("Firestore is temporarily unavailable. Check internet connection and try again.");
          return;
        }
        setLoadError(code ? `Unable to load reports (${code}). Please try again.` : "Unable to load reports. Please try again.");
      }
    );

    return unsub;
  }, [role, user?.uid]);

  const startOfToday = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const startOfWeek = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setDate(now.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);

  const startOfMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const scopedReports = useMemo(() => {
    if (role === "gm") {
      return reports;
    }

    return reports.filter((entry) => (entry.agentId || entry.submittedByUid) === user.uid);
  }, [reports, role, user.uid]);

  const parseSubmittedAt = (entry) => {
    const value = entry?.submittedAt;
    if (!value) {
      return null;
    }

    if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
      const timestampDate = value.toDate();
      return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const totalToday = useMemo(() => {
    return scopedReports.filter((entry) => {
      const date = parseSubmittedAt(entry);
      return date ? date >= startOfToday : false;
    }).length;
  }, [scopedReports, startOfToday]);

  const totalWeek = useMemo(() => {
    return scopedReports.filter((entry) => {
      const date = parseSubmittedAt(entry);
      return date ? date >= startOfWeek : false;
    }).length;
  }, [scopedReports, startOfWeek]);

  const totalMonth = useMemo(() => {
    return scopedReports.filter((entry) => {
      const date = parseSubmittedAt(entry);
      return date ? date >= startOfMonth : false;
    }).length;
  }, [scopedReports, startOfMonth]);

  const mySubmissions = useMemo(() => {
    return reports.filter((entry) => (entry.agentId || entry.submittedByUid) === user.uid).length;
  }, [reports, user.uid]);

  const filteredReports = useMemo(() => {
    if (activeFilter === "today") {
      return scopedReports.filter((entry) => {
        const date = parseSubmittedAt(entry);
        return date ? date >= startOfToday : false;
      });
    }

    if (activeFilter === "week") {
      return scopedReports.filter((entry) => {
        const date = parseSubmittedAt(entry);
        return date ? date >= startOfWeek : false;
      });
    }

    if (activeFilter === "month") {
      return scopedReports.filter((entry) => {
        const date = parseSubmittedAt(entry);
        return date ? date >= startOfMonth : false;
      });
    }

    return scopedReports;
  }, [activeFilter, scopedReports, startOfMonth, startOfToday, startOfWeek]);

  const activeFilterLabel = useMemo(() => {
    if (activeFilter === "today") {
      return "Today";
    }

    if (activeFilter === "week") {
      return "This Week";
    }

    if (activeFilter === "month") {
      return "This Month";
    }

    return "All Time";
  }, [activeFilter]);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <main className="app-shell">
      <header className="topbar panel">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Submission Dashboard</h1>
          <p className="subtitle">Signed in as {profile?.name || user.email}</p>
          <p className="subtitle">
            <span className="role-pill">{(role || "branch").toUpperCase()}</span>
          </p>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => navigate("/submit")} type="button">
            Submit New Report
          </button>
          {role === "gm" ? (
            <button className="btn ghost" onClick={() => navigate("/admin")} type="button">
              Manager Portal
            </button>
          ) : null}
          <button className="btn danger" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      <section className="dashboard-grid metrics-grid">
        <article className={`stat-card metric-card ${activeFilter === "today" ? "active" : ""}`}>
          <button className="metric-button" type="button" onClick={() => setActiveFilter("today")}>
          <p className="stat-label">Today</p>
          <p className="stat-value">{totalToday}</p>
          </button>
          <button 
            className="view-details-btn"
            type="button"
            onClick={() => {
              setActiveFilter("today");
              setShowDetails(true);
            }}
          >
            View Details
          </button>
        </article>
        <article className={`stat-card metric-card ${activeFilter === "week" ? "active" : ""}`}>
          <button className="metric-button" type="button" onClick={() => setActiveFilter("week")}>
          <p className="stat-label">This Week</p>
          <p className="stat-value">{totalWeek}</p>
          </button>
          <button 
            className="view-details-btn"
            type="button"
            onClick={() => {
              setActiveFilter("week");
              setShowDetails(true);
            }}
          >
            View Details
          </button>
        </article>
        <article className={`stat-card metric-card ${activeFilter === "month" ? "active" : ""}`}>
          <button className="metric-button" type="button" onClick={() => setActiveFilter("month")}>
          <p className="stat-label">This Month</p>
          <p className="stat-value">{totalMonth}</p>
          </button>
          <button 
            className="view-details-btn"
            type="button"
            onClick={() => {
              setActiveFilter("month");
              setShowDetails(true);
            }}
          >
            View Details
          </button>
        </article>
        <article className={`stat-card metric-card ${activeFilter === "all" ? "active" : ""}`}>
          <button className="metric-button" type="button" onClick={() => setActiveFilter("all")}>
          <p className="stat-label">All Time</p>
          <p className="stat-value">{scopedReports.length}</p>
          </button>
          <button 
            className="view-details-btn"
            type="button"
            onClick={() => {
              setActiveFilter("all");
              setShowDetails(true);
            }}
          >
            View Details
          </button>
        </article>
      </section>

      {showDetails ? (
      <section className="panel table-panel">
        <div className="panel-head">
          <h2>{activeFilterLabel} Details</h2>
        </div>
        <p className="helper">
          Showing {filteredReports.length} records. My total submissions: {mySubmissions}.
        </p>

        {loadError ? <p className="form-message error">{loadError}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Submitted At</th>
                <th>Serial Number</th>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>ID Number</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="5">No submissions found for this filter.</td>
                </tr>
              ) : (
                filteredReports.map((entry) => (
                  <tr key={entry.id}>
                    <td>{parseSubmittedAt(entry)?.toLocaleString() || "-"}</td>
                    <td>{entry.serialNumber || "-"}</td>
                    <td>{entry.customerName || "-"}</td>
                    <td>{entry.phoneNumber || "-"}</td>
                    <td>{entry.idNumber || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </main>
  );
}

export default DashboardPage;
