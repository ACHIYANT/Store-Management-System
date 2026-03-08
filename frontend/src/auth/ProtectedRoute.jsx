// src/auth/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ user, anyOf = [], children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (anyOf.length && !anyOf.some((r) => (user.roles || []).includes(r))) {
    return (
      <div className="p-6 text-red-600">
        You don’t have access to this page.
      </div>
    );
  }
  return children;
}
