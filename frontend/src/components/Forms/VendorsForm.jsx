import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import axios from "axios";

const VendorForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  const onSubmit = async (data) => {
    console.log("Vendor Data:", data);
    const normalizedGst = String(data.gstNumber || "").trim().toUpperCase();
    // Submit data to backend API
    const formData = new URLSearchParams();
    formData.append("name", data.vendorName);
    formData.append("address", data.vendorAddress);
    formData.append("gst_no", normalizedGst);
    formData.append("mobile_no", data.contactNumber);

    try {
      // Send POST request with x-www-form-urlencoded content-type
      const response = await axios.post(
        "http://localhost:3000/api/v1/vendor",
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      console.log("Response from server:", response.data);
      // Handle success (maybe redirect or show success message)
      // Reset the form fields after successful submission
      reset();

      // Optionally, you can show a success message or redirect the user
      // alert("Vendor added successfully!");
    } catch (error) {
      console.error("Error submitting data:", error);
      // Handle error (show error message)
    }
  };

  return (
    <div className="">
      {/* <NavBar /> */}
      <div className="flex justify-center items-center mt-16">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold">
              Vendor Entry Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Vendor Name</label>
                <Input
                  {...register("vendorName", {
                    required: "Vendor name is required",
                  })}
                  placeholder="Enter vendor name"
                />
                {errors.vendorName && (
                  <p className="text-red-500 text-sm">
                    {errors.vendorName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Vendor Address
                </label>
                <Input
                  {...register("vendorAddress", {
                    required: "Address is required",
                  })}
                  placeholder="Enter vendor address"
                />
                {errors.vendorAddress && (
                  <p className="text-red-500 text-sm">
                    {errors.vendorAddress.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Contact Number
                </label>
                <Input
                  {...register("contactNumber", {
                    required: "Contact number is required",
                    pattern: {
                      value: /^[0-9]{10}$/,
                      message: "Invalid phone number",
                    },
                  })}
                  placeholder="Enter contact number"
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-sm">
                    {errors.contactNumber.message}
                  </p>
                )}
              </div>

              {/* Email is commented */}
              {/* <div>
                <label className="block text-sm font-medium">Email</label>
                <Input
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Invalid email format",
                    },
                  })}
                  placeholder="Enter email"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm">{errors.email.message}</p>
                )}
              </div> */}

              <div>
                <label className="block text-sm font-medium">
                  GST Number (Optional)
                </label>
                <Input
                  {...register("gstNumber", {
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
                {errors.gstNumber && (
                  <p className="text-red-500 text-sm">
                    {errors.gstNumber.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-md"
              >
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorForm;
