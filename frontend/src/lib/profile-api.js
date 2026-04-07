import axios from "axios";

import { toAuthApiUrl, toStoreApiUrl } from "@/lib/api-config";

export async function fetchMyProfile() {
  const response = await axios.get(toStoreApiUrl("/profile/me"));
  return response?.data?.data || null;
}

export async function changeMyPassword({
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  const response = await axios.post(toAuthApiUrl("/password/change"), {
    currentPassword,
    newPassword,
    confirmPassword,
  });

  return response?.data || null;
}
