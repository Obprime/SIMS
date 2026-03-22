import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const REPORTS_COLLECTION = "reports";

function DashboardPage() {
  const { user, role, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [activeFilter, setActiveFilter] = useState("today");

  useEffect(() => {
    const q = query(collection(db, REPORTS_COLLECTION), orderBy("submittedAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
      setReports(entries);
    });

    return unsub;
  }, []);

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
    if (role === "manager" || role === "gm" || role === "admin") {
      return reports;
    }

    if (profile?.branchId) {
      return reports.filter((entry) => entry.branchId === profile.branchId);
    }

    return reports.filter((entry) => entry.submittedByUid === user.uid);
  }, [reports, role, profile?.branchId, user.uid]);

  const totalToday = useMemo(() => {
    return scopedReports.filter((entry) => new Date(entry.submittedAt) >= startOfToday).length;
  }, [scopedReports, startOfToday]);

  const totalWeek = useMemo(() => {
    return scopedReports.filter((entry) => new Date(entry.submittedAt) >= startOfWeek).length;
  }, [scopedReports, startOfWeek]);

  const totalMonth = useMemo(() => {
    return scopedReports.filter((entry) => new Date(entry.submittedAt) >= startOfMonth).length;
  }, [scopedReports, startOfMonth]);

  const mySubmissions = useMemo(() => {
    return reports.filter((entry) => entry.submittedByUid === user.uid).length;
  }, [reports, user.uid]);

  const filteredReports = useMemo(() => {
    if (activeFilter === "today") {
      return scopedReports.filter((entry) => new Date(entry.submittedAt) >= startOfToday);
    }

    if (activeFilter === "week") {
      return scopedReports.filter((entry) => new Date(entry.submittedAt) >= startOfWeek);
    }

    if (activeFilter === "month") {
      return scopedReports.filter((entry) => new Date(entry.submittedAt) >= startOfMonth);
    }

    return scopedReports;
  }, [activeFilter, scopedReports, startOfMonth, startOfToday, startOfWeek]);

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

      <section className="dashboard-grid metrics-grid">
        <article className={`stat-card metric-card ${activeFilter === "today" ? "active" : ""}`}>
          <button className="metric-button" type="button" onClick={() => setActiveFilter("today")}>
          <p className="stat-label">Today</p>
          <p className="stat-value">{totalToday}</p>
          </button>
          <button 
            className="view-details-btn"
            type="button"
            onClick={() => setActiveFilter("today")}
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
            onClick={() => setActiveFilter("week")}
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
            onClick={() => setActiveFilter("month")}
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
            onClick={() => setActiveFilter("all")}
          >
            View Details
          </button>
        </article>
      </section>
    </main>
  );
}

export default DashboardPage;
