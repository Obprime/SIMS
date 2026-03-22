import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

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

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("branch");
  const [branchId, setBranchId] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState("light");

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const nextPath = location.state?.from;

  const goToRoleDashboard = (profileRole) => {
    if (nextPath) {
      navigate(nextPath, { replace: true });
      return;
    }

    if (profileRole === "branch" || profileRole === "agent" || profileRole === "branch_head") {
      navigate("/branch/dashboard", { replace: true });
      return;
    }

    if (profileRole === "manager" || profileRole === "gm" || profileRole === "admin") {
      navigate("/manager/dashboard", { replace: true });
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (isRegister) {
        if (!name.trim() || !email.trim() || !password.trim()) {
          throw new Error("All fields are required.");
        }

        if (password.trim().length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }

        if (role !== "manager" && !branchId) {
          throw new Error("Please select a branch.");
        }

        const created = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());

        await setDoc(doc(db, "users", created.user.uid), {
          name: name.trim(),
          email: email.trim(),
          role,
          branchId: role === "manager" ? null : branchId,
          approved: true,
          createdAt: serverTimestamp(),
        });
      }

      const signedIn = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      const profileSnap = await getDoc(doc(db, "users", signedIn.user.uid));

      if (!profileSnap.exists()) {
        throw new Error("User profile not found.");
      }

      const profile = profileSnap.data();

      goToRoleDashboard(profile.role);
    } catch (err) {
      setError(err?.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`screen-center auth-shell ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <section className="auth-grid">
        <article className="auth-aside">
          <p className="eyebrow">Enterprise Collection Suite</p>
          <h1>SIM Registration Command Center</h1>
          <p className="auth-help">
            Secure access for agents and administrators to manage SIM registration intake,
            verification, and reporting analytics.
          </p>
          <button className="theme-toggle" type="button" onClick={toggleTheme}>
            {theme === "dark" ? "Switch Light" : "Switch Dark"}
          </button>
          <ul className="meta-list">
            <li>Real-time barcode capture workflow</li>
            <li>Role-based access control</li>
            <li>Live operational dashboard</li>
          </ul>
        </article>

        <article className="auth-card">
          <p className="eyebrow">Authorized Access</p>
          <h2>{isRegister ? "Create Account" : "Sign In"}</h2>

          <form onSubmit={onSubmit}>
            {isRegister ? (
              <>
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </>
            ) : null}

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="password">Password</label>
            <div className="password-row">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {isRegister ? (
              <>
                <p className="helper">Select role for this account</p>
                <div className="role-grid">
                  <RoleCard
                    label="Branch User"
                    value="branch"
                    role={role}
                    setRole={setRole}
                  />
                  <RoleCard
                    label="Manager"
                    value="manager"
                    role={role}
                    setRole={setRole}
                  />
                </div>

                {role !== "manager" ? (
                  <>
                    <label htmlFor="branchSelect">Branch</label>
                    <select
                      id="branchSelect"
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      required
                    >
                      <option value="">Select Branch</option>
                      {BRANCHES.map((branch) => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
              </>
            ) : null}

            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
            </button>

            {error ? <p className="form-message error">{error}</p> : null}
          </form>

          <button
            className="auth-switch"
            type="button"
            onClick={() => {
              setError("");
              setIsRegister((v) => !v);
            }}
          >
            {isRegister ? "Already have an account? Sign In" : "Create new user account"}
          </button>
        </article>
      </section>
    </main>
  );
}

function RoleCard({ label, value, role, setRole }) {
  const active = role === value;

  return (
    <button
      type="button"
      onClick={() => setRole(value)}
      className={`role-card ${active ? "active" : ""}`}
    >
      {label}
    </button>
  );
}

export default LoginPage;
