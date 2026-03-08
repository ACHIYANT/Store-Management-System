import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { SelectScrollable } from "@/components/SelectScrollable";
import PopupMessage from "@/components/PopupMessage";
import axios from "axios";
import { useLocation } from "react-router-dom";

const ItemCategoryUpdateForm = () => {
  // Accessing the selected employee passed via navigation
  const location = useLocation();
  const selectedItemCategory = location.state?.selectedItemCategory;

  console.log("Selected item category before", selectedItemCategory);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();
  const [popup, setPopup] = useState({ open: false, type: "", message: "" });

  const [categoryHeads, setCategoryHeads] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);

  const [formMeta, setFormMeta] = useState({
    category_head_id: "",
    category_group_id: "",
  });

  useEffect(() => {
    fetch("http://localhost:3000/api/v1/category-head")
      .then((res) => res.json())
      .then((res) => setCategoryHeads(res.data || []));
  }, []);

  // Prefill form fields when selected employee data is available
  useEffect(() => {
    if (!selectedItemCategory) return;

    setValue("id", selectedItemCategory.id);
    setValue("category_name", selectedItemCategory.category_name);
    setValue(
      "serialized_required",
      String(selectedItemCategory.serialized_required),
    );

    const headId = selectedItemCategory.group?.head?.id;
    const groupId = selectedItemCategory.group?.id;

    setFormMeta({
      category_head_id: headId,
      category_group_id: groupId,
    });

    if (headId) {
      fetch(`http://localhost:3000/api/v1/category-group/by-head/${headId}`)
        .then((res) => res.json())
        .then((res) => setCategoryGroups(res.data || []));
    }
  }, [selectedItemCategory, setValue]);

  const handleHeadChange = async (e) => {
    const headId = e.target.value;

    setFormMeta({
      category_head_id: headId,
      category_group_id: "",
    });

    setCategoryGroups([]);

    if (!headId) return;

    const res = await fetch(
      `http://localhost:3000/api/v1/category-group/by-head/${headId}`,
    );
    const json = await res.json();
    setCategoryGroups(json.data || []);
  };

  const onSubmit = async (data) => {
    if (!formMeta.category_head_id || !formMeta.category_group_id) {
      alert("Please select Category Head & Group");
      return;
    }

    const body = new URLSearchParams();
    body.append("category_name", data.category_name);
    body.append("group_id", formMeta.category_group_id);
    body.append("serialized_required", data.serialized_required === "true");

    await axios.patch(
      `http://localhost:3000/api/v1/itemCategory/${data.id}`,
      body,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    setPopup({
      open: true,
      type: "success",
      message: "Item category updated successfully!",
    });
  };

  return (
    <div className="mt-16">
      <div className="flex justify-center items-center">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold">
              Update Item Category Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* vendor - Id - disabled */}
              <div>
                <label className="block text-sm font-medium">
                  Item Category Id
                </label>
                <Input {...register("id")} disabled className="bg-gray-100" />
              </div>
              {/* ********************************** */}
              <div>
                <label className="block text-sm font-medium">
                  Category Head
                </label>
                <select
                  value={formMeta.category_head_id}
                  onChange={handleHeadChange}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select Category Head</option>
                  {categoryHeads.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.category_head_name}
                    </option>
                  ))}
                </select>
              </div>
              {/*  */}
              <div>
                <label className="block text-sm font-medium">
                  Category Group
                </label>
                <select
                  value={formMeta.category_group_id}
                  disabled={!formMeta.category_head_id}
                  onChange={(e) =>
                    setFormMeta((prev) => ({
                      ...prev,
                      category_group_id: e.target.value,
                    }))
                  }
                  className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
                >
                  <option value="">Select Category Group</option>
                  {categoryGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.category_group_name}
                    </option>
                  ))}
                </select>
              </div>

              {/*  */}
              <div>
                <label className="block text-sm font-medium">
                  Item Category Name
                </label>
                <Input
                  {...register("category_name", {
                    required: "Cateogry name is required",
                  })}
                  placeholder="Enter Item Category name"
                />
                {errors.category_name && (
                  <p className="text-red-500 text-sm">
                    {errors.category_name.message}
                  </p>
                )}
              </div>
              {/*  */}
              <div>
                <label className="block text-sm font-medium">
                  Is Serialised / Asset?
                </label>
                <select
                  {...register("serialized_required", { required: true })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

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
        moveTo="/itemCategory"
      />
    </div>
  );
};

export default ItemCategoryUpdateForm;
