import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ListPage from "@/components/ListPage";
import axios from "axios";
import { DEFAULT_SKU_UNIT } from "@/constants/skuUnits";
import { STORE_API_BASE_URL, toStoreApiUrl } from "@/lib/api-config";

export default function DayBookItems() {
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState(null);
  const [daybook, setDaybook] = useState(null);
  const [additionalCharges, setAdditionalCharges] = useState([]);

  console.log(daybook);
  useEffect(() => {
    async function fetchDayBook() {
      try {
        const res = await axios.get(
          toStoreApiUrl(`/daybook/${id}/full`),
        );
        console.log("day book data data", res.data.data);
        setDaybook(res.data.data);
        setAdditionalCharges(res.data.data.DayBookAdditionalCharges || []);
        setData(res.data.data.DayBookItems || []);
        // console.log("daybook items data : ", res.data.data.DayBookItems);
      } catch (err) {
        console.error("Failed to fetch daybook header", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDayBook();
  }, [id]);
  const totals = React.useMemo(() => {
    let itemBase = 0;
    let itemGST = 0;
    let itemTotal = 0;

    let chargeBase = 0;
    let chargeGST = 0;
    let chargeTotal = 0;

    // Items

    data.forEach((i) => {
      const base = Number(i.quantity) * Number(i.rate);
      const total = Number(i.amount);
      itemBase += base;
      itemTotal += total;
      itemGST += total - base;
    });

    additionalCharges.forEach((c) => {
      const base = Number(c.quantity) * Number(c.rate);
      chargeBase += base;
      chargeGST += Number(c.gst_amount || 0);
      chargeTotal += Number(c.total_amount || 0);
    });

    return {
      itemBase,
      itemGST,
      itemTotal,
      chargeBase,
      chargeGST,
      chargeTotal,
      grandTotal: itemTotal + chargeTotal,
    };
  }, [data, additionalCharges]);

  const columns = [
    { key: "id", label: "ID" },
    { key: "item_name", label: "Item Name" },
    {
      key: "quantity",
      label: "Quantity",
      render: (val, row) => `${val ?? 0} ${row?.sku_unit || DEFAULT_SKU_UNIT}`,
    },

    { key: "rate", label: "Unit Rate" },
    { key: "gst_type", label: "Gst Type" },
    { key: "gst_rate", label: "GST %" },
    { key: "amount", label: "Total Amount" },
  ];

  
  const navigate = useNavigate();
  function handleAdd() {
    navigate("/vendors-entry");
  }
  function handleUpdate() {
    const selectedVendor = data.find((vendor) => vendor.id === selectedRows);

    console.log("Selected vendor 0", selectedVendor);
    // If a valid employee is selected, navigate to the update page with that employee's data
    if (selectedVendor) {
      navigate("/vendor-update", { state: { selectedVendor } });
    } else {
      alert("Please select a valid vendor");
    }
  }
  if (loading) {
    return <div>Loading Items...</div>;
  }

  const renderSerialTable = () => {
    // No row selected
    if (!selectedRows) {
      return (
        <div className="text-gray-500 italic">
          Select an item row to view serials.
        </div>
      );
    }

    // Find selected item from table data
    const item = data.find((d) => String(d.id) === String(selectedRows));

    if (!item) {
      return (
        <div className="text-gray-500 italic">Selected item not found.</div>
      );
    }

    const serials = Array.isArray(item.DayBookItemSerials)
      ? item.DayBookItemSerials
      : [];

    if (serials.length === 0) {
      return (
        <div className="text-gray-500 italic">
          No serials available for <b>{item.item_name}</b>.
        </div>
      );
    }

    return (
      <div className="rounded-xl border bg-white shadow-sm mt-4">
        <div className="px-4 py-3 border-b font-semibold">
          Serials — {item.item_name}
        </div>

        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="border px-3 py-2 text-left">#</th>
                <th className="border px-3 py-2 text-left">Serial Number</th>
                <th className="border px-3 py-2 text-left">Asset Tag</th>
                <th className="border px-3 py-2 text-left">Purchased At</th>
                <th className="border px-3 py-2 text-left">Warranty Expiry</th>
              </tr>
            </thead>

            <tbody>
              {serials.map((s, index) => (
                <tr key={s.id || index} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{index + 1}</td>
                  <td className="border px-3 py-2">{s.serial_number}</td>
                  <td className="border px-3 py-2">{s.asset_tag || "-"}</td>
                  <td className="border px-3 py-2">
                    {s.purchased_at
                      ? new Date(s.purchased_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="border px-3 py-2">
                    {s.warranty_expiry
                      ? new Date(s.warranty_expiry).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const additionalChargesTable =
    additionalCharges.length > 0 ? (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Additional Charges</h3>

        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Charge Type</th>
              {/* <th className="border p-2">Quantity</th> */}
              <th className="border p-2">Rate</th>
              <th className="border p-2">GST Type</th>
              <th className="border p-2">GST %</th>
              <th className="border p-2">GST Amount</th>
              <th className="border p-2">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {additionalCharges.map((c, i) => (
              <tr key={i}>
                <td className="border p-2">{c.charge_type}</td>
                {/* <td className="border p-2">{c.quantity}</td> */}
                <td className="border p-2">{c.rate}</td>
                <td className="border p-2">{c.gst_type}</td>
                <td className="border p-2">{c.gst_rate}%</td>
                <td className="border p-2">{c.gst_amount}</td>
                <td className="border p-2 font-medium">{c.total_amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null;

  const totalsSection = (
    <div className="mt-8 border-t pt-4">
      <h3 className="text-lg font-semibold mb-3">Summary</h3>

      <div className="grid grid-cols-2 gap-2 text-sm max-w-md">
        <div>Items Value</div>
        <div className="text-right">₹ {totals.itemBase.toFixed(2)}</div>

        <div>Items GST</div>
        <div className="text-right">₹ {totals.itemGST.toFixed(2)}</div>

        <div>Charges Value</div>
        <div className="text-right">₹ {totals.chargeBase.toFixed(2)}</div>

        <div>Charges GST</div>
        <div className="text-right">₹ {totals.chargeGST.toFixed(2)}</div>

        <div className="font-semibold border-t pt-2">Grand Total</div>
        <div className="text-right font-semibold border-t pt-2">
          ₹ {totals.grandTotal.toFixed(2)}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="mb-4 px-4 py-2 bg-black text-white rounded hover:bg-zinc-600"
        onClick={() => navigate(-1)} // go back to previous page
      >
        ← Back To DayBook's
      </button>
      <ListPage
        title={
          daybook?.entry_no
            ? `Day Book Details #${daybook.entry_no}`
            : "Day Book Details"
        }
        columns={columns}
        data={data}
        onAdd={handleAdd}
        apiUrl={`${STORE_API_BASE_URL}/daybook-items/${id}`}
        searchParam="name"
        idCol="id"
        belowContent={
          <>
            {renderSerialTable()}
            {additionalChargesTable}
            {totalsSection}
          </>
        }
        onUpdate={handleUpdate} // Pass handleUpdate to the ListPage
        onFilter={() => console.log("Filter")}
        selectedRows={selectedRows} // Pass selectedRows to ListPage
        setSelectedRows={setSelectedRows}
        showSearch={false}
        showAdd={false}
        showUpdate={false}
        showFilter={false}
      />
    </>
  );
}
