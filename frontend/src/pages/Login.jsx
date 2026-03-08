import { useState } from "react";
import { motion as Motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import PopupMessage from "@/components/PopupMessage";

import logo from "/logo.svg";
import govt from "/govt.svg";

const AUTH_API =
  import.meta.env.VITE_AUTH_API_URL || "http://localhost:3001/api/v1";

const parseApiMessage = async (response, fallbackMessage) => {
  try {
    const payload = await response.clone().json();
    return (
      payload?.message ||
      payload?.err?.message ||
      payload?.data?.message ||
      fallbackMessage
    );
  } catch {
    try {
      const text = await response.text();
      return text || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }
};

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [mobileno, setMobileNo] = useState("");
  const [password, setPassword] = useState("");
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
    moveTo: "",
  });

  const showPopup = ({ type = "info", message = "", moveTo = "" }) => {
    setPopup({ open: true, type, message, moveTo });
  };

  const handleLogin = async () => {
    const mobileValue = mobileno.trim();
    const passwordValue = password;

    if (!mobileValue || !passwordValue) {
      showPopup({
        type: "warning",
        message: "Please enter both mobile number and password.",
      });
      return;
    }

    setLoading(true);

    const formData = new URLSearchParams();
    formData.append("mobileno", mobileValue);
    formData.append("password", passwordValue);

    try {
      const response = await fetch(`${AUTH_API}/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        credentials: "include",
        body: formData.toString(),
      });

      if (!response.ok) {
        const message = await parseApiMessage(
          response,
          "Login failed. Please check your credentials.",
        );
        showPopup({
          type: "error",
          message,
        });
        return;
      }

      const data = await response.json();

      if (data.success && data.data) {
        const roles = Array.isArray(data?.data?.roles) ? data.data.roles : [];

        localStorage.removeItem("token");
        localStorage.setItem("fullname", data.data.fullName || "");
        localStorage.setItem("roles", JSON.stringify(roles));
        localStorage.setItem(
          "me",
          JSON.stringify({
            fullname: data.data.fullName || "",
            roles,
          }),
        );

        showPopup({
          type: "success",
          message: `Welcome back${data.data.fullName ? `, ${data.data.fullName}` : ""}.`,
          moveTo: "/homepage",
        });
        return;
      }

      showPopup({
        type: "error",
        message: "Invalid login. Please try again.",
      });
    } catch (error) {
      console.error("Login Error:", error);
      showPopup({
        type: "error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-96 rounded-2xl shadow-lg">
          <CardContent className="space-y-6 p-6">
            <div className="flex justify-center">
              <img src={logo} alt="HARTRON Logo" width={100} height={50} />
              <img src={govt} alt="Govt Logo" width={250} height={150} />
            </div>
            <h2 className="text-center text-2xl font-semibold text-gray-700">
              Welcome to HARTRON Store
            </h2>
            <Input
              type="text"
              placeholder="Mobile No"
              className="p-3"
              value={mobileno}
              onChange={(e) => setMobileNo(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              className="p-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              className="w-full bg-blue-600 py-3 text-white hover:bg-blue-700"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : "Login"}
            </Button>
            <div className="space-y-0">
              <p className="text-center text-sm text-gray-500">
                Forgot your password?{" "}
                <a href="/reset-pwd" className="text-blue-600">
                  Reset here
                </a>
              </p>
              <p className="text-center text-sm text-gray-500">
                New to Hartron Store?{" "}
                <a href="/sign-up" className="text-blue-600">
                  Join Here
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </Motion.div>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        moveTo={popup.moveTo}
        onClose={() =>
          setPopup({ open: false, type: "info", message: "", moveTo: "" })
        }
      />
    </div>
  );
}
