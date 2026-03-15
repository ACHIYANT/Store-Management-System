const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toUpperCase();

export const getCurrentUserRoles = () => {
  if (typeof window === "undefined") return [];

  const fromLocalRoles = (() => {
    const raw = localStorage.getItem("roles");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [raw];
    }
  })();

  if (fromLocalRoles.length) {
    return Array.from(new Set(fromLocalRoles.map(normalizeRole).filter(Boolean)));
  }

  try {
    const me = JSON.parse(localStorage.getItem("me") || "null");
    const raw = Array.isArray(me?.roles)
      ? me.roles
      : me?.roles
        ? [me.roles]
        : [];
    return Array.from(new Set(raw.map(normalizeRole).filter(Boolean)));
  } catch {
    return [];
  }
};

export const hasRole = (role) => {
  const target = normalizeRole(role);
  return getCurrentUserRoles().includes(target);
};

