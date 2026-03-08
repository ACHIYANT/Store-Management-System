import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PopupMessage from "@/components/PopupMessage";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import axios from "axios";

const ItemCategoryAddForm = () => {
  const [popup, setPopup] = useState({ open: false, type: "", message: "" });
  const [categoryHeads, setCategoryHeads] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    category_head_id: "",
    group_id: "",
    category_name: "",
    serialized_required: false,
  });
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  useEffect(() => {
    fetch("http://localhost:3000/api/v1/category-head")
      .then((res) => res.json())
      .then((res) => {
        setCategoryHeads(res.data || []);
      });
  }, []);

  const handleHeadChange = async (e) => {
    const headId = e.target.value;

    setFormData((prev) => ({
      ...prev,
      category_head_id: headId,
      group_id: "",
    }));

    if (!headId) {
      setCategoryGroups([]);
      return;
    }
    setLoadingGroups(true);
    const res = await fetch(
      `http://localhost:3000/api/v1/category-group/by-head/${headId}`,
    );
    const json = await res.json();
    setCategoryGroups(json.data || []);
    setLoadingGroups(false);
  };
  const onSubmit = async (data) => {
    if (!formData.category_head_id) {
      alert("Please select Category Head");
      return;
    }
    if (!formData.group_id) {
      alert("Please select Category Group");
      return;
    }

    const payload = new URLSearchParams();
    payload.append("category_name", data.category_name);
    payload.append("serialized_required", data.serialized_required === "true");
    payload.append("category_head_id", formData.category_head_id);
    payload.append("group_id", formData.group_id);

    try {
      setSubmitting(true);
      await axios.post("http://localhost:3000/api/v1/itemCategory", payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      setSubmitting(false);

      setPopup({
        open: true,
        type: "success",
        message: "Item category saved successfully!",
      });
      reset();
      setFormData({
        category_head_id: "",
        group_id: "",
        category_name: "",
        serialized_required: false,
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: "Failed to save item category!",
      });
    }
  };

  return (
    <div className="">
      {/* <NavBar /> */}
      <div className="flex justify-center items-center mt-16">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold">
              Item Category Entry Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="form-group">
                <label>Category Head</label>
                <select
                  value={formData.category_head_id}
                  onChange={handleHeadChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
             focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category Head</option>
                  {categoryHeads.map((head) => (
                    <option key={head.id} value={head.id}>
                      {head.category_head_name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Category group */}
              <div className="form-group">
                <label>Category Group</label>
                <select
                  value={formData.group_id}
                  disabled={!formData.category_head_id || loadingGroups}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      group_id: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
             focus:outline-none focus:ring-2 focus:ring-blue-500
             disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select Category Group</option>
                  {categoryGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.category_group_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category name */}
              <div>
                <label className="block text-sm font-medium">
                  Item Category
                </label>
                <Input
                  {...register("category_name", {
                    required: "Category name is required",
                  })}
                  placeholder="Enter Category Name (e.g. A4 Paper Rim 75 GSM)"
                />
                {errors.category_name && (
                  <p className="text-red-500 text-sm">
                    {errors.category_name.message}
                  </p>
                )}
              </div>

              {/* Serialized Required dropdown */}
              <div>
                <label className="block text-sm font-medium">
                  Is Serialised/Asset?
                </label>
                <select
                  {...register("serialized_required", {
                    required: "Please select Yes or No",
                  })}
                  // className="border p-2 rounded w-full"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
             focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                {errors.serialized_required && (
                  <p className="text-red-500 text-sm">
                    {errors.serialized_required.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-md"
              >
                {submitting ? "Saving..." : "Submit"}
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
        moveTo="/itemCategory-entry" // <-- redirect path after success
      />
    </div>
  );
};

export default ItemCategoryAddForm;
