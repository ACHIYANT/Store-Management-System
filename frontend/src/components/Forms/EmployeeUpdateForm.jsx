import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { SelectScrollable } from "@/components/SelectScrollable";
import PopupMessage from "@/components/PopupMessage";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

const EmployeeUpdateForm = ({ onUpdateSuccess }) => {
  // Accessing the selected employee passed via navigation
  const location = useLocation();
  const selectedEmployee = location.state?.selectedEmployee;

  console.log("Selected emplotee ", selectedEmployee);
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
    console.log("div : ", selectedEmployee.division);
    if (selectedEmployee) {
      console.log("Selected employee division: ", selectedEmployee.division);
      setValue("emp_id", selectedEmployee.emp_id);
      setValue("name", selectedEmployee.name);
      setValue("father_name", selectedEmployee.father_name);
      setValue("email_id", selectedEmployee.email_id);
      setValue("designation", selectedEmployee.designation);
      setValue("group_head", selectedEmployee.group_head);
      setValue("office_location", selectedEmployee.office_location);
      setValue("mobile_no", selectedEmployee.mobile_no);
      if (!division) {
        const division = selectedEmployee.division || "";
        setDivision(division);
        console.log("Prefilled division: ", division); // Debug line
      }
    }
  }, [selectedEmployee, setValue, division]);

  console.log("Achiyant : ", division);
  const onSubmit = async (data) => {
    try {
      const body = new URLSearchParams();
      body.append("name", data.name);
      body.append("father_name", data.father_name);
      body.append("email_id", data.email_id);
      body.append("designation", data.designation);
      body.append("division", division);
      body.append("group_head", data.group_head);
      body.append("office_location", data.office_location);
      body.append("mobile_no", data.mobile_no);

      const response = await axios.patch(
        `http://localhost:3000/api/v1/employee/${data.emp_id}`,
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
        message: "Employee updated successfully!",
      });

      if (onUpdateSuccess) {
        onUpdateSuccess(); // Refresh the list or close the form if needed
      }
    } catch (error) {
      console.error("Update Failed:", error);
      setPopup({
        open: true,
        type: "error",
        message: "Failed to update employee!",
      });
    }
  };

  return (
    <div className="mt-16">
      <div className="flex justify-center items-center">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold">
              Update Employee Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* emp_id - disabled */}
              <div>
                <label className="block text-sm font-medium">
                  Employee Code
                </label>
                <Input
                  {...register("emp_id")}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              {/* ********************************** */}
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
        moveTo="/employees"
      />
    </div>
  );
};

export default EmployeeUpdateForm;
