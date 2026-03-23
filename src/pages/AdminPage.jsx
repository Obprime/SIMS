import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const BRANCHES = [
  "AGONA",
  "BAKAEKYIR",
  "ELUBO",
  "AXIM",
  "ESIAMA",
  "VOL-MAGT",
  "TYPE-C",
  "KOJOKROM",
  "ANAJI-K",
  "MPOHOR",
];

const PAGE_SIZE = 10;
const ALL_BRANCHES = "ALL_BRANCHES";

function AdminPage() {
  const { user, role, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeBranch, setActiveBranch] = useState(ALL_BRANCHES);
  const [loadingId, setLoadingId] = useState(null);
  const [savingCommentId, setSavingCommentId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [useRange, setUseRange] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exactDate, setExactDate] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const q = query(collection(db, "Sims_reports"), orderBy("submittedAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const loadUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    };

    loadUsers();

    return unsub;
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeBranch, exactDate, fromDate, toDate, useRange]);

  const parseSubmittedAt = useCallback((report) => {
    const value = report?.submittedAt;
    if (!value) {
      return null;
    }

    if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
      const timestampDate = value.toDate();
      return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }, []);

  const isToday = useCallback(
    (report) => {
      const date = parseSubmittedAt(report);
      if (!date) {
        return false;
      }

      return date.toDateString() === new Date().toDateString();
    },
    [parseSubmittedAt]
  );

  const isThisMonth = useCallback(
    (report) => {
      const date = parseSubmittedAt(report);
      if (!date) {
        return false;
      }

      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    },
    [parseSubmittedAt]
  );

  const isExactDate = useCallback(
    (report) => {
      if (!exactDate) {
        return true;
      }

      const date = parseSubmittedAt(report);
      if (!date) {
        return false;
      }

      const [year, month, day] = exactDate.split("-").map(Number);
      return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      );
    },
    [exactDate, parseSubmittedAt]
  );

  const isInRange = useCallback(
    (report) => {
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
    },
    [fromDate, toDate, parseSubmittedAt]
  );

  const deleteReport = async (id) => {
    const shouldDelete = window.confirm("Are you sure you want to delete this report?");
    if (!shouldDelete) {
      return;
    }

    try {
      setLoadingId(id);
      await deleteDoc(doc(db, "Sims_reports", id));
      setReports((prev) => prev.filter((entry) => entry.id !== id));
    } finally {
      setLoadingId(null);
    }
  };

  const saveComment = async (id, existingComment) => {
    const draft = (commentDrafts[id] ?? existingComment ?? "").trim();

    try {
      setSavingCommentId(id);
      await updateDoc(doc(db, "Sims_reports", id), {
        managerComment: draft,
        managerCommentBy: user.email,
        managerCommentedAt: new Date().toISOString(),
      });

      setCommentDrafts((prev) => ({
        ...prev,
        [id]: draft,
      }));
    } finally {
      setSavingCommentId(null);
    }
  };

  const reportsByAgent = useMemo(() => {
    const usersByUid = new Map();
    users.forEach((item) => {
      usersByUid.set(item.id, item);
    });

    const grouped = new Map();
    reports.forEach((item) => {
      const key = item.submittedByUid || item.submittedByEmail || "unknown";
      const displayName = usersByUid.get(item.submittedByUid)?.name || item.submittedByEmail || "Unknown Agent";
      const current = grouped.get(key) || { name: displayName, count: 0 };
      current.count += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [reports, users]);

  const totalToday = useMemo(() => reports.filter(isToday).length, [reports, isToday]);
  const totalMonth = useMemo(() => reports.filter(isThisMonth).length, [reports, isThisMonth]);

  const branchBaseReports = useMemo(() => {
    if (!activeBranch) {
      return [];
    }

    if (activeBranch === ALL_BRANCHES) {
      return reports;
    }

    return reports.filter((entry) => entry.branchId === activeBranch);
  }, [reports, activeBranch]);

  const branchSelectedReports = useMemo(() => {
    let filtered;
    if (useRange) {
      filtered = branchBaseReports.filter(isInRange);
    } else if (exactDate) {
      filtered = branchBaseReports.filter(isExactDate);
    } else {
      filtered = branchBaseReports.filter(isToday);
    }

    return filtered.sort((a, b) => {
      const dateA = parseSubmittedAt(a)?.getTime() || 0;
      const dateB = parseSubmittedAt(b)?.getTime() || 0;
      return dateB - dateA;
    });
  }, [
    activeBranch,
    branchBaseReports,
    exactDate,
    isExactDate,
    isInRange,
    isToday,
    parseSubmittedAt,
    useRange,
  ]);

  const branchSelectedCount = branchSelectedReports.length;

  const branchMonthCount = useMemo(
    () => branchBaseReports.filter(isThisMonth).length,
    [branchBaseReports, isThisMonth]
  );

  const branchAllCount = branchBaseReports.length;

  const tableData = branchSelectedReports;

  const totalPages = Math.ceil(tableData.length / PAGE_SIZE);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return tableData.slice(start, start + PAGE_SIZE);
  }, [page, tableData]);

  const exportToCSV = () => {
    if (!tableData.length) {
      window.alert("No data to export.");
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

    const rows = tableData.map((entry) => [
      entry.serialNumber || "",
      entry.customerName || "",
      entry.phoneNumber || "",
      entry.idNumber || "",
      entry.branchId || "",
      entry.submittedByEmail || "",
      entry.managerComment || "",
      parseSubmittedAt(entry)?.toLocaleString() || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((line) => line.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `${activeBranch || "all-branches"}-sim-reports.csv`;
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
          <p className="eyebrow">Manager Portal</p>
          <h1>Branch Operations Dashboard</h1>
          <p className="subtitle">Signed in as {profile?.name || user.email}</p>
          <p className="subtitle">
            <span className="role-pill">{role === "manager" || role === "gm" ? "MANAGER" : "ADMIN"}</span>
          </p>
          <p className="manager-indicator">Users: {users.length}</p>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button" onClick={() => navigate("/admin/reports-by-agent")}>
            Reports by Agent
          </button>
          <button className="btn ghost" type="button" onClick={() => navigate("/submit")}>
            Back to Submit
          </button>
          <button className="btn danger" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="stat-card">
          <p className="stat-label">Today Reports</p>
          <p className="stat-value">{totalToday}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Monthly Reports</p>
          <p className="stat-value">{totalMonth}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">All Time Total</p>
          <p className="stat-value">{reports.length}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Top Agent</p>
          <p className="stat-value small">{reportsByAgent[0]?.name || "-"}</p>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-head">
          <h2>Select Branch</h2>
        </div>
        <div className="branch-chip-row">
          <button
            key={ALL_BRANCHES}
            type="button"
            className={`branch-chip ${activeBranch === ALL_BRANCHES ? "active" : ""}`}
            onClick={() => setActiveBranch(ALL_BRANCHES)}
          >
            ALL_BRANCHES
          </button>
          {BRANCHES.map((branch) => (
            <button
              key={branch}
              type="button"
              className={`branch-chip ${activeBranch === branch ? "active" : ""}`}
              onClick={() => setActiveBranch(branch)}
            >
              {branch}
            </button>
          ))}
        </div>
      </section>

      {activeBranch ? (
        <section className="panel table-panel manager-filter-panel compact-filter-panel">
          <div className="panel-head">
            <h2>{activeBranch} Filters</h2>
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
      ) : null}

      {activeBranch ? (
        <section className="dashboard-grid">
          <article className="stat-card">
            <p className="stat-label">
              {activeBranch === ALL_BRANCHES ? "All Branches Selected Count" : `${activeBranch} Selected Count`}
            </p>
            <p className="stat-value">{branchSelectedCount}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">
              {activeBranch === ALL_BRANCHES ? "All Branches This Month" : `${activeBranch} This Month`}
            </p>
            <p className="stat-value">{branchMonthCount}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">
              {activeBranch === ALL_BRANCHES ? "All Branches All Time" : `${activeBranch} All Time`}
            </p>
            <p className="stat-value">{branchAllCount}</p>
          </article>
        </section>
      ) : null}

      <section className="panel table-panel">
        <div className="panel-head">
          <h2>
            {activeBranch === ALL_BRANCHES
              ? "Transactions for All Branches"
              : activeBranch
              ? `Transactions for ${activeBranch}`
              : "Select a branch to view transactions"}
          </h2>
          {activeBranch ? (
            <button className="btn ghost" type="button" onClick={exportToCSV}>
              Export CSV
            </button>
          ) : null}
        </div>

        {activeBranch ? <p className="helper">Delete action is available for manager cleanup.</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Serial Number</th>
                <th>Phone Number</th>
                <th>ID Number</th>
                <th>Branch</th>
                <th>Manager Comment</th>
                <th>Submitted At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!activeBranch ? (
                <tr className="empty-row">
                  <td colSpan="8">Select a branch to show records.</td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="8">No records found for selected filter.</td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.id}>
                    <td>{item.customerName}</td>
                    <td>{item.serialNumber}</td>
                    <td>{item.phoneNumber}</td>
                    <td>{item.idNumber}</td>
                    <td>{item.branchId || "-"}</td>
                    <td>
                      <div className="comment-cell">
                        <input
                          type="text"
                          value={commentDrafts[item.id] ?? item.managerComment ?? ""}
                          onChange={(event) =>
                            setCommentDrafts((prev) => ({
                              ...prev,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="Add manager comment"
                        />
                        <button
                          type="button"
                          className="btn ghost small"
                          disabled={savingCommentId === item.id}
                          onClick={() => saveComment(item.id, item.managerComment || "")}
                        >
                          {savingCommentId === item.id ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </td>
                    <td>{parseSubmittedAt(item)?.toLocaleString() || "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn danger small"
                        disabled={loadingId === item.id}
                        onClick={() => deleteReport(item.id)}
                      >
                        {loadingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {activeBranch && totalPages > 1 ? (
          <div className="pager-row">
            <button
              className="btn ghost"
              type="button"
              disabled={page === 1}
              onClick={() => setPage((prev) => prev - 1)}
            >
              Prev
            </button>

            <span className="subtitle">
              Page {page} of {totalPages}
            </span>

            <button
              className="btn ghost"
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default AdminPage;
