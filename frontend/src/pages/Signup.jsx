import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import PopupMessage from "@/components/PopupMessage";

import logo from "/logo.svg";
import govt from "/govt.svg";

import { SelectScrollable } from "@/components/SelectScrollable";

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

export default function Signup() {
  const [loading, setLoading] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [designation, setDesignation] = useState("");
  const [division, setDivision] = useState("");
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
    moveTo: "",
  });

  const showPopup = ({ type = "info", message = "", moveTo = "" }) => {
    setPopup({ open: true, type, message, moveTo });
  };

  const handleSignup = async () => {
    const payload = {
      empcode: employeeCode.trim(),
      fullname: fullName.trim(),
      mobileno: mobileNumber.trim(),
      password,
      designation: designation.trim(),
      division: String(division || "").trim(),
    };

    if (
      !payload.empcode ||
      !payload.fullname ||
      !payload.mobileno ||
      !payload.password ||
      !payload.designation ||
      !payload.division
    ) {
      showPopup({
        type: "warning",
        message: "Please fill all required fields before signup.",
      });
      return;
    }

    setLoading(true);

    const formData = new URLSearchParams();
    formData.append("empcode", payload.empcode);
    formData.append("fullname", payload.fullname);
    formData.append("mobileno", payload.mobileno);
    formData.append("password", payload.password);
    formData.append("designation", payload.designation);
    formData.append("division", payload.division);

    try {
      const response = await fetch(`${AUTH_API}/signup`, {
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
          "Signup failed. Please verify your details and try again.",
        );
        showPopup({
          type: "error",
          message,
        });
        return;
      }

      await response.json();

      showPopup({
        type: "success",
        message: "Account created successfully. You can now login.",
        moveTo: "/login",
      });
    } catch (error) {
      console.error("Signup Error:", error);
      showPopup({
        type: "error",
        message: "Something went wrong during signup. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-96 rounded-2xl shadow-lg">
          <CardContent className="space-y-6 p-6">
            <div className="flex center">
              <img src={logo} alt="HARTRON Logo" width={100} height={50} />
              <img src={govt} alt="Govt Logo" width={250} height={150} />
            </div>
            <h2 className="text-center text-2xl font-semibold text-gray-700">
              Welcome to HARTRON Store
            </h2>
            <Input
              type="number"
              placeholder="Employee Code"
              className="p-3"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
            />
            <Input
              type="text"
              placeholder="Full Name"
              className="p-3"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Mobile Number"
              className="p-3"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              className="p-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              type="text"
              placeholder="Designation"
              className="p-3"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
            <SelectScrollable division={division} setDivision={setDivision} />
            <Button
              className="w-full bg-blue-600 py-3 text-white hover:bg-blue-700"
              onClick={handleSignup}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : "Sign Up"}
            </Button>
            <div className="space-y-0">
              <p className="text-center text-sm text-gray-500">
                Forgot your password?{" "}
                <a href="/reset-pwd" className="text-blue-600">
                  Reset here
                </a>
              </p>
              <p className="text-center text-sm text-gray-500">
                Already have an account?{" "}
                <a href="/login" className="text-blue-600">
                  Login Here
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

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
