import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import PopupMessage from "@/components/PopupMessage";
import { motion as Motion } from "framer-motion";

import logo from "/logo.svg";
import govt from "/govt.svg";


export default function ResetPassword() {
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
    moveTo: "",
  });

  return (
    <div className="flex bg-gray-100 min-h-screen items-center justify-center p-4">
      <Motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-96 shadow-lg rounded-2xl">
          <CardContent className="p-6 space-y-6">
            <div className="flex center">
              <img src={logo} alt="HARTRON Logo" width={100} height={50} />
              <img src={govt} alt="HARTRON Logo" width={250} height={150} />
            </div>
            <h2 className="text-center text-2xl font-semibold text-gray-700">
              Welcome to HARTRON Store
            </h2>
            <p className="p-3">
              Contact database admin for the request of reset passowrd.
            </p>
            <div className="space-y-0">
              <p className="text-center text-sm text-gray-500">
                Already have an account?{" "}
                <a href="/login" className="text-blue-600">
                  Login Here
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
