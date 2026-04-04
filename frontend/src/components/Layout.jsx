import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/NavBar";
import PopupMessage from "@/components/PopupMessage";
import AppFooter from "@/components/AppFooter";

export default function Layout() {
  const [apiError, setApiError] = useState({
    open: false,
    message: "",
    moveTo: "",
    diagnostic: null,
  });

  useEffect(() => {
    const handleApiError = (event) => {
      const status = Number(event?.detail?.status || 0);
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (status === 0) return;
      const message =
        event?.detail?.message || "Something went wrong while processing request.";
      const shouldForceLogout = Boolean(event?.detail?.forceLogout);
      const redirectTo = String(event?.detail?.redirectTo || "/login");
      setApiError({
        open: true,
        message,
        moveTo: shouldForceLogout ? redirectTo : "",
        diagnostic: event?.detail?.diagnostic || null,
      });
    };

    window.addEventListener("sms:api-error", handleApiError);
    return () => {
      window.removeEventListener("sms:api-error", handleApiError);
    };
  }, []);

  return (
    <div className="flex h-screen min-h-screen flex-col bg-slate-50/40">
      <header className="shrink-0">
        <Navbar />
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full min-h-0 overflow-hidden bg-white/70 backdrop-blur-xl shadow-[inset_-1px_0_0_rgba(15,23,42,0.06)] md:block md:w-[clamp(14rem,16vw,20rem)] min-[1920px]:w-[22rem] print:hidden">
          <Sidebar />
        </aside>

        <div className="min-w-0 flex min-h-0 flex-1 flex-col">
          <div className="min-w-0 flex-1 overflow-y-auto print:overflow-visible">
            <div className="mx-auto flex w-full max-w-[2400px] flex-col px-2 py-2 sm:px-4 sm:py-3 lg:px-6 min-[1920px]:px-10 min-[2560px]:px-14">
              <div className="md:hidden print:hidden">
                <Sidebar />
              </div>
              <main className="min-w-0">
                <Outlet />
              </main>
            </div>
          </div>
          <AppFooter />
        </div>
      </div>
      <PopupMessage
        open={apiError.open}
        type="error"
        message={apiError.message}
        moveTo={apiError.moveTo}
        diagnostic={apiError.diagnostic}
        onClose={() =>
          setApiError({ open: false, message: "", moveTo: "", diagnostic: null })
        }
      />
    </div>
  );
}
