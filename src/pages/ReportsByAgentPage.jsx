import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function ReportsByAgentPage() {
  const { user, role, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [useRange, setUseRange] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exactDate, setExactDate] = useState("");

  useEffect(() => {
    const reportsQuery = query(collection(db, "reports"), orderBy("submittedAt", "desc"));
    const usersQuery = query(collection(db, "users"));

    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    return () => {
      unsubReports();
      unsubUsers();
    };
  }, []);

  const usersByUid = useMemo(() => {
    const mapped = new Map();
    users.forEach((item) => {
      mapped.set(item.id, item);
    });
    return mapped;
  }, [users]);

  const parseSubmittedAt = (report) => {
    if (!report?.submittedAt) {
      return null;
    }

    const date = new Date(report.submittedAt);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const isExactDate = (report) => {
    if (!exactDate) {
      return true;
    }

    const date = parseSubmittedAt(report);
    if (!date) {
      return false;
    }

    const [year, month, day] = exactDate.split("-").map(Number);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };

  const isInRange = (report) => {
    if (!fromDate || !toDate) {
      return true;
    }

    const date = parseSubmittedAt(report);
    if (!date) {
      return false;
    }

    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    return date >= start && date <= end;
  };

  const filteredReports = useMemo(() => {
    if (useRange) {
      return reports.filter(isInRange);
    }

    return reports.filter(isExactDate);
  }, [exactDate, fromDate, reports, toDate, useRange]);

  const reportsByAgent = useMemo(() => {
    const grouped = new Map();
    filteredReports.forEach((item) => {
      const agentUid = item.submittedByUid || item.submittedByEmail || "unknown";
      const profileData = usersByUid.get(item.submittedByUid);
      const agentName = profileData?.name || item.submittedByEmail || "Unknown Agent";
      const entry = grouped.get(agentUid) || {
        name: agentName,
        count: 0,
      };

      entry.count += 1;
      grouped.set(agentUid, entry);
    });

    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [filteredReports, usersByUid]);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <main className="app-shell">
      <header className="topbar panel">
        <div>
          <p className="eyebrow">Manager Portal</p>
          <h1>Reports by Agent</h1>
          <p className="subtitle">Signed in as {profile?.name || user.email}</p>
          <p className="subtitle">
            <span className="role-pill">{role === "manager" || role === "gm" ? "MANAGER" : "ADMIN"}</span>
          </p>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button" onClick={() => navigate("/admin")}>
            Back to Dashboard
          </button>
          <button className="btn danger" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="panel table-panel">
        <div className="panel-head">
          <h2>Date Filter</h2>
        </div>
        <div className="filter-grid filter-grid-modern">
          <label className="toggle-row filter-toggle-chip">
            <input
              type="checkbox"
              checked={useRange}
              onChange={(event) => {
                setUseRange(event.target.checked);
                setExactDate("");
              }}
            />
            Use Date Range
          </label>

          {useRange ? (
            <div className="date-row date-row-modern">
              <div className="date-input-stack">
                <span className="date-input-label">From</span>
                <input
                  type="date"
                  value={fromDate}
                  placeholder="mm/dd/yyyy"
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <span className="date-separator">to</span>
              <div className="date-input-stack">
                <span className="date-input-label">To</span>
                <input
                  type="date"
                  value={toDate}
                  placeholder="mm/dd/yyyy"
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="date-row date-row-modern">
              <div className="date-input-stack">
                <span className="date-input-label">Date</span>
                <input
                  type="date"
                  value={exactDate}
                  placeholder="mm/dd/yyyy"
                  onChange={(e) => setExactDate(e.target.value)}
                />
              </div>
              <span className="date-separator">Exact date filter</span>
            </div>
          )}
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-head">
          <h2>Reports by Agent</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Agent Name</th>
                <th>Total Reports</th>
              </tr>
            </thead>
            <tbody>
              {reportsByAgent.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="3">No data yet.</td>
                </tr>
              ) : (
                reportsByAgent.map((item, idx) => (
                  <tr key={`${item.name}-${idx}`}>
                    <td>{idx + 1}</td>
                    <td>{item.name}</td>
                    <td>{item.count}</td>
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

export default ReportsByAgentPage;
