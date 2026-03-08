import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";

function getInitialConnectionState() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

const PROBE_URLS = [
  "https://api.ipify.org?format=json",
  "https://jsonplaceholder.typicode.com/todos/1",
];
const PROBE_TIMEOUT_MS = 4000;
const PROBE_INTERVAL_MS = 5000;
const FAST_RECHECK_INTERVAL_MS = 1200;
const FAST_PROBE_TIMEOUT_MS = 1600;

async function probeInternetOnce(timeoutMs = PROBE_TIMEOUT_MS) {
  const probe = async (url, ms) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    await Promise.any(
      PROBE_URLS.map(async (url) => {
        const ok = await probe(url, timeoutMs);
        if (!ok) throw new Error("Probe failed");
        return true;
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export default function NetworkOfflineOverlay() {
  const [hasInternet, setHasInternet] = useState(getInitialConnectionState);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.round(PROBE_INTERVAL_MS / 1000),
  );
  const checkingRef = useRef(false);
  const hasInternetRef = useRef(getInitialConnectionState());

  useEffect(() => {
    let mounted = true;
    const fullCycleSeconds = Math.max(1, Math.round(PROBE_INTERVAL_MS / 1000));
    let fastRecheckTimer = null;

    const updateInternetState = (next) => {
      hasInternetRef.current = next;
      setHasInternet(next);
    };

    const stopFastRecheck = () => {
      if (fastRecheckTimer) {
        clearInterval(fastRecheckTimer);
        fastRecheckTimer = null;
      }
    };

    const startFastRecheck = () => {
      if (fastRecheckTimer) return;
      fastRecheckTimer = window.setInterval(() => {
        refreshConnectivity(true);
      }, FAST_RECHECK_INTERVAL_MS);
    };

    const refreshConnectivity = async (quick = false) => {
      if (!mounted || checkingRef.current) return;

      if (!navigator.onLine) {
        updateInternetState(false);
        startFastRecheck();
        return;
      }

      checkingRef.current = true;
      try {
        const reachable = await probeInternetOnce(
          quick ? FAST_PROBE_TIMEOUT_MS : PROBE_TIMEOUT_MS,
        );
        if (mounted) {
          updateInternetState(reachable);
          if (reachable) {
            stopFastRecheck();
          } else {
            startFastRecheck();
          }
        }
      } finally {
        checkingRef.current = false;
      }
    };

    const onOnline = () => {
      setSecondsLeft(fullCycleSeconds);
      refreshConnectivity();
    };

    const onOffline = () => {
      updateInternetState(false);
      startFastRecheck();
      setSecondsLeft(fullCycleSeconds);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    refreshConnectivity();
    setSecondsLeft(fullCycleSeconds);

    const countdownTimer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (!hasInternetRef.current) {
          // While offline, probe faster so reconnect hides overlay quickly.
          refreshConnectivity(true);
        }
        if (prev <= 1) {
          refreshConnectivity();
          return fullCycleSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(countdownTimer);
      stopFastRecheck();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (hasInternet) return null;

  return (
    <div className="fixed inset-0 z-[9999] print:hidden">
      <div className="absolute inset-0 bg-slate-100/70 backdrop-blur-sm" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.22),transparent_58%),radial-gradient(circle_at_bottom,_rgba(203,213,225,0.3),transparent_55%)]" />

      <div className="relative flex h-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white/80 backdrop-blur-md ring-1 ring-slate-200/80 shadow-[0_18px_40px_rgba(15,23,42,0.14)] p-6 text-center">
          <div className="relative mx-auto mb-2 h-32 w-32 rounded-xl bg-gradient-to-br from-sky-50 via-white to-indigo-50 ring-1 ring-slate-200/70 p-2 overflow-hidden">
            <span className="absolute inset-3 rounded-full border-2 border-sky-200/70 animate-ping [animation-duration:2.2s]" />
            <span className="absolute inset-7 rounded-full border-2 border-sky-300/70 animate-ping [animation-duration:2.2s] [animation-delay:350ms]" />
            <span className="absolute inset-11 rounded-full border-2 border-sky-400/70 animate-ping [animation-duration:2.2s] [animation-delay:700ms]" />

            <div className="absolute inset-0 grid place-items-center">
              <div className="relative">
                <WifiOff className="h-11 w-11 text-sky-600 drop-shadow-sm animate-pulse" />
                {/* <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-sky-500 animate-bounce" /> */}
              </div>
            </div>
          </div>

          <p className="text-lg font-semibold text-slate-900">
            No Internet Connection
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Waiting for network. Page will resume automatically when internet is
            back.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {/* Auto-check every {Math.round(PROBE_INTERVAL_MS / 1000)}s ({secondsLeft}s) */}
            Auto-check every {secondsLeft}s
          </p>

          <div className="mt-5 flex items-center justify-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full bg-sky-500 animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="h-2.5 w-2.5 rounded-full bg-sky-400 animate-bounce"
              style={{ animationDelay: "120ms" }}
            />
            <span
              className="h-2.5 w-2.5 rounded-full bg-sky-300 animate-bounce"
              style={{ animationDelay: "240ms" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
