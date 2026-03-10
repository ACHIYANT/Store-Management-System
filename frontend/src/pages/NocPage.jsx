import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import logo from "/logo.svg";
import { STORE_API_BASE_URL } from "@/lib/api-config";

const API = STORE_API_BASE_URL;
const safe = (value) => (value == null || value === "" ? "-" : value);
const isValidAssetId = (value) => {
  if (value == null) return false;
  const normalized = String(value).trim();
  return normalized !== "" && normalized !== "-";
};
const renderAssetLink = (assetId, label) => {
  if (!isValidAssetId(assetId)) return safe(label);
  return (
    <Link
      to={`/asset/${assetId}/timeline`}
      className="text-blue-600 underline hover:text-blue-800 print:text-black print:no-underline"
    >
      {safe(label)}
    </Link>
  );
};

function buildNocNumber(employeeId) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `NOC-${employeeId}-${yyyy}${mm}${dd}`;
}

export default function NocPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [outstandingAssets, setOutstandingAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preparedBy, setPreparedBy] = useState("Login Name");
  const [printTimestamp, setPrintTimestamp] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("fullname");
    if (storedUser) setPreparedBy(storedUser);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        setLoading(true);
        const [empRes, assetRes] = await Promise.all([
          axios.get(`${API}/employee/${id}`),
          axios.get(`${API}/assets/by-employee/${id}`),
        ]);
        setEmployee(empRes?.data?.data || null);
        setOutstandingAssets(assetRes?.data?.data || []);
      } catch (error) {
        console.error("Failed to fetch NOC data:", error);
        setEmployee(null);
        setOutstandingAssets([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const eligible = outstandingAssets.length === 0;
  const nocNumber = useMemo(() => buildNocNumber(id), [id]);

  const handlePrint = () => {
    setPrintTimestamp(new Date().toLocaleString());
    setTimeout(() => window.print(), 50);
  };

  if (loading) return <div>Loading NOC...</div>;

  return (
    <div className="print-container">
      <button
        className="mb-4 rounded bg-black px-4 py-2 text-white hover:bg-zinc-600 print:hidden"
        onClick={() => navigate(-1)}
      >
        Back
      </button>

      <div className="print-watermark">
        <span>
          NOC
          <br />
          SYSTEM GENERATED
        </span>
      </div>

      <div className="print-content">
        <header className="display-block-force mb-4 flex flex-col items-center justify-between border-b pb-2">
          <img src={logo} alt="Company Logo" className="mt-2 h-20" />
          <h1 className="blockcls flex-1 text-center text-2xl font-bold">
            Haryana State Electronics Development Co-operation Ltd.
          </h1>
          <h2>(Haryana Government Undertaking)</h2>
          <h2>S.C.O. 111-113, SECTOR-17-B, CHANDIGARH - 160017</h2>
        </header>

        <h2 className="mb-2 text-center text-xl font-semibold">
          No Objection Certificate (NOC)
        </h2>

        <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
          <div className="col-span-2 rounded border p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong>Employee Name:</strong> {safe(employee?.name)}
              </div>
              <div>
                <strong>Employee ID:</strong> {safe(employee?.emp_id)}
              </div>
              <div>
                <strong>Designation:</strong> {safe(employee?.designation)}
              </div>
              <div>
                <strong>Division:</strong> {safe(employee?.division)}
              </div>
              <div>
                <strong>Email:</strong> {safe(employee?.email_id)}
              </div>
              <div>
                <strong>Mobile:</strong> {safe(employee?.mobile_no)}
              </div>
              <div className="col-span-2">
                <strong>Office Location:</strong> {safe(employee?.office_location)}
              </div>
            </div>
          </div>

          <div className="rounded border p-3 space-y-2">
            <div>
              <strong>NOC No:</strong> {nocNumber}
            </div>
            <div>
              <strong>Date:</strong> {new Date().toLocaleDateString()}
            </div>
            <div>
              <strong>Status:</strong>{" "}
              <span
                className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                  eligible
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {eligible ? "Eligible for NOC" : "Pending Asset Clearance"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded border p-4 text-sm leading-6 mb-4">
          {eligible ? (
            <>
              This is to certify that <strong>{safe(employee?.name)}</strong> (
              Employee ID: <strong>{safe(employee?.emp_id)}</strong>) has no pending
              issued assets in the store records as on{" "}
              <strong>{new Date().toLocaleDateString()}</strong>. Hence, this No
              Objection Certificate is issued for official purposes.
              <br />
              <br />
              Items retained under approved retirement policy do not block NOC
              issuance and are treated as policy-compliant closure.
            </>
          ) : (
            <>
              NOC cannot be issued currently because asset clearance is pending for
              <strong> {safe(employee?.name)}</strong>. Please return/close the
              following outstanding issued assets first.
            </>
          )}
        </div>

        {!eligible && (
          <table className="w-full border border-collapse text-sm">
            <thead>
              <tr className="bg-gray-200">
                <th className="border p-1">#</th>
                <th className="border p-1">Asset ID</th>
                <th className="border p-1">Asset Tag</th>
                <th className="border p-1">Serial Number</th>
                <th className="border p-1">Status</th>
                <th className="border p-1">Item Category</th>
              </tr>
            </thead>
            <tbody>
              {outstandingAssets.map((asset, idx) => {
                const assetId = asset?.id ?? asset?.asset_id;
                return (
                  <tr key={assetId || idx}>
                    <td className="border p-1">{idx + 1}</td>
                    <td className="border p-1">
                      {renderAssetLink(assetId, assetId)}
                    </td>
                    <td className="border p-1">
                      {renderAssetLink(assetId, asset.asset_tag)}
                    </td>
                    <td className="border p-1">
                      {renderAssetLink(assetId, asset.serial_number)}
                    </td>
                    <td className="border p-1">{safe(asset.status)}</td>
                    <td className="border p-1">
                      {safe(asset?.ItemCategory?.category_name)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div className="pt-10 border-t">
            <strong>Store Incharge</strong>
            <div>Name & Signature</div>
          </div>
          <div className="pt-10 border-t text-right">
            <strong>Authorized Signatory</strong>
            <div>Name & Signature</div>
          </div>
        </div>
      </div>

      <div className="print-only display-block-force mt-4 flex flex-row justify-between">
        <div className="text-sm leading-tight">
          <p className="m-0">
            <strong>Prepared By:</strong> {preparedBy}
          </p>
          {printTimestamp && (
            <p className="m-0">
              <strong>Printed On:</strong> {printTimestamp}
            </p>
          )}
        </div>
      </div>

      <div className="print:hidden mt-6 flex gap-3">
        <button
          onClick={handlePrint}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Print NOC
        </button>
      </div>
    </div>
  );
}
