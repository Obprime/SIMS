import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AdminRoute({ children }) {
  const { user, role } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "admin" && role !== "gm" && role !== "manager") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default AdminRoute;
