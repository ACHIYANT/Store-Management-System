import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { SelectScrollable } from "@/components/SelectScrollable";
import PopupMessage from "@/components/PopupMessage";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

const VendorUpdateForm = ({ onUpdateSuccess }) => {
  // Accessing the selected employee passed via navigation
  const location = useLocation();
  const selectedVendor = location.state?.selectedVendor;

  console.log("Selected emplotee ", selectedVendor);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();
  const [popup, setPopup] = useState({ open: false, type: "", message: "" });
  const [division, setDivision] = useState("");
  const navigate = useNavigate();

  // Prefill form fields when selected employee data is available
  useEffect(() => {
    if (selectedVendor) {
      setValue("id", selectedVendor.id);
      setValue("name", selectedVendor.name);
      setValue("address", selectedVendor.address);
      setValue("gst_no", selectedVendor.gst_no);
      setValue("mobile_no", selectedVendor.mobile_no);
    }
  }, [selectedVendor, setValue]);

  const onSubmit = async (data) => {
    try {
      const normalizedGst = String(data.gst_no || "").trim().toUpperCase();
      const body = new URLSearchParams();
      body.append("name", data.name);
      body.append("address", data.address);
      body.append("gst_no", normalizedGst);
      body.append("mobile_no", data.mobile_no);

      const response = await axios.patch(
        `http://localhost:3000/api/v1/vendor/${data.id}`,
        body,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      console.log("Update Success:", response.data);
      setPopup({
        open: true,
        type: "success",
        message: "Vendor updated successfully!",
      });

      if (onUpdateSuccess) {
        onUpdateSuccess(); // Refresh the list or close the form if needed
      }
      //   navigate("/vendors");
    } catch (error) {
      console.error("Update Failed:", error);
      setPopup({
        open: true,
        type: "error",
        message: "Failed to update vendor!",
      });
    }
  };

  return (
    <div className="mt-16">
      <div className="flex justify-center items-center">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold">
              Update Vendor Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* vendor - Id - disabled */}
              <div>
                <label className="block text-sm font-medium">Vendor Id</label>
                <Input {...register("id")} disabled className="bg-gray-100" />
              </div>
              {/* ********************************** */}
              <div>
                <label className="block text-sm font-medium">Vendor Name</label>
                <Input
                  {...register("name", {
                    required: "Vendor name is required",
                  })}
                  placeholder="Enter vendor name"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Vendor Address
                </label>
                <Input
                  {...register("address", {
                    required: "Address is required",
                  })}
                  placeholder="Enter vendor address"
                />
                {errors.address && (
                  <p className="text-red-500 text-sm">
                    {errors.address.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">
                  GST Number (Optional)
                </label>
                <Input
                  {...register("gst_no", {
                    validate: (value) => {
                      const normalized = String(value || "").trim().toUpperCase();
                      if (!normalized) return true;
                      return /^[A-Z0-9]{15}$/.test(normalized)
                        ? true
                        : "GST must be 15 alphanumeric characters";
                    },
                  })}
                  placeholder="Enter GST number (if available)"
                />
                {errors.gst_no && (
                  <p className="text-red-500 text-sm">
                    {errors.gst_no.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Contact Number
                </label>
                <Input
                  {...register("mobile_no", {
                    required: "Contact number is required",
                    pattern: {
                      value: /^[0-9]{10}$/,
                      message: "Invalid phone number",
                    },
                  })}
                  placeholder="Enter contact number"
                />
                {errors.mobile_no && (
                  <p className="text-red-500 text-sm">
                    {errors.mobile_no.message}
                  </p>
                )}
              </div>

              {/* ******************************* */}

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md"
              >
                Update
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Popup for success/error */}
      <PopupMessage
        open={popup.open}
        onClose={() => setPopup({ open: false, type: "", message: "" })}
        type={popup.type}
        message={popup.message}
        moveTo="/vendors"
      />
    </div>
  );
};

export default VendorUpdateForm;
