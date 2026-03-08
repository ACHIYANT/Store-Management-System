import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import logo from "/logo.svg";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { DEFAULT_SKU_UNIT } from "@/constants/skuUnits";

export default function MRNPage() {
  const { daybookId } = useParams();
  console.log(daybookId);
  const [daybook, setDaybook] = useState(null);
  const [items, setItems] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [printTimestamp, setPrintTimestamp] = useState("");
  const [gstType, setGstType] = useState(null);
  const [additionalCharges, setAdditionalCharges] = useState([]);
  const navigate = useNavigate();
  const getSkuUnit = (item) =>
    item?.sku_unit || item?.skuUnit || DEFAULT_SKU_UNIT;
  const formatQtyWithUnit = (qty, skuUnit) => {
    const n = Number(qty);
    const displayQty = Number.isFinite(n)
      ? Number.isInteger(n)
        ? String(parseInt(n, 10))
        : String(n)
      : String(qty ?? 0);
    return `${displayQty} ${skuUnit || DEFAULT_SKU_UNIT}`;
  };

  // const verificationUrl = daybook?.mrn_security_code
  //   ? `${window.location.origin}/api/v1/mrn/verify?code=${daybook.mrn_security_code}`
  //   : null;
  const verificationUrl = daybook?.mrn_security_code
    ? `${window.location.origin}/mrn/verify?code=${daybook.mrn_security_code}`
    : null;

  useEffect(() => {
    async function fetchCharges() {
      try {
        const res = await axios.get(
          `http://localhost:3000/api/v1/daybook-items/${daybookId}/additional-charges`,
        );
        setAdditionalCharges(res.data.data || []);
      } catch {
        setAdditionalCharges([]);
      }
    }

    if (daybookId) {
      fetchCharges();
    }
  }, [daybookId]);

  useEffect(() => {
    async function fetchData() {
      const daybookRes = await axios.get(
        `http://localhost:3000/api/v1/daybookById/${daybookId}`,
      );
      const itemsRes = await axios.get(
        `http://localhost:3000/api/v1/daybook-items/${daybookId}`,
      );

      setDaybook(daybookRes.data.data);
      setItems(itemsRes.data.data);
      console.log("ppp", itemsRes.data.data);
      // setGstType(itemsRes.data.data[0].gst_type);
      setGstType("CGST_SGST");
      console.log(typeof itemsRes.data.data[0].amount);
    }
    fetchData();
  }, [daybookId]);

  const [userName, setUserName] = useState("Login Name");
  useEffect(() => {
    const storedUser = localStorage.getItem("fullname");
    console.log(storedUser);
    if (storedUser) {
      setUserName(storedUser);
    }
  }, []);

  useEffect(() => {
    async function fetchVendor() {
      if (!daybook || !daybook.vendor_id) return;
      try {
        const vendorRes = await axios.get(
          `http://localhost:3000/api/v1/vendor-by-id/${daybook.vendor_id}`,
        );
        console.log("Vendor API response:", vendorRes.data); // 👈 ADD THIS
        setVendor(vendorRes.data);
      } catch (error) {
        console.error("Failed to fetch vendor:", error);
      }
    }

    fetchVendor();
  }, [daybook]);

  useEffect(() => {
    const handleBeforePrint = () => {
      const now = new Date();
      const formatted = now.toLocaleString();
      setPrintTimestamp(formatted);
    };
    handleBeforePrint();
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, []);

  if (!daybook) return <div>Loading MRN...</div>;
  console.log(gstType);

  const totalWithoutGST = items.reduce((sum, item, index) => {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    const subtotal = quantity * rate;

    console.log(
      `Item ${index + 1}: qty=${quantity}, rate=${rate}, subtotal=${subtotal}`,
    );

    return sum + subtotal;
  }, 0);

  const totalAmount = items.reduce((sum, item) => {
    const amount = Number(item.amount);
    return sum + amount;
  }, 0);
  const totalGst = totalAmount - totalWithoutGST;
  console.log("Total Without GST:", totalAmount);

  // ---------- ADDITIONAL CHARGES TOTALS ----------
  const chargesWithoutGST = additionalCharges.reduce(
    (sum, c) => sum + Number(c.quantity) * Number(c.rate),
    0,
  );

  console.log("chargesWithoutGST", chargesWithoutGST);
  const chargesGST = additionalCharges.reduce(
    (sum, c) => sum + Number(c.gst_amount || 0),
    0,
  );

  const chargesTotal = additionalCharges.reduce(
    (sum, c) => sum + Number(c.total_amount || 0),
    0,
  );

  // ---------- FINAL TOTALS (ITEMS + CHARGES) ----------
  const finalTotalWithoutGST = totalWithoutGST + chargesWithoutGST;
  const finalTotalGST = totalGst + chargesGST;
  const finalTotalAmount = totalAmount + chargesTotal;
  console.log("finalTotalWithoutGST", finalTotalWithoutGST);
  // let CGST = 0;
  // let SGST = 0;
  let finalCGST = 0;
  let finalSGST = 0;
  console.log("finaltotalGST", finalTotalGST);
  if (gstType == "CGST_SGST") {
    // CGST = totalGst / 2;
    // SGST = totalGst / 2;
    finalCGST = finalTotalGST / 2;
    finalSGST = finalTotalGST / 2;
  }

  const handleCancelMrn = async () => {
    const ok = window.confirm("Are you sure you want to cancel this MRN?");
    if (!ok) return;

    try {
      const res = await axios.post(
        `http://localhost:3000/api/v1/daybook/${daybookId}/cancel-mrn`,
        { confirmedNonSerialized: false },
      );

      if (res.data?.data?.requiresConfirmation) {
        const items = res.data.data.nonSerializedItems
          .map(
            (i) =>
              `${i.item_name} (${formatQtyWithUnit(i.quantity, getSkuUnit(i))})`,
          )
          .join("\n");

        const confirm2 = window.confirm(
          `Non-serialized items found:\n\n${items}\n\nConfirm return to stock?`,
        );

        if (!confirm2) return;

        await axios.post(
          `http://localhost:3000/api/v1/daybook/${daybookId}/cancel-mrn`,
          { confirmedNonSerialized: true },
        );
      }

      alert("MRN cancelled successfully.");
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel MRN.");
    }
  };

  return (
    <div className="print-container">
      <button
        className="mb-4 px-4 py-2 bg-black text-white rounded hover:bg-zinc-600"
        onClick={() => navigate(-1)} // go back to previous page
      >
        ← Back To Mrn's
      </button>
      <div className="print-watermark">
        <span>
          {daybook.status === "MRN Cancelled" ? (
            <>
              CANCELLED MRN
              <br />
              SYSTEM GENERATED
            </>
          ) : (
            <>
              OFFICIAL MRN
              <br />
              SYSTEM GENERATED
            </>
          )}
        </span>
      </div>
      <div className="print-content">
        {/* PRINT SAFE TOP SPACER */}
        {/* <div className="print-top-spacer" /> */}
        {/* Header */}
        <header className="display-block-force flex flex-col items-center justify-between border-b pb-2 mb-4 ">
          <img src={logo} alt="Company Logo" className="h-20 mt-2" />
          <h1 className="text-2xl font-bold text-center blockcls  flex-1">
            Haryana State Electronics Development Co-operation Ltd.
          </h1>
          <h2>(Haryana Government Undertaking)</h2>
          <h2>S.C.O. 111-113, SECTOR-17-B, CHANDIGARH - 160017</h2>
        </header>

        {/* MRN Title */}
        <h2 className="text-xl font-semibold mb-2 text-center">
          Material Receiving Note (MRN)
        </h2>
        {daybook.status === "MRN Cancelled" && (
          <div className="bg-red-100 text-red-800 p-2 rounded text-center mb-3">
            ⚠️ This MRN has been cancelled
          </div>
        )}
        {/* Daybook Info */}
        <div className="blockcls grid grid-cols-3 gap-4 text-sm mb-4">
          {vendor && (
            <div className="col-span-1 p-2">
              <strong>From:</strong>
              <p>{vendor.data.name}</p>
              <p>{vendor.data.address}</p>
              <p>GST No. : {vendor.data.gst_no}</p>
            </div>
          )}
          <div className="col-span-2 blockcls grid grid-cols-2 gap-2">
            <div>
              <strong>Entry No:</strong> {daybook.entry_no}
            </div>
            <div>
              <strong>Bill No:</strong> {daybook.bill_no}
            </div>
            <div>
              <strong>Bill Date:</strong> {daybook.bill_date}
            </div>
            <div>
              <strong>Financial Year:</strong> {daybook.fin_year}
            </div>

            <div>
              <strong>Status:</strong> {daybook.status}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-1">#</th>
              <th className="border p-1">Item Name</th>
              <th className="border p-1">Qty</th>
              <th className="border p-1">Unite Rate</th>
              <th className="border p-1">Amount Without GST</th>

              <th className="border p-1">GST %</th>
              <th className="border p-1">GST Amount</th>
              <th className="border p-1">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="border p-1">{idx + 1}</td>
                <td className="border p-1">{item.item_name}</td>
                <td className="border p-1">
                  {formatQtyWithUnit(item.quantity, getSkuUnit(item))}
                </td>
                <td className="border p-1">{item.rate}</td>
                <td className="border p-1">{item.rate * item.quantity}</td>

                <td className="border p-1">{item.gst_rate}</td>
                <td className="border p-1">
                  {(item.quantity * item.rate * (item.gst_rate / 100)).toFixed(
                    2,
                  )}
                </td>
                <td className="border p-1">{item.amount}</td>
              </tr>
            ))}

            {/* ADDITIONAL CHARGES ROWS */}
            {additionalCharges.map((charge, cIdx) => (
              <tr key={`charge-${cIdx}`} className="bg-gray-50">
                <td className="border p-1">{items.length + cIdx + 1}</td>
                <td className="border p-1">{charge.charge_type} (Charge)</td>

                <td className="border p-1">
                  {Number.isInteger(Number(charge.quantity))
                    ? parseInt(charge.quantity, 10)
                    : charge.quantity}
                </td>
                <td className="border p-1">{charge.rate}</td>
                <td className="border p-1">{charge.quantity * charge.rate}</td>
                <td className="border p-1">{charge.gst_rate}</td>
                <td className="border p-1">{charge.gst_amount}</td>
                <td className="border p-1">{charge.total_amount}</td>
              </tr>
            ))}

            {/* GST for IGST */}
            {gstType == "IGST" && (
              <tr>
                <td></td>
                <td className="border p-1">
                  <strong>Total</strong>
                </td>
                <td></td>
                <td></td>
                <td className="border p-1">
                  <strong>₹ {totalWithoutGST}</strong>
                </td>
                <td>
                  <strong>GST Type : {gstType}</strong>
                </td>
                <td className="border p-1">
                  <strong>
                    ₹{!isNaN(totalGst) ? totalGst.toFixed(2) : "0.00"}
                  </strong>
                </td>
                <td>
                  <strong>
                    ₹{!isNaN(totalAmount) ? totalAmount.toFixed(2) : "0.00"}
                  </strong>
                </td>
              </tr>
            )}
            {/* GST for CGST_SGST */}
            {gstType == "CGST_SGST" && (
              <tr>
                <td></td>
                <td className="border p-1">{/* <strong></strong> */}</td>
                <td className="border p-1"></td>
                <td className="border p-1"></td>
                <td className="border p-1"></td>
                <td className="border p-1">
                  <div style={{ whiteSpace: "nowrap" }}>
                    <strong>Type : SGST</strong>
                  </div>
                </td>
                <td className="border p-1">
                  <div
                    style={{
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div style={{ whiteSpace: "nowrap" }}>
                      <strong>
                        {" "}
                        CGST ₹
                        {!isNaN(finalCGST) ? finalCGST.toFixed(2) : "0.00"}{" "}
                      </strong>
                    </div>
                    {/* <br /> */}
                    <strong>
                      SGST ₹{!isNaN(finalSGST) ? finalSGST.toFixed(2) : "0.00"}
                    </strong>
                  </div>
                </td>
                <td className="border p-1">
                  <strong></strong>
                </td>
              </tr>
            )}

            {/* Total Row */}
            <tr>
              <td></td>
              <td className="border p-1">
                <strong>Total</strong>
              </td>
              <td></td>
              <td></td>
              <td className="border p-1">
                <strong>₹ {finalTotalWithoutGST}</strong>
              </td>
              <td>{/* <strong>GST Type : {gstType}</strong> */}</td>
              <td className="border p-1">
                <strong>
                  ₹{!isNaN(finalTotalGST) ? finalTotalGST.toFixed(2) : "0.00"}
                </strong>
              </td>
              <td>
                <strong>
                  ₹
                  {!isNaN(finalTotalAmount)
                    ? finalTotalAmount.toFixed(2)
                    : "0.00"}
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="print-only display-block-force flex flex-row justify-between">
        <div className="mt-4 text-sm leading-tight">
          <p className="m-0">
            <strong>Prepared By:</strong> {userName}
          </p>

          <p className="m-0">
            <strong>Printed By:</strong> {userName}
          </p>

          {printTimestamp && (
            <p className="m-0">
              <strong>Printed on:</strong> {printTimestamp}
            </p>
          )}

          <p className="print-only text-xs">
            <strong>Verification Code:</strong> {daybook.mrn_security_code}
          </p>
        </div>
        {verificationUrl && (
          <div
            className="mt-1 flex items-center gap-2"
            // style={{ breakInside: "avoid" }}
          >
            <div>
              <QRCodeSVG
                value={verificationUrl}
                // size={160}
                size={120}
                level="H"
                marginSize={2}
                imageSettings={{
                  src: "/logo.svg", // SVG from public folder
                  x: undefined,
                  y: undefined,
                  // height: 48,
                  height: 32,
                  // width: 48,
                  width: 32,
                  excavate: true, // VERY IMPORTANT
                }}
              />
            </div>

            <div className="text-xs leading-tight">
              {/* <p className="m-0">
              <strong>Verification Code:</strong> {daybook.mrn_security_code}
            </p> */}
              <p className="text-[0.68rem]">Scan QR to verify MRN</p>
            </div>
          </div>
        )}
      </div>

      <div className="print-only mt-2 ">
        <p className="text-[0.723rem]">
          <strong>
            **This is the system generated MRN after the approval of the
            competent authority. Hence, doesn't require the signature.
          </strong>
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 blockcls  flex gap-3 print:hidden">
        {daybook?.status !== "MRN Cancelled" && (
          <button
            onClick={handleCancelMrn}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Cancel MRN
          </button>
        )}

        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Print MRN
        </button>
      </div>
    </div>
  );
}
