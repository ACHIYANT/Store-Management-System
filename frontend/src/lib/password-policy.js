export const PASSWORD_POLICY_RULES = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (value) => String(value || "").length >= 8,
  },
  {
    id: "mixed-case",
    label: "Uppercase and lowercase letters",
    test: (value) =>
      /[A-Z]/.test(String(value || "")) && /[a-z]/.test(String(value || "")),
  },
  {
    id: "number",
    label: "At least one number",
    test: (value) => /\d/.test(String(value || "")),
  },
  {
    id: "special",
    label: "At least one special character",
    test: (value) => /[@$!%*#?&]/.test(String(value || "")),
  },
];

export function getPasswordRuleStates(value) {
  return PASSWORD_POLICY_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(value),
  }));
}

export function isPasswordPolicyCompliant(value) {
  return getPasswordRuleStates(value).every((rule) => rule.passed);
}
