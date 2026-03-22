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

  const exportFilteredReports = () => {
    if (!filteredReports.length) {
      window.alert("No reports available for the selected filter.");
      return;
    }

    const headers = [
      "Serial Number",
      "Customer Name",
      "Phone Number",
      "ID Number",
      "Branch",
      "Agent",
      "Manager Comment",
      "Submitted At",
    ];

    const rows = filteredReports.map((entry) => [
      entry.serialNumber || "",
      entry.customerName || "",
      entry.phoneNumber || "",
      entry.idNumber || "",
      entry.branchId || "",
      entry.submittedByEmail || "",
      entry.managerComment || "",
      new Date(entry.submittedAt).toLocaleString(),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((line) => line.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `${activeFilter}-reports.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

      <section className="identity-grid">
        <article className="panel identity-card">
          <p className="stat-label">Agent Name</p>
          <p className="stat-value small">{profile?.name || user.email}</p>
        </article>
        <article className="panel identity-card">
          <p className="stat-label">Branch Name</p>
          <p className="stat-value small">{profile?.branchId || "Manager Access"}</p>
        </article>
      </section>

      <section className="dashboard-grid metrics-grid">
        <article className={`stat-card metric-card ${activeFilter === "today" ? "active" : ""}`}>
          <button className="metric-button" type="button" onClick={() => setActiveFilter("today")}>
          <p className="stat-label">Today</p>
          <p className="stat-value">{totalToday}</p>
          </button>
        </article>
        <article className={`stat-card metric-card ${activeFilter === "week" ? "active" : ""}`}>
          <button className="metric-button" type="button" onClick={() => setActiveFilter("week")}>
          <p className="stat-label">This Week</p>
          <p className="stat-value">{totalWeek}</p>
          </button>
        </article>
        <article className={`stat-card metric-card ${activeFilter === "month" ? "active" : ""}`}>
          <button className="metric-button" type="button" onClick={() => setActiveFilter("month")}>
          <p className="stat-label">This Month</p>
          <p className="stat-value">{totalMonth}</p>
          </button>
        </article>
        <article className={`stat-card metric-card ${activeFilter === "all" ? "active" : ""}`}>
          <button className="metric-button" type="button" onClick={() => setActiveFilter("all")}>
          <p className="stat-label">All Time</p>
          <p className="stat-value">{scopedReports.length}</p>
          </button>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-head">
          <h2>Filtered Reports</h2>
          <button className="btn ghost" type="button" onClick={exportFilteredReports}>
            Download CSV
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Serial Number</th>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>ID Number</th>
                <th>Agent</th>
                <th>Manager Comment</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="8">No reports submitted yet.</td>
                </tr>
              ) : (
                filteredReports.slice(0, 50).map((entry, index) => (
                  <tr key={entry.id}>
                    <td>{index + 1}</td>
                    <td>{entry.serialNumber}</td>
                    <td>{entry.customerName}</td>
                    <td>{entry.phoneNumber}</td>
                    <td>{entry.idNumber}</td>
                    <td>{entry.submittedByEmail || "-"}</td>
                    <td>{entry.managerComment || "-"}</td>
                    <td>{new Date(entry.submittedAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
