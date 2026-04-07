import { toAuthApiUrl } from "@/lib/api-config";

export function clearLocalSessionState() {
  localStorage.removeItem("token");
  localStorage.removeItem("fullname");
  localStorage.removeItem("roles");
  localStorage.removeItem("me");
}

export function storeLocalSessionIdentity({ fullName = "", roles = [] } = {}) {
  const normalizedRoles = Array.isArray(roles) ? roles : [];
  const normalizedName = String(
    fullName || localStorage.getItem("fullname") || "",
  ).trim();

  localStorage.removeItem("token");
  localStorage.setItem("fullname", normalizedName);
  localStorage.setItem("roles", JSON.stringify(normalizedRoles));
  localStorage.setItem(
    "me",
    JSON.stringify({
      fullname: normalizedName,
      roles: normalizedRoles,
    }),
  );
}

export async function signOutAndRedirect(redirectTo = "/login") {
  try {
    await fetch(toAuthApiUrl("/signout"), {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore sign-out network failures; local cleanup still runs.
  } finally {
    clearLocalSessionState();
    window.location.href = redirectTo;
  }
}
