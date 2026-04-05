const FIRST_LOGIN_PASSWORD_CHANGE_STORAGE_KEY = "sms:first-login-password-change";

export function saveFirstLoginPasswordChangeContext(data = {}) {
  if (typeof window === "undefined") return;
  const payload = {
    fullName: String(data?.fullName || "").trim(),
    empcode: Number(data?.empcode || 0) || null,
    mobileno: String(data?.mobileno || "").trim(),
    passwordChangeToken: String(data?.passwordChangeToken || "").trim(),
    expiresInSeconds: Number(data?.expiresInSeconds || 0) || null,
  };

  window.sessionStorage.setItem(
    FIRST_LOGIN_PASSWORD_CHANGE_STORAGE_KEY,
    JSON.stringify(payload),
  );
}

export function readFirstLoginPasswordChangeContext() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(FIRST_LOGIN_PASSWORD_CHANGE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearFirstLoginPasswordChangeContext() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(FIRST_LOGIN_PASSWORD_CHANGE_STORAGE_KEY);
}
