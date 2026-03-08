import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import SerialEntryPanel from "../ui/SerialEntryPanel";
import { Icon, Trash2 } from "lucide-react";
import PopupMessage from "@/components/PopupMessage";
import { SKU_UNITS, DEFAULT_SKU_UNIT } from "@/constants/skuUnits";

const DayBookItemsForm = () => {
  const { state } = useLocation();
  const [categories, setCategories] = useState([]);
  const [showAdditionalCharges, setShowAdditionalCharges] = useState(false);
  const [categoryHeads, setCategoryHeads] = useState([]);
  const [popup, setPopup] = useState({
    open: false,
    type: "success",
    message: "",
    moveTo: "",
  });

  const [items, setItems] = useState([
    {
      item_name: "",
      item_category_id: "",
      sku_unit: DEFAULT_SKU_UNIT,
      quantity: "",
      rate: "",
      gst_type: "IGST",
      gst_rate: "",
      amount: "",
      groupOptions: [], // ✅ ADD
      purchased_at: null,
      warranty_expiry: null,
      serials: [],
      showSerials: false,
    },
  ]);

  // ! the below added state is for the adding of the additional charges in the form.
  const [additionalCharges, setAdditionalCharges] = useState([
    {
      charge_type: "",
      description: "",
      quantity: 1,
      rate: "",
      gst_type: "IGST",
      gst_rate: "",
      amount: "",
    },
  ]);

  const navigate = useNavigate();

  console.log("STATEEE: ", state);
  const preventWheelChange = (e) => {
    e.target.blur();
  };

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await axios.get(
          "http://localhost:3000/api/v1/itemCategories",
        );
        setCategories(res.data.data || []);
        console.log("data fetchCategories:", res.data.data);
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    }
    fetchCategories();
  }, []);

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    console.log(index, field, value);
    updated[index][field] = value;

    // Auto-calculate amount if needed
    if (["quantity", "rate", "gst_rate"].includes(field)) {
      const qty = parseFloat(updated[index].quantity) || 0;
      const rate = parseFloat(updated[index].rate) || 0;
      const gst = parseFloat(updated[index].gst_rate) || 0;
      // updated[index].amount = (qty * rate * (1 + gst / 100)).toFixed(2);
      let gstMultiplier = 1;

      if (updated[index].gst_type === "IGST") {
        gstMultiplier = 1 + gst / 100;
      } else if (updated[index].gst_type === "CGST_SGST") {
        gstMultiplier = 1 + gst / 100; // total is still 18% (9% + 9%)
      }

      updated[index].amount = (qty * rate * gstMultiplier).toFixed(2);
    }

    // LEVEL 1 → Category Head changed
    if (field === "category_head_id") {
      updated[index].category_group_id = "";
      updated[index].item_category_id = "";
      updated[index].showSerials = false;
      updated[index].serials = [];
      updated[index].groupOptions = []; // ✅ ADD
      axios
        .get(`http://localhost:3000/api/v1/category-group/by-head/${value}`)
        .then((res) => {
          const updatedGroups = res.data.data || [];

          setItems((prev) => {
            const copy = [...prev];
            copy[index].groupOptions = updatedGroups;
            return copy;
          });
        });
    }

    // LEVEL 2 → Category Group changed
    if (field === "category_group_id") {
      updated[index].item_category_id = "";
      updated[index].showSerials = false;
      updated[index].serials = [];
    }

    // FINAL → Item Category changed
    // ! NEW: if category changed to non-serialized, collapse and clear serials
    if (field === "item_category_id") {
      const nextCat = categories.find((c) => String(c.id) === String(value));

      if (!nextCat?.serialized_required) {
        updated[index].showSerials = false;
        updated[index].serials = [];
      }
    }

    setItems(updated);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      {
        item_name: "",
        category_head_id: "",
        category_group_id: "",
        item_category_id: "",
        sku_unit: DEFAULT_SKU_UNIT,
        quantity: "",
        rate: "",
        gst_type: "IGST",
        gst_rate: "",
        amount: "",
        groupOptions: [], // ✅ ADD
        purchased_at: null,
        warranty_expiry: null,
        serials: [],
        showSerials: false,
      },
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // ! below is the handling function for the chanrge change
  const handleChargeChange = (index, field, value) => {
    const updated = [...additionalCharges];
    updated[index][field] = value;

    if (["quantity", "rate", "gst_rate"].includes(field)) {
      const qty = parseFloat(updated[index].quantity) || 0;
      const rate = parseFloat(updated[index].rate) || 0;
      const gst = parseFloat(updated[index].gst_rate) || 0;

      let gstMultiplier = 1 + gst / 100;
      updated[index].amount = (qty * rate * gstMultiplier).toFixed(2);
    }

    setAdditionalCharges(updated);
  };

  // ! below handling function is to add the other charges row
  const addChargeRow = () => {
    setAdditionalCharges([
      ...additionalCharges,
      {
        charge_type: "",
        description: "",
        quantity: 1,
        rate: "",
        gst_type: "IGST",
        gst_rate: "",
        amount: "",
      },
    ]);
  };

  const removeChargeRow = (index) => {
    if (additionalCharges.length > 1) {
      setAdditionalCharges(additionalCharges.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        const cat = categories.find(
          (c) => String(c.id) === String(item.item_category_id),
        );

        if (!cat) continue;

        if (
          cat.serialized_required &&
          (!Array.isArray(item.serials) || item.serials.length === 0)
        ) {
          setPopup({
            open: true,
            type: "error",
            message: `Serials required for item: ${item.item_name || `Item #${i + 1}`}`,
          });

          return; // ⛔ stop submission
        }
      }
      const serials = [];

      items.forEach((item, itemIndex) => {
        if (!Array.isArray(item.serials)) return;

        item.serials.forEach((s) => {
          const serialNumber = typeof s === "string" ? s : s?.serial_number;

          if (!serialNumber) return;

          serials.push({
            daybook_item_temp_id: itemIndex,
            serial_number: serialNumber,
            purchased_at: item.purchased_at || null,
            warranty_expiry: item.warranty_expiry || null,
          });
        });
      });

      const cleanedCharges = additionalCharges.filter((c) => {
        const hasType = String(c.charge_type || "").trim().length > 0;
        const hasValue =
          Number(c.rate) > 0 ||
          Number(c.gst_rate) > 0 ||
          Number(c.amount) > 0 ||
          Number(c.total_amount) > 0 ||
          Number(c.gst_amount) > 0;
        return hasType || hasValue;
      });
      const payload = {
        // daybook_id: daybookId,
        entry_type: state.entry_type,
        fin_year: state.fin_year,

        daybook: {
          ...state.daybook,
        },
        items: items.map((item) => ({
          ...item,
          category_head_id: parseInt(item.category_head_id),
          category_group_id: parseInt(item.category_group_id),
          item_category_id: parseInt(item.item_category_id),
          sku_unit: item.sku_unit || DEFAULT_SKU_UNIT,
          quantity: parseInt(item.quantity),
          rate: parseFloat(item.rate),
          gst_rate: parseFloat(item.gst_rate),
          amount: parseFloat(item.amount),
        })),

        additionalCharges: cleanedCharges.map((c) => ({
          ...c,
          quantity: parseFloat(c.quantity),
          rate: parseFloat(c.rate),
          gst_rate: parseFloat(c.gst_rate),
          amount: parseFloat(c.amount),
        })),
        serials,
      };

      console.log(payload);

      const res = await axios.post(
        "http://localhost:3000/api/v1/daybook/full",
        payload,
        { headers: { "Content-Type": "application/json" } },
      );

      setPopup({
        open: true,
        type: "success",
        message: `DayBook created: ${res.data.data.entry_no}`,
        moveTo: "/DayBook", // navigate after user closes popup
      });

    } catch (error) {
      console.error("Error submitting items:", error);
      setPopup({
        open: true,
        type: "error",
        message: error?.response?.data?.message || "Error submitting items",
      });
    }
  };

 
  const ctl = "border rounded p-2 h-11 w-full";

  useEffect(() => {
    async function fetchCategoryHeads() {
      try {
        const res = await axios.get(
          "http://localhost:3000/api/v1/category-head",
        );
        setCategoryHeads(res.data.data || []);
      } catch (err) {
        console.error("Error fetching category heads", err);
      }
    }
    fetchCategoryHeads();
  }, []);


  const generateAutoSerials = ({ billDate, itemIndex, quantity }) => {
    const datePart = billDate
      ? billDate.replaceAll("-", "")
      : new Date().toISOString().slice(0, 10).replaceAll("-", "");

    const base = `TMP-${String(itemIndex + 1).padStart(2, "0")}-${datePart}`;

    return Array.from({ length: quantity }, (_, i) => ({
      serial_number: `${base}-${String(i + 1).padStart(3, "0")}`,
    }));
  };
  const invalidNav = !state?.entry_type || !state?.fin_year || !state?.daybook;

  useEffect(() => {
    if (invalidNav) {
      setPopup({
        open: true,
        type: "error",
        message: "Invalid navigation. Please start DayBook creation again.",
        moveTo: "/DayBook",
      });
    }
  }, [invalidNav]);

  if (invalidNav) {
    return (
      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        moveTo={popup.moveTo}
        onClose={() =>
          setPopup({ open: false, type: "success", message: "", moveTo: "" })
        }
      />
    );
  }
  if (!state?.entry_type || !state?.fin_year || !state?.daybook) {
    alert("Invalid navigation. Please start DayBook creation again.");
    navigate("/DayBook");
    return null;
  }
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Add DayBook Items</h2>

      {items.map((item, index) => (
        <div key={index} className="rounded-2xl border shadow-sm bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="font-medium">Item #{index + 1}</div>

            <div className="flex gap-2">
              {/* Auto generate serials for those whose serial number is not there */}
              {(() => {
                const cat = categories.find(
                  (c) => String(c.id) === String(item.item_category_id),
                );

                const canAutoGenerate =
                  cat &&
                  cat.serialized_required &&
                  item.quantity > 0 &&
                  (!item.serials || item.serials.length === 0);

                if (!canAutoGenerate) return null;

                return (
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border text-sm bg-gray-100"
                    onClick={() => {
                      const autoSerials = generateAutoSerials({
                        billDate: state?.daybook?.bill_date,
                        itemIndex: index,
                        quantity: Number(item.quantity),
                      });

                      setItems((prev) => {
                        const copy = [...prev];
                        copy[index].serials = autoSerials;
                        copy[index].showSerials = true;
                        return copy;
                      });
                    }}
                  >
                    Generate Serials
                  </button>
                );
              })()}

              {/* Serials toggle for serialized categories */}
              {(() => {
                const cat = categories.find(
                  (c) => String(c.id) === String(item.item_category_id),
                );

                if (cat?.serialized_required) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...items];
                        updated[index].showSerials =
                          !updated[index].showSerials;
                        setItems(updated);
                      }}
                      className="px-3 py-1.5 rounded border text-sm"
                    >
                      {item.showSerials ? "Hide Serials" : "Add Serials"}
                    </button>
                  );
                }

                return null;
              })()}

              <button
                type="button"
                onClick={() => removeItemRow(index)}
                className="px-3 py-1.5 rounded border text-sm text-red-600"
                aria-label="Remove item"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Body */}
          {/* Body: 12-col grid, 3 aligned rows */}
          <div className="p-4 grid gap-4 sm:grid-cols-12">
            {/* Row 2->1 */}
            <div className="sm:col-span-12 rounded-lg border p-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                Category Details
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Level 1: Category Head */}
                <div className="">
                  <label className="text-xs text-gray-600">Category Head</label>
                  <select
                    className={ctl}
                    value={item.category_head_id}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "category_head_id",
                        e.target.value,
                      )
                    }
                  >
                    <option value="">Select Head</option>
                    {categoryHeads.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.category_head_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level 2: Category Group */}
                <div className="">
                  <label className="text-xs text-gray-600">
                    Category Group
                  </label>
                  <select
                    className={ctl}
                    value={item.category_group_id}
                    disabled={!item.category_head_id}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "category_group_id",
                        e.target.value,
                      )
                    }
                  >
                    <option value="">Select Group</option>
                    {(item.groupOptions || []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.category_group_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Final: Item Category */}
                <div className="">
                  <label className="text-xs text-gray-600">Item Category</label>
                  <select
                    className={ctl}
                    value={item.item_category_id}
                    disabled={!item.category_group_id}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "item_category_id",
                        e.target.value,
                      )
                    }
                  >
                    <option value="">Select Category</option>
                    {categories
                      .filter(
                        (c) =>
                          String(c.group_id) === String(item.category_group_id),
                      )
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.category_name}
                        </option>
                      ))}
                  </select>
                </div>
                {/* </div> */}
              </div>
            </div>
            {/* Row 2->1 */}

            {/* Row 1 */}
            <div className="sm:col-span-12 rounded-lg border p-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                Item Details
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="">
                  <label className="text-xs text-gray-600">Item Name</label>
                  <input
                    className={ctl}
                    placeholder="e.g. HP Laptop 840"
                    value={item.item_name}
                    onChange={(e) =>
                      handleItemChange(index, "item_name", e.target.value)
                    }
                  />
                </div>

                <div className="">
                  <label className="text-xs text-gray-600">GST Type</label>
                  <select
                    className={ctl}
                    value={item.gst_type}
                    onChange={(e) =>
                      handleItemChange(index, "gst_type", e.target.value)
                    }
                  >
                    <option value="IGST">IGST</option>
                    <option value="CGST_SGST">CGST+SGST</option>
                  </select>
                </div>

                <div className="">
                  <label className="text-xs text-gray-600">GST %</label>
                  <input
                    type="number"
                    className={ctl}
                    placeholder="GST %"
                    value={item.gst_rate}
                    onChange={(e) =>
                      handleItemChange(index, "gst_rate", e.target.value)
                    }
                    onWheel={preventWheelChange}
                  />
                </div>

                {/* Row 3 */}
                <div className="">
                  <label className="text-xs text-gray-600">Quantity</label>
                  <input
                    type="number"
                    className={ctl}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemChange(index, "quantity", e.target.value)
                    }
                    onWheel={preventWheelChange}
                  />
                </div>

                <div className="">
                  <label className="text-xs text-gray-600">SKU Unit</label>
                  <select
                    className={ctl}
                    value={item.sku_unit || DEFAULT_SKU_UNIT}
                    onChange={(e) =>
                      handleItemChange(index, "sku_unit", e.target.value)
                    }
                  >
                    {SKU_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="">
                  <label className="text-xs text-gray-600">Rate</label>
                  <input
                    type="number"
                    className={ctl}
                    placeholder="Rate"
                    value={item.rate}
                    onChange={(e) =>
                      handleItemChange(index, "rate", e.target.value)
                    }
                    onWheel={preventWheelChange}
                  />
                </div>

                <div className="">
                  <label className="text-xs text-gray-600">Amount</label>
                  <input
                    readOnly
                    className={`${ctl} bg-gray-100 h-11 w-full rounded-md border font-semibold text-lg px-3`}
                    value={item.amount}
                    placeholder="Amount"
                  />
                </div>
                {/* Row 3 */}

                {/* Purchase date and warranty end */}
                {categories.find(
                  (c) => String(c.id) === String(item.item_category_id),
                )?.serialized_required ? (
                  <>
                    <div className="">
                      <label className="text-xs text-gray-600">
                        Purchase Date
                      </label>
                      <input
                        type="date"
                        className={ctl}
                        value={item.purchased_at || ""}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "purchased_at",
                            e.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="">
                      <label className="text-xs text-gray-600">
                        Warranty Expiry
                      </label>
                      <input
                        type="date"
                        className={ctl}
                        value={item.warranty_expiry || ""}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "warranty_expiry",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="" />
                )}
                {/* */}
              </div>
            </div>
            {/* Row 1 */}
          </div>

          {/* Serials panel */}
          {item.showSerials && (
            <div className="px-4 pb-4">
              <div className="border rounded p-3 bg-white">
                <SerialEntryPanel
                  itemIndex={index}
                  requestedQty={parseInt(item.quantity || 0, 10)}
                  serials={item.serials || []}
                  onChange={(newSerials) => {
                    const updated = [...items];
                    updated[index].serials = newSerials;
                    setItems(updated);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* <div className="flex gap-2"> */}
      <button
        onClick={addItemRow}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Add Item
      </button>

      {/* Optional changes collapse button */}
      <button
        type="button"
        onClick={() => setShowAdditionalCharges(!showAdditionalCharges)}
        className="flex items-center gap-2 text-blue-600 font-medium mt-6"
      >
        {showAdditionalCharges ? "▼" : "▶"} Other Charges (Optional)
      </button>

      {/* Below is the extra code added for adding the extra changes section */}
      {showAdditionalCharges && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h2 className="text-xl font-semibold mt-8">Additional Charges</h2>

          {additionalCharges.map((charge, index) => (
            <div
              key={index}
              className="rounded-2xl border shadow-sm bg-white mt-3"
            >
              <div className="flex justify-between px-4 py-2 border-b">
                <div className="font-medium">Charge #{index + 1}</div>
                <button
                  type="button"
                  onClick={() => removeChargeRow(index)}
                  className="text-red-600 text-sm"
                >
                  Remove
                </button>
              </div>

              <div className="p-4 grid gap-4 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <label className="text-xs">Charge Type</label>
                  <input
                    className={ctl}
                    placeholder="Logistics / Installation"
                    value={charge.charge_type}
                    onChange={(e) =>
                      handleChargeChange(index, "charge_type", e.target.value)
                    }
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="text-xs">GST Type</label>
                  <select
                    className={ctl}
                    value={charge.gst_type}
                    onChange={(e) =>
                      handleChargeChange(index, "gst_type", e.target.value)
                    }
                  >
                    <option value="IGST">IGST</option>
                    <option value="CGST_SGST">CGST+SGST</option>
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="text-xs">GST %</label>
                  <input
                    type="number"
                    className={ctl}
                    value={charge.gst_rate}
                    onChange={(e) =>
                      handleChargeChange(index, "gst_rate", e.target.value)
                    }
                    onWheel={preventWheelChange}
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="text-xs">Quantity</label>
                  <input
                    type="number"
                    className={ctl}
                    value={charge.quantity}
                    onChange={(e) =>
                      handleChargeChange(index, "quantity", e.target.value)
                    }
                    onWheel={preventWheelChange}
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="text-xs">Rate</label>
                  <input
                    type="number"
                    className={ctl}
                    value={charge.rate}
                    onChange={(e) =>
                      handleChargeChange(index, "rate", e.target.value)
                    }
                    onWheel={preventWheelChange}
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="text-xs">Amount</label>
                  <input
                    readOnly
                    className={`${ctl} bg-gray-100`}
                    value={charge.amount}
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addChargeRow}
            className="bg-blue-600 text-white px-4 py-2 rounded mt-2"
          >
            Add Charge
          </button>
        </div>
      )}
      {/* Uptill here the extra changes section */}

      <button
        onClick={handleSubmit}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Submit All
      </button>
      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        moveTo={popup.moveTo}
        onClose={() =>
          setPopup({ open: false, type: "success", message: "", moveTo: "" })
        }
      />

      {/* </div> */}
    </div>
  );
};

export default DayBookItemsForm;
