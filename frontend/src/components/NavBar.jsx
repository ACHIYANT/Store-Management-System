import logo from "/logo.svg";
import govt from "/govt.svg";
import { useEffect, useState } from "react";
import { ExitIcon } from "@radix-ui/react-icons";
import { Link } from "react-router-dom";

export default function NavBar() {
  const [userName, setUserName] = useState("Login Name");

  useEffect(() => {
    const storedUser = localStorage.getItem("fullname");
    if (storedUser) {
      setUserName(storedUser);
    }
  }, []);

  const handleLogout = () => {
    const AUTH_API =
      import.meta.env.VITE_AUTH_API_URL || "http://localhost:3001/api/v1";
    fetch(`${AUTH_API}/signout`, {
      method: "POST",
      credentials: "include",
    })
      .catch(() => {
        // Ignore sign-out network failures; local cleanup still runs.
      })
      .finally(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("fullname");
        localStorage.removeItem("roles");
        localStorage.removeItem("me");
        window.location.href = "/login";
      });
  };

  return (
    <header className="no-print print:hidden border-b border-slate-200/70 bg-card/95 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[2400px] flex-wrap items-center gap-2 px-2 py-2 sm:px-4 sm:py-3 lg:px-6 min-[1920px]:px-10 min-[2560px]:px-14">
        <Link
          to="/homepage"
          className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"
        >
          <img
            src={logo}
            alt="Store Management Logo"
            className="h-8 w-auto shrink-0 sm:h-10"
          />
          <div className="h-7 border-l-2 border-slate-200 sm:h-8" />
          <img
            src={govt}
            alt="Government Logo"
            className="h-8 w-auto shrink-0 sm:h-10"
          />
        </Link>

        <div className="ml-auto flex flex-none items-center gap-2 rounded-lg border border-slate-200/70 bg-white/80 px-2 py-1.5 sm:px-3">
          <span className="hidden max-w-[38vw] truncate text-xs text-slate-600 sm:inline sm:text-sm">
            {userName}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 sm:text-sm"
            onClick={handleLogout}
          >
            <ExitIcon />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
