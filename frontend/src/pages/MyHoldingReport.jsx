import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import loaderVideo from "../assets/Paperplane.webm";
import { fetchMyProfile } from "@/lib/profile-api";

export default function MyHoldingReport() {
  const [targetPath, setTargetPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const resolveProfile = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const profile = await fetchMyProfile();
      const employeeId =
        profile?.employee?.emp_id || profile?.account?.empcode || null;

      if (!employeeId) {
        setErrorMessage(
          "Your employee profile could not be resolved for the holding report.",
        );
        return;
      }

      setTargetPath(
        `/reports/employee-issues/${encodeURIComponent(
          employeeId,
        )}/statement?mode=CURRENT&self=1`,
      );
    } catch (error) {
      console.error("Failed to resolve current user holding report:", error);
      setErrorMessage("Unable to open your holding report right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    resolveProfile();
  }, [resolveProfile]);

  if (targetPath) {
    return <Navigate to={targetPath} replace />;
  }

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <video
          src={loaderVideo}
          autoPlay
          loop
          muted
          playsInline
          className="h-40 w-40"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">
        Current Holding Report
      </h1>
      <p className="mt-2 text-sm text-slate-600">{errorMessage}</p>
      <button
        type="button"
        onClick={resolveProfile}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Retry
      </button>
    </div>
  );
}
