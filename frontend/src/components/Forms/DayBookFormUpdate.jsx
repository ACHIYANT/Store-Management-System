import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import PopupMessage from "@/components/PopupMessage";
import { useLocation, useNavigate } from "react-router-dom";
import { toStoreApiUrl } from "@/lib/api-config";

const DayBookFormUpdate = () => {
  const [existingBillImage, setExistingBillImage] = useState(null);
  const [existingItemImage, setExistingItemImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const {
    register,
    setValue,
    getValues,
    formState: { errors },
  } = useForm();
  const [popup, setPopup] = useState({ open: false, type: "", message: "" });
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorOptions, setVendorOptions] = useState([]);
  const [isVendorLookupLoading, setIsVendorLookupLoading] = useState(false);

  const { state } = useLocation();
  const navigate = useNavigate();

  const { daybook, entryType, finYear } = state;

  useEffect(() => {
    if (!daybook) return;
    console.log(daybook);
    setValue("entry_no", daybook.entry_no);
    setValue("entry_type", entryType); // from step-1
    setValue("bill_no", daybook.bill_no);
    setValue("bill_date", daybook.bill_date);
    setValue("gst_no", daybook.Vendor?.gst_no || "");
    setValue("vendor_name", daybook.Vendor?.name || "");
    setValue("vendor_id", daybook.Vendor?.id || "");
    setVendorSearch("");
    setValue("total_amount", daybook.total_amount);
    setValue("remarks", daybook.remarks);
    setValue("fin_year", finYear); // from step-1

    setExistingBillImage(daybook.bill_image_url || null);
    setExistingItemImage(daybook.item_image_url || null);

    // Keep them in react-hook-form so they go forward automatically
    setValue("bill_image_url", daybook.bill_image_url || "");
    setValue("item_image_url", daybook.item_image_url || "");
  }, [daybook, entryType, finYear, setValue]);

  const handleNext = async () => {
    try {
      const headerData = getValues();

      const payload = {
        bill_no: headerData.bill_no,
        bill_date: headerData.bill_date,
        vendor_id: Number(headerData.vendor_id),
        total_amount: Number(headerData.total_amount),
        bill_image_url: headerData.bill_image_url || null,
        item_image_url: headerData.item_image_url || null,
        remarks: headerData.remarks || null,
      };

      if (!Number.isFinite(payload.vendor_id) || payload.vendor_id <= 0) {
        setPopup({
          open: true,
          type: "warning",
          message: "Please select a vendor before proceeding.",
        });
        return;
      }

      await axios.put(
        toStoreApiUrl(`/daybook/${daybook.id}`),
        payload,
      );

      // after successful header update → move to items page
      navigate("/daybook-update-items", {
        state: {
          daybook: { ...daybook, ...payload }, // keep UI in sync
          entryType,
        },
      });
    } catch (error) {
      console.error("Failed to update daybook header:", error);
      alert("Failed to update DayBook header");
    }
  };

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
  const viewEncryptedImage = (encryptedPath) => {
    if (!encryptedPath) return;
    //   const cleanPath = imagePath.replace(/^\/uploads\//, "");
    const cleanPath = encryptedPath.replace(/^\/uploads\//, "");

    // 🔐 Backend decrypt endpoint
    const url = toStoreApiUrl(
      `/view-image?path=${encodeURIComponent(cleanPath)}`,
    );
    console.log("url", url);
    setPreviewImageUrl(url);
  };

  const handleBillImageChange = async (file) => {
    if (!file) return;

    try {
      setUploading(true);

      const url = await uploadImage(
        file,
        "bill",
        getValues("entry_no"),
        getValues("bill_no"),
      );

      setExistingBillImage(url);
      setValue("bill_image_url", url);
    } catch {
      alert("Bill image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleItemImageChange = async (file) => {
    if (!file) return;

    try {
      setUploading(true);

      const url = await uploadImage(
        file,
        "item",
        getValues("entry_no"),
        getValues("bill_no"),
      );

      setExistingItemImage(url);
      setValue("item_image_url", url);
    } catch {
      alert("Item image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const preventWheelChange = (e) => {
    e.target.blur();
  };
  return (
    <div className="">
      <div className="flex justify-center items-center">
        <Card className="w-full max-w-3xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold">
              Update Day Book Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              {/* Entry No */}
              <div>
                <label className="block text-sm font-medium">Entry No</label>
                <Input
                  {...register("entry_no", {
                    required: "Entry No is required",
                  })}
                  placeholder="Enter Entry No"
                  disabled
                />
                {errors.entry_no && (
                  <p className="text-red-500 text-sm">
                    {errors.entry_no.message}
                  </p>
                )}
              </div>

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
              <div>
                <label className="block text-sm font-medium">Bill Image</label>

                {existingBillImage && (
                  <button
                    type="button"
                    className="text-blue-600 text-sm underline"
                    onClick={() => viewEncryptedImage(existingBillImage)}
                  >
                    View Current Bill Image
                  </button>
                )}

                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => handleBillImageChange(e.target.files[0])}
                  className="mt-1"
                />

                {uploading && (
                  <p className="text-xs text-gray-500 mt-1">Uploading...</p>
                )}
              </div>

              {/* Item Image URL */}

              <div>
                <label className="block text-sm font-medium">Item Image</label>

                {existingItemImage && (
                  <button
                    type="button"
                    className="text-blue-600 text-sm underline"
                    onClick={() => viewEncryptedImage(existingItemImage)}
                  >
                    View Current Bill Image
                  </button>
                )}

                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => handleItemImageChange(e.target.files[0])}
                  className="mt-1"
                />

                {uploading && (
                  <p className="text-xs text-gray-500 mt-1">Uploading...</p>
                )}
              </div>
              {/* Financial Year */}
              <div>
                <label className="block text-sm font-medium">
                  Financial Year
                </label>
                <Input
                  type="number"
                  {...register("fin_year", {
                    required: "Financial Year is required",
                  })}
                  placeholder="Enter Financial Year"
                  disabled
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
                type="button"
                onClick={handleNext}
                disabled={uploading}
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

      {previewImageUrl && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="bg-white p-3 rounded-lg max-w-3xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImageUrl}
              alt="Preview"
              className="max-h-[80vh] object-contain"
            />

            <div className="text-center mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewImageUrl(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayBookFormUpdate;
