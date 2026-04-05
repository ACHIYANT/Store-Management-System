import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import PopupMessage from "@/components/PopupMessage";
import { toAuthApiUrl } from "@/lib/api-config";
import {
  clearFirstLoginPasswordChangeContext,
  saveFirstLoginPasswordChangeContext,
} from "@/lib/auth-password-change";
import { buildDiagnosticPresentation, buildDisplayMessage } from "@/lib/network";

import logo from "/logo.svg";
import govt from "/govt.svg";

const parseApiFeedback = async (response, fallbackMessage) => {
  try {
    const payload = await response.clone().json();
      return buildDiagnosticPresentation(
        {
          status: Number(response?.status || 0),
          url: toAuthApiUrl("/signin"),
          code: payload?.code || payload?.err?.code,
        message: payload?.message || payload?.err?.message || payload?.data?.message,
        hint: payload?.hint,
        requestId: payload?.requestId || response.headers.get("x-request-id"),
        details: payload?.details,
      },
        fallbackMessage,
      );
    } catch {
    try {
      const text = await response.text();
      return {
        message: text || fallbackMessage,
        diagnostic: null,
      };
    } catch {
      return {
        message: fallbackMessage,
        diagnostic: null,
      };
    }
  }
};

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mobileno, setMobileNo] = useState("");
  const [password, setPassword] = useState("");
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
    moveTo: "",
    diagnostic: null,
  });

  const showPopup = ({ type = "info", message = "", moveTo = "", diagnostic = null }) => {
    setPopup({ open: true, type, message, moveTo, diagnostic });
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
      const response = await fetch(toAuthApiUrl("/signin"), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        credentials: "include",
        body: formData.toString(),
      });

      if (!response.ok) {
        const feedback = await parseApiFeedback(
          response,
          "Login failed. Please check your credentials.",
        );
        const payload = await response.clone().json().catch(() => ({}));
        const responseCode =
          payload?.code ||
          payload?.err?.code ||
          feedback?.detail?.code ||
          "";
        const responseData = payload?.data && typeof payload.data === "object" ? payload.data : {};

        if (
          String(responseCode).trim().toUpperCase() === "PASSWORD_CHANGE_REQUIRED" &&
          String(responseData?.passwordChangeToken || "").trim()
        ) {
          localStorage.removeItem("token");
          localStorage.removeItem("fullname");
          localStorage.removeItem("roles");
          localStorage.removeItem("me");
          saveFirstLoginPasswordChangeContext({
            ...responseData,
            mobileno: mobileValue,
          });
          navigate("/reset-pwd", { replace: true });
          return;
        }

        showPopup({
          type: "error",
          message: feedback.message,
          diagnostic: feedback.diagnostic,
        });
        return;
      }

      const data = await response.json();

      if (data.success && data.data) {
        const roles = Array.isArray(data?.data?.roles) ? data.data.roles : [];
        clearFirstLoginPasswordChangeContext();

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
      const fallbackDetail = buildDiagnosticPresentation(
        {
          status: 0,
          url: toAuthApiUrl("/signin"),
          message: buildDisplayMessage(
            { status: 0, url: toAuthApiUrl("/signin") },
            "Something went wrong. Please try again.",
          ),
        },
        "Something went wrong. Please try again.",
      );
      showPopup({
        type: "error",
        message: fallbackDetail.message,
        diagnostic: fallbackDetail.diagnostic,
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
        diagnostic={popup.diagnostic}
        onClose={() =>
          setPopup({
            open: false,
            type: "info",
            message: "",
            moveTo: "",
            diagnostic: null,
          })
        }
      />
    </div>
  );
}
