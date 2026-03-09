import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NavBar from "../NavBar";
import { useState } from "react";
import { SelectScrollable } from "@/components/SelectScrollable";
import PopupMessage from "@/components/PopupMessage";
import axios from "axios";
import { toStoreApiUrl } from "@/lib/api-config";

const EmployeesForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  const [division, setDivision] = useState("");
  const [popup, setPopup] = useState({ open: false, type: "", message: "" });

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      division,
    };

    try {
      const response = await axios.post(
        toStoreApiUrl("/employee"),
        new URLSearchParams(formData).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      console.log("Employee added successfully:", response.data);
      setPopup({
        open: true,
        type: "success",
        message: "Employee added successfully!",
      });
      reset();
      setDivision("");
    } catch (error) {
      console.error("Error adding employee:", error);
      setPopup({
        open: true,
        type: "error",
        message: "Failed to add employee. Please try again.",
      });
    }
  };

  return (
    <div className="mt-16">
      {/* <NavBar /> */}
      <div className="flex justify-center items-center ">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold">
              Employee Entry Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">
                  Employee Code
                </label>
                <Input
                  {...register("emp_id", {
                    required: "Employee Code is required",
                  })}
                  placeholder="Enter Employee Code"
                />
                {errors.emp_id && (
                  <p className="text-red-500 text-sm">
                    {errors.emp_id.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">Full Name</label>
                <Input
                  {...register("name", {
                    required: "Full name is required",
                  })}
                  placeholder="Enter full name"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Father's Name
                </label>
                <Input
                  {...register("father_name", {
                    required: "Father's name is required",
                  })}
                  placeholder="Enter Father's name"
                />
                {errors.father_name && (
                  <p className="text-red-500 text-sm">
                    {errors.father_name.message}
                  </p>
                )}
              </div>

              {/* Email is commented */}
              <div>
                <label className="block text-sm font-medium">Email</label>
                <Input
                  {...register("email_id", {
                    required: "Email is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Invalid email format",
                    },
                  })}
                  placeholder="Enter email"
                />
                {errors.email_id && (
                  <p className="text-red-500 text-sm">
                    {errors.email_id.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">Designation</label>
                <Input
                  {...register("designation", {
                    required: "Designation is required",
                  })}
                  placeholder="Enter Designation"
                />
                {errors.designation && (
                  <p className="text-red-500 text-sm">
                    {errors.designation.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">Division</label>
                <SelectScrollable
                  division={division}
                  setDivision={setDivision}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Group Head</label>
                <Input
                  {...register("group_head", {
                    required: "Group Head is required",
                  })}
                  placeholder="Enter Group Head Name"
                />
                {errors.group_head && (
                  <p className="text-red-500 text-sm">
                    {errors.group_head.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Office Location
                </label>
                <Input
                  {...register("office_location", {
                    required: "Office Location is required",
                  })}
                  placeholder="Enter Office Location"
                />
                {errors.office_location && (
                  <p className="text-red-500 text-sm">
                    {errors.office_location.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Phone Number
                </label>
                <Input
                  {...register("mobile_no", {
                    required: "Phone number is required",
                    pattern: {
                      value: /^[6-9]\d{9}$/,
                      message: "Invalid phone number",
                    },
                  })}
                  placeholder="Enter phone number"
                />
                {errors.mobile_no && (
                  <p className="text-red-500 text-sm">
                    {errors.mobile_no.message}
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

      <PopupMessage
        open={popup.open}
        onClose={() => setPopup({ open: false, type: "", message: "" })}
        type={popup.type}
        message={popup.message}
      />
    </div>
  );
};

export default EmployeesForm;
