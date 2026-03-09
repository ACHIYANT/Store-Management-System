import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import PopupMessage from "@/components/PopupMessage";
import { useNavigate } from "react-router-dom";
import { toStoreApiUrl } from "@/lib/api-config";

const DayBookForm = ({ defaultType, defaultFinYear }) => {
  const navigate = useNavigate();
  const [billImageFile, setBillImageFile] = useState(null);
  const [itemImageFile, setItemImageFile] = useState(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();
  const [popup, setPopup] = useState({ open: false, type: "", message: "" });
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorOptions, setVendorOptions] = useState([]);
  const [isVendorLookupLoading, setIsVendorLookupLoading] = useState(false);

  const preventWheelChange = (e) => {
    e.target.blur();
  };

  useEffect(() => {
    if (!defaultType || !defaultFinYear) return;

    setValue("entry_type", defaultType);
    setValue("fin_year", defaultFinYear);
  }, [defaultType, defaultFinYear, setValue]);

  const applyVendorSelection = (vendor) => {
    if (!vendor) return;
    setValue("vendor_name", vendor.name || "");
    setValue("gst_no", vendor.gst_no || "");
    setValue("vendor_id", vendor.id, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setVendorSearch("");
    setVendorOptions([]);
  };

  useEffect(() => {
    const query = String(vendorSearch || "").trim();
    if (!query) {
      setVendorOptions([]);
      setIsVendorLookupLoading(false);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsVendorLookupLoading(true);
        const response = await axios.get(
          toStoreApiUrl("/vendor/search"),
          {
            params: {
              name: query,
              page: 1,
              limit: 20,
              cursorMode: false,
            },
          },
        );

        if (isCancelled) return;

        const matches = Array.isArray(response?.data?.data)
          ? response.data.data
          : [];
        setVendorOptions(matches);
      } catch (error) {
        if (isCancelled) return;
        console.error("Error fetching vendors:", error);
        setVendorOptions([]);
      } finally {
        if (!isCancelled) {
          setIsVendorLookupLoading(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [vendorSearch]);

  const uploadImage = async (file, type = "bill", entryNo, billNo) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entry_no", entryNo);
    formData.append("bill_no", billNo);
    console.log("Form Data", formData);
    console.log("Upload image");
    try {
      console.log("Inside try");
      const response = await axios.post(
        toStoreApiUrl(`/upload/${type}`),
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      console.log("Response", response.data.url);
      return response.data.url; // assuming server responds with { url: ... }
    } catch (error) {
      console.error(`Error uploading ${type} image:`, error);
      throw new Error(`${type} image upload failed`);
    }
  };

  const onSubmit = async (data) => {
    // Upload bill image
    try {
      if (billImageFile) {
        const billImageUrl = await uploadImage(
          billImageFile,
          "bill",
          "unknown",
          data.bill_no,
        );
        data.bill_image_url = billImageUrl;
      }

      if (itemImageFile) {
        const itemImageUrl = await uploadImage(
          itemImageFile,
          "item",
          "unknown",
          data.bill_no,
        );
        data.item_image_url = itemImageUrl;
      }

      if (!data.status || data.status.trim() === "") {
        data.status = "Pending"; // or default you want
      }

      if (!data.approval_level || isNaN(Number(data.approval_level))) {
        data.approval_level = 0;
      }
      const vendorIdNumber = Number(data.vendor_id);
      if (!Number.isFinite(vendorIdNumber) || vendorIdNumber <= 0) {
        setPopup({
          open: true,
          type: "warning",
          message: "Please select a vendor before proceeding.",
        });
        return;
      }
      console.log("URL's", data.bill_image_url, data.item_image_url);
      const body = new URLSearchParams();
      body.append("entry_no", data.entry_no);
      body.append("entry_type", data.entry_type);
      body.append("bill_no", data.bill_no);
      body.append("bill_date", data.bill_date);
      body.append("vendor_id", vendorIdNumber);
      body.append("total_amount", data.total_amount);
      body.append("bill_image_url", data.bill_image_url || "");
      body.append("item_image_url", data.item_image_url || "");
      body.append("approval_level", data.approval_level);
      body.append("fin_year", data.fin_year);
      body.append("remarks", data.remarks);
      body.append("status", data.status);
      console.log(body.toString());
      navigate(`/daybook-items`, {
        state: {
          // daybookFormData: data, // everything from step-1
          // daybookId: daybookId,
          // entry_no: response.data?.data?.entry_no,
          entry_type: defaultType,
          fin_year: defaultFinYear,
          daybook: data,
        },
      });
    } catch (error) {
      console.error("Error creating day book entry:", error);
      setPopup({
        open: true,
        type: "error",
        message: "Failed to create Day Book entry!",
      });
    }
  };

  return (
    <div className="">
      <div className="flex justify-center items-center">
        <Card className="w-full max-w-3xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold">
              Create Day Book Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Entry Type */}
              <div>
                <label className="block text-sm font-medium">Entry Type</label>
                <Input
                  {...register("entry_type", {
                    required: "Entry Type is required",
                  })}
                  placeholder="Enter Entry Type"
                  disabled
                />
                {errors.entry_type && (
                  <p className="text-red-500 text-sm">
                    {errors.entry_type.message}
                  </p>
                )}
              </div>

              {/* Bill No */}
              <div>
                <label className="block text-sm font-medium">Bill No</label>
                <Input
                  {...register("bill_no", { required: "Bill No is required" })}
                  placeholder="Enter Bill No"
                />
                {errors.bill_no && (
                  <p className="text-red-500 text-sm">
                    {errors.bill_no.message}
                  </p>
                )}
              </div>

              {/* Bill Date */}
              <div>
                <label className="block text-sm font-medium">Bill Date</label>
                <Input
                  type="date"
                  {...register("bill_date", {
                    required: "Bill Date is required",
                  })}
                />
                {errors.bill_date && (
                  <p className="text-red-500 text-sm">
                    {errors.bill_date.message}
                  </p>
                )}
              </div>

              {/* Vendor Lookup -> Vendor Name -> Vendor ID */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Vendor Lookup (GST / Name / Mobile)
                </label>
                <Input
                  value={vendorSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setVendorSearch(value);
                    setValue("vendor_name", "");
                    setValue("gst_no", "");
                    setValue("vendor_id", "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                  placeholder="Type GST, vendor name, or mobile"
                />
                {isVendorLookupLoading && (
                  <p className="text-xs text-slate-500">Searching vendors...</p>
                )}
                {!isVendorLookupLoading &&
                  String(vendorSearch || "").trim().length > 0 &&
                  vendorOptions.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No matching vendor found.
                    </p>
                  )}

                {vendorOptions.length > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded-md border border-slate-300 bg-white">
                    {vendorOptions.map((vendor) => (
                      <button
                        key={vendor.id}
                        type="button"
                        onClick={() => applyVendorSelection(vendor)}
                        className="flex w-full flex-col border-b border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 last:border-b-0"
                      >
                        <span className="font-medium text-slate-800">
                          {vendor.name}
                        </span>
                        <span className="text-xs text-slate-600">
                          {vendor.mobile_no}
                          {vendor.gst_no ? ` | ${vendor.gst_no}` : " | NO GST"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">
                      Vendor Name
                    </label>
                    <Input
                      {...register("vendor_name")}
                      disabled
                      className="bg-gray-100"
                      placeholder="Select vendor from lookup"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">GST No</label>
                    <Input
                      {...register("gst_no")}
                      disabled
                      className="bg-gray-100"
                      placeholder="N/A for unregistered vendor"
                    />
                  </div>
                </div>

                <input
                  type="hidden"
                  {...register("vendor_id", {
                    required: "Vendor selection is required",
                  })}
                />
                {errors.vendor_id && (
                  <p className="text-red-500 text-sm">
                    {errors.vendor_id.message}
                  </p>
                )}
              </div>

              {/* Total Amount */}
              <div>
                <label className="block text-sm font-medium">
                  Total Amount
                </label>
                <Input
                  type="number"
                  {...register("total_amount", {
                    required: "Total Amount is required",
                  })}
                  placeholder="Enter Amount"
                  onWheel={preventWheelChange}
                />
                {errors.total_amount && (
                  <p className="text-red-500 text-sm">
                    {errors.total_amount.message}
                  </p>
                )}
              </div>

              {/* Bill Image URL */}

              <div>
                <label className="block text-sm font-medium">
                  Upload Bill Image
                </label>
                <div className="relative">
                  {billImageFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setBillImageFile(null);
                      }}
                      className="absolute top-2 right-2 bg-white border rounded-full p-1
        text-gray-400 hover:text-red-600 hover:border-red-300 shadow-sm
        transition"
                      title="Remove file"
                    >
                      ✕
                    </button>
                  )}
                  <label
                    htmlFor="billImage"
                    className=" group cursor-pointer border-2 border-dashed border-gray-300 
             rounded-xl p-6 flex flex-col items-center justify-center
             hover:border-blue-500 hover:bg-blue-50 transition"
                  >
                    <svg
                      className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mb-2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
                      <path d="M12 12v9" />
                      <path d="M8 12l4-4 4 4" />
                    </svg>

                    <p className="text-sm font-medium text-gray-700">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG, PDF (max 5MB)
                    </p>

                    {billImageFile && (
                      <span className="mt-2 text-xs text-green-600">
                        ✔ {billImageFile.name}
                      </span>
                    )}
                    <input
                      id="billImage"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setBillImageFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Item Image URL */}
              <div>
                <label className="block text-sm font-medium">
                  Upload Item Image
                </label>
                {/* Remove button (top-right, floating) */}
                <div className="relative">
                  {itemImageFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setItemImageFile(null);
                      }}
                      className="absolute top-2 right-2 bg-white border rounded-full p-1
        text-gray-400 hover:text-red-600 hover:border-red-300 shadow-sm
        transition"
                      title="Remove file"
                    >
                      ✕
                    </button>
                  )}
                  <label
                    htmlFor="itemImage"
                    className=" group cursor-pointer border-2 border-dashed border-gray-300 
             rounded-xl p-6 flex flex-col items-center justify-center
             hover:border-blue-500 hover:bg-blue-50 transition"
                  >
                    <svg
                      className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mb-2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
                      <path d="M12 12v9" />
                      <path d="M8 12l4-4 4 4" />
                    </svg>

                    <p className="text-sm font-medium text-gray-700">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG, PDF (max 5MB)
                    </p>

                    {itemImageFile && (
                      <span className="mt-2 text-xs text-green-600">
                        ✔ {itemImageFile.name}
                      </span>
                    )}
                    <input
                      id="itemImage"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setItemImageFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              {/* Financial Year */}
              <div>
                <label className="block text-sm font-medium">
                  Financial Year
                </label>
                <Input
                  type="number"
                  disabled
                  {...register("fin_year", {
                    required: "Financial Year is required",
                  })}
                  placeholder="Enter Financial Year"
                  onWheel={preventWheelChange}
                />
                {errors.fin_year && (
                  <p className="text-red-500 text-sm">
                    {errors.fin_year.message}
                  </p>
                )}
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium">Remarks</label>
                <Input {...register("remarks")} placeholder="Enter Remarks" />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md"
              >
                Next
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
      />
    </div>
  );
};

export default DayBookForm;
