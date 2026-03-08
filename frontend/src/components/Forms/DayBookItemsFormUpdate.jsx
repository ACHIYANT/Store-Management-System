import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import SerialEntryPanel from "../ui/SerialEntryPanel";
import { Icon, Trash2 } from "lucide-react";
import PopupMessage from "../PopupMessage"; // adjust path if needed
import { SKU_UNITS, DEFAULT_SKU_UNIT } from "@/constants/skuUnits";

const DayBookItemsFormUpdate = () => {
  const { state } = useLocation();
  console.log("state", state);
  const daybookId = state?.daybook?.id;
  console.log("DI", daybookId);
  const [categories, setCategories] = useState([]);
  const [categoryHeads, setCategoryHeads] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [showAdditionalCharges, setShowAdditionalCharges] = useState(false);
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
      groupOptions: [], // ✅ ADD THIS
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
  const [prefilled, setPrefilled] = useState(false);
  const [popup, setPopup] = useState({
    open: false,
    type: "success", // "success" | "error" | "info"
    message: "",
  });

  const navigate = useNavigate();
  const preventWheelChange = (e) => {
    e.target.blur();
  };
  useEffect(() => {
    async function fetchCategoryHeadsAndGroups() {
      try {
        const res = await axios.get(
          "http://localhost:3000/api/v1/category-head",
        );
        const resGroups = await axios.get(
          "http://localhost:3000/api/v1/category-group",
        );
        setCategoryHeads(res.data.data || []);
        setCategoryGroups(resGroups.data.data || []);
      } catch (err) {
        console.error("Error fetching category heads", err);
      }
    }
    fetchCategoryHeadsAndGroups();
  }, []);

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

  useEffect(() => {
    if (!daybookId || prefilled) return;

    let isMounted = true;

    async function loadExistingData() {
      try {
        const res = await axios.get(
          `http://localhost:3000/api/v1/daybook/${daybookId}/full`,
        );

        if (!isMounted) return;

        const db = res?.data?.data;
        if (!db) {
          console.warn("No daybook data received");
          return;
        }

        console.log("FULL DAYBOOK DATA:", db);

        /* ================================
        1️⃣ Prefill Items
      ================================= */

        const rawItems = Array.isArray(db.DayBookItems) ? db.DayBookItems : [];
        console.log("Raw items: ", rawItems);
        const uiItems = rawItems
          .filter((it) => it && typeof it === "object" && it.id)
          .map((it) => {
            const rawSerials = Array.isArray(it.DayBookItemSerials)
              ? it.DayBookItemSerials
              : [];

            const serials = rawSerials
              .filter((s) => s && typeof s === "object")
              .map((s) => ({
                serial_number: String(s.serial_number || ""),
                purchased_at: s.purchased_at
                  ? String(s.purchased_at).substring(0, 10)
                  : "",
                warranty_expiry: s.warranty_expiry
                  ? String(s.warranty_expiry).substring(0, 10)
                  : "",
                asset_tag: String(s.asset_tag || ""),
              }));

            return {
              id: it.id,
              item_name: String(it.item_name || ""),
              category_head_id: String(it.ItemCategory?.group?.head?.id || ""),
              category_group_id: String(it.ItemCategory?.group?.id || ""),
              item_category_id: String(it.item_category_id || ""),
              sku_unit: String(it.sku_unit || DEFAULT_SKU_UNIT),
              quantity:
                it.quantity !== null && it.quantity !== undefined
                  ? String(it.quantity)
                  : "",
              rate:
                it.rate !== null && it.rate !== undefined
                  ? String(it.rate)
                  : "",
              gst_type: String(it.gst_type || "IGST"),
              gst_rate:
                it.gst_rate !== null && it.gst_rate !== undefined
                  ? String(it.gst_rate)
                  : "",
              amount:
                it.amount !== null && it.amount !== undefined
                  ? String(it.amount)
                  : "",
              serials,
              showSerials: serials.length > 0,
              purchased_at: serials[0]?.purchased_at || "",
              warranty_expiry: serials[0]?.warranty_expiry || "",
            };
          });
      
        if (isMounted) {
          setItems(uiItems);

          // ✅ STEP 1: collect unique head IDs
          const uniqueHeadIds = [
            ...new Set(uiItems.map((i) => i.category_head_id).filter(Boolean)),
          ];

          // ✅ STEP 2: fetch groups per head ONCE
          Promise.all(
            uniqueHeadIds.map((headId) =>
              axios
                .get(
                  `http://localhost:3000/api/v1/category-group/by-head/${headId}`,
                )
                .then((res) => ({ headId, groups: res.data.data || [] })),
            ),
          ).then((results) => {
            setItems((prev) => {
              const copy = [...prev];

              copy.forEach((item) => {
                const match = results.find(
                  (r) => r.headId === item.category_head_id,
                );
                item.groupOptions = match ? match.groups : [];
              });

              return copy;
            });
          });
        }

        /* ================================
        2️⃣ Prefill Additional Charges
      ================================= */

        const rawCharges = Array.isArray(db.DayBookAdditionalCharges)
          ? db.DayBookAdditionalCharges
          : [];

        const uiCharges = rawCharges
          .filter((c) => c && typeof c === "object" && c.id)
          .map((c) => ({
            id: c.id,
            charge_type: String(c.charge_type || ""),
            description: String(c.description || ""),
            quantity:
              c.quantity !== null && c.quantity !== undefined
                ? String(c.quantity)
                : "",
            rate: c.rate !== null && c.rate !== undefined ? String(c.rate) : "",
            gst_type: String(c.gst_type || "IGST"),
            gst_rate:
              c.gst_rate !== null && c.gst_rate !== undefined
                ? String(c.gst_rate)
                : "",
            amount:
              c.total_amount !== null && c.total_amount !== undefined
                ? String(c.total_amount)
                : "",
          }));

        if (isMounted) {
          setAdditionalCharges(uiCharges);
          setShowAdditionalCharges(uiCharges.length > 0);
          setPrefilled(true);
        }
      } catch (err) {
        console.error("Failed to load existing daybook data:", err);
      }
    }

    loadExistingData();

    return () => {
      isMounted = false;
    };
  }, [daybookId, prefilled]);

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    console.log(index, field, value);
    updated[index][field] = value;

    // LEVEL 1 → Category Head changed
    if (field === "category_head_id") {
      updated[index].category_group_id = "";
      updated[index].item_category_id = "";
      updated[index].showSerials = false;
      updated[index].serials = [];

      updated[index].groupOptions = [];

      // ⛔ If head cleared, STOP here (no API call)
      if (!value) {
        setItems(updated);
        return;
      }

      axios
        .get(`http://localhost:3000/api/v1/category-group/by-head/${value}`)
        .then((res) => {

          setItems((prev) => {
            const copy = [...prev];
            copy[index].groupOptions = res.data.data || [];
            return copy;
          });
        });
    }

    // LEVEL 2 → Category Group changed
    if (field === "category_group_id") {
      updated[index].item_category_id = "";
    }
    /* ✅ NEW: Sync parent dates into serials */
    if (field === "purchased_at" || field === "warranty_expiry") {
      updated[index].serials = (updated[index].serials || []).map((s) => ({
        ...s,
        [field]: value || null,
      }));
    }

    // Auto-calculate amount if needed
    if (["quantity", "rate", "gst_rate"].includes(field)) {
      const qty = parseFloat(updated[index].quantity) || 0;
      const rate = parseFloat(updated[index].rate) || 0;
      const gst = parseFloat(updated[index].gst_rate) || 0;
      //   updated[index].amount = (qty * rate * (1 + gst / 100)).toFixed(2);
      let gstMultiplier = 1;

      if (updated[index].gst_type === "IGST") {
        gstMultiplier = 1 + gst / 100;
      } else if (updated[index].gst_type === "CGST_SGST") {
        gstMultiplier = 1 + gst / 100; // total is still 18% (9% + 9%)
      }

      updated[index].amount = (qty * rate * gstMultiplier).toFixed(2);
    }

    // NEW: if category changed to non-serialized, collapse and clear serials
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
        serials: [],
        showSerials: false,
        purchased_at: "",
        warranty_expiry: "",
        groupOptions: [],
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
      console.log("itttttt", items);
      const totalItemAmount = items.reduce(
        (sum, i) => sum + Number(i.amount || 0),
        0,
      );

      const totalChargeAmount = additionalCharges.reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0,
      );

      const totalCalculated = (totalItemAmount + totalChargeAmount).toFixed(2);

      console.log("ssss", state);
      const billAmount = Number(state?.daybook?.total_amount || 0);
      if (billAmount < totalCalculated) {
        setPopup({
          open: true,
          type: "error",
          message: `Total items amount + Additional charges (${totalCalculated}) cannot be more than the Bill amount (${billAmount}).`,
        });
        return;
      }

      const payload = {
        items: items.map((i) => ({
          id: i.id || null,
          item_name: i.item_name,
          item_category_id: Number(i.item_category_id),
          sku_unit: i.sku_unit || DEFAULT_SKU_UNIT,
          quantity: Number(i.quantity),
          rate: Number(i.rate),
          gst_type: i.gst_type,
          gst_rate: Number(i.gst_rate),
          amount: Number(i.amount),
          // serials: i.serials || [],
          serials: (i.serials || []).map((s) => ({
            serial_number:
              typeof s === "string" ? s : String(s.serial_number || ""),
            purchased_at: s?.purchased_at || i.purchased_at || null,
            warranty_expiry: s?.warranty_expiry || i.warranty_expiry || null,
          })),
          purchased_at: i.purchased_at || null,
          warranty_expiry: i.warranty_expiry || null,
          // groupOptions: [], // <-- REQUIRED
        })),
        additionalCharges: additionalCharges.map((c) => ({
          charge_type: c.charge_type,
          description: c.description,
          quantity: Number(c.quantity),
          rate: Number(c.rate),
          gst_type: c.gst_type,
          gst_rate: Number(c.gst_rate),
          total_amount: Number(c.amount),
        })),
      };
      console.log("FINAL PAYLOAD ITEMS:", payload.items);

      console.log(payload);
      const res = await axios.put(
        `http://localhost:3000/api/v1/daybook/${daybookId}/items`,
        payload,
        { headers: { "Content-Type": "application/json" } },
      );

      // 2) Assume server returns created items in the same order, with ids
      const created = res.data?.data; // [{ id, ... }, ...]

      if (!Array.isArray(created)) {
        setPopup({
          open: true,
          type: "error",
          message: "Items saved, but response missing created item IDs.",
        });
        return;
      }

      // Helper to find if a category is serialized
      const isSerialized = (catId) =>
        categories.find((c) => String(c.id) === String(catId))
          ?.serialized_required;

      // 3) For each serialized DayBookItem with serials, send bulk serials
      for (let i = 0; i < items.length; i++) {
        const uiItem = items[i];
        if (!isSerialized(uiItem.item_category_id)) continue;

        const daybook_item_id = created[i]?.id; // id for this row
        if (!daybook_item_id) continue;

        const serialsArray = Array.isArray(uiItem.serials)
          ? uiItem.serials
          : [];
        if (serialsArray.length === 0) continue;

        // normalize serials to objects
        const serials = serialsArray.map((s) =>
          typeof s === "string"
            ? { serial_number: s }
            : { serial_number: s.serial_number },
        );

        // defaults: purchase + warranty dates from this row
        const body = {
          daybook_item_id,
          purchased_at: uiItem.purchased_at || null,
          warranty_expiry: uiItem.warranty_expiry || null,
          serials,
        };

        await axios.post(
          "http://localhost:3000/api/v1/daybook-item-serials/bulk",
          body,
          { headers: { "Content-Type": "application/json" } },
        );
      }

      setPopup({
        open: true,
        type: "success",
        message: "DayBook items and serials updated successfully.",
      });

      // navigate after small delay so user sees popup
      setTimeout(() => {
        navigate("/DayBook");
      }, 1200);

    } catch (error) {

      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update DayBook items.";

      setPopup({
        open: true,
        type: "error",
        message: msg,
      });
    }
  };

  const ctl = "border rounded p-2 h-11 w-full"; // same height for input + select
  const generateAutoSerials = ({ entryNo, billDate, itemIndex, quantity }) => {
    const datePart = billDate
      ? billDate.replaceAll("-", "")
      : new Date().toISOString().slice(0, 10).replaceAll("-", "");

    const base = `${entryNo}-${String(itemIndex + 1).padStart(2, "0")}-${datePart}`;

    return Array.from({ length: quantity }, (_, i) => ({
      serial_number: `${base}-${String(i + 1).padStart(3, "0")}`,
    }));
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Update DayBook Items</h2>

      {items.map((item, index) => (
        <div
          key={item.id ?? index}
          className="rounded-2xl border shadow-sm bg-white"
        >
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
                        entryNo: state?.daybook?.entry_no,
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
                <div>
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
                <div>
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
                    {/* {categoryGroups
                      .filter(
                        (g) =>
                          String(g.head_id) === String(item.category_head_id),
                      )
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.category_group_name}
                        </option>
                      ))} */}

                    {(item.groupOptions || []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.category_group_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Final: Item Category */}
                <div>
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
                {/* Purchase date and warranty end */}
              </div>
            </div>
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
          <PopupMessage
            open={popup.open}
            type={popup.type}
            message={popup.message}
            onClose={() => setPopup((p) => ({ ...p, open: false }))}
          />
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
              key={charge.id ?? index}
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
      {/* </div> */}
      <PopupMessage
        open={popup.open}
        onClose={() => setPopup({ open: false, type: "", message: "" })}
        type={popup.type}
        message={popup.message}
      />
    </div>
  );
};

export default DayBookItemsFormUpdate;
