"use strict";

const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

const PASSWORD_POLICY_MESSAGE =
  "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character";

const PASSWORD_POLICY_HINT =
  "Use at least 8 characters with uppercase, lowercase, number, and special character.";

const isPasswordPolicyCompliant = (password) =>
  PASSWORD_POLICY_REGEX.test(String(password || ""));

module.exports = {
  PASSWORD_POLICY_HINT,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
  isPasswordPolicyCompliant,
};
