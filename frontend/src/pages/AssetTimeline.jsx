import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useNavigate, useParams } from "react-router-dom";
import { toStoreApiUrl } from "@/lib/api-config";

function getEventStyle(eventType) {
  const value = String(eventType || "")
    .toLowerCase()
    .replace(/\s+/g, "");

  const map = {
    created: {
      chip: "bg-green-100 text-green-700",
      dot: "bg-green-500",
    },
    issued: {
      chip: "bg-blue-100 text-blue-700",
      dot: "bg-blue-500",
    },
    returned: {
      chip: "bg-yellow-100 text-yellow-800",
      dot: "bg-yellow-500",
    },
    transferred: {
      chip: "bg-indigo-100 text-indigo-700",
      dot: "bg-indigo-500",
    },
    submittedtostore: {
      chip: "bg-purple-100 text-purple-700",
      dot: "bg-purple-500",
    },
    repairout: {
      chip: "bg-pink-100 text-pink-700",
      dot: "bg-pink-500",
    },
    repairin: {
      chip: "bg-violet-100 text-violet-700",
      dot: "bg-violet-500",
    },
    markedewaste: {
      chip: "bg-yellow-100 text-yellow-800",
      dot: "bg-yellow-500",
    },
    ewasteout: {
      chip: "bg-orange-100 text-orange-700",
      dot: "bg-orange-500",
    },
    adjusted: {
      chip: "bg-slate-100 text-slate-700",
      dot: "bg-slate-500",
    },
    disposed: {
      chip: "bg-stone-200 text-stone-800",
      dot: "bg-stone-600",
    },
    lost: {
      chip: "bg-red-100 text-red-700",
      dot: "bg-red-500",
    },
    retained: {
      chip: "bg-indigo-100 text-indigo-700",
      dot: "bg-indigo-500",
    },
    mrncancelled: {
      chip: "bg-red-200 text-red-800",
      dot: "bg-red-700",
    },
  };

  return (
    map[value] || {
      chip: "bg-gray-100 text-gray-700",
      dot: "bg-gray-400",
    }
  );
}

function personText(person, fallbackId) {
  if (!person && !fallbackId) return "System / N.A.";
  if (!person) return `ID ${fallbackId}`;
  return `${person.emp_id} | ${person.name} (${person.division || "-"})`;
}

const EVENT_DEFAULT_PARTIES = {
  Created: { from: "Procurement Process", to: "Store" },
  Issued: { from: "Store", to: "Employee" },
  Returned: { from: "Employee", to: "Store" },
  Transferred: { from: "From Employee", to: "To Employee" },
  SubmittedToStore: { from: "Employee", to: "Store" },
  RepairOut: { from: "Store / Employee", to: "Repair Vendor" },
  RepairIn: { from: "Repair Vendor", to: "Store" },
  MarkedEWaste: { from: "Store", to: "E-Waste Yard" },
  EWasteOut: { from: "E-Waste Yard", to: "E-Waste Vendor" },
  Adjusted: { from: "System", to: "System" },
  Disposed: { from: "Store", to: "Disposed" },
  Lost: { from: "Employee / Store", to: "Lost" },
  Retained: { from: "Employee", to: "Retained by Employee" },
  "MRN Cancelled": { from: "System", to: "Store" },
};

function partyText(event, side) {
  const person = side === "from" ? event.from_employee : event.to_employee;
  const id = side === "from" ? event.from_employee_id : event.to_employee_id;
  if (person || id) return personText(person, id);
  return EVENT_DEFAULT_PARTIES[event.event_type]?.[side] || "Not captured";
}

function normalizePerson(raw) {
  if (!raw) return null;
  return {
    emp_id: raw.emp_id ?? raw.empId ?? null,
    name: raw.name ?? null,
    division: raw.division ?? null,
  };
}

function normalizeAsset(raw, fallbackId) {
  if (!raw && !fallbackId) return null;
  return {
    id: raw?.id ?? raw?.asset_id ?? raw?.assetId ?? fallbackId ?? null,
    serial_number: raw?.serial_number ?? raw?.serialNumber ?? null,
    asset_tag: raw?.asset_tag ?? raw?.assetTag ?? null,
    item_name:
      raw?.item_name ??
      raw?.itemName ??
      raw?.Stock?.item_name ??
      raw?.Stock?.itemName ??
      null,
  };
}

function buildApprovalViewUrl(encryptedPath) {
  if (!encryptedPath) return null;
  const normalized = String(encryptedPath).replace(/^\/+/, "");
  const relativePath = normalized.startsWith("uploads/")
    ? normalized.slice("uploads/".length)
    : normalized;
  return toStoreApiUrl(`/view-image?path=${encodeURIComponent(relativePath)}`);
}

function normalizeEvent(event) {
  const fromPerson = normalizePerson(event.from_employee || event.fromEmployee);
  const toPerson = normalizePerson(event.to_employee || event.toEmployee);

  const fromId =
    event.from_employee_id ??
    event.fromEmployeeId ??
    fromPerson?.emp_id ??
    null;
  const toId =
    event.to_employee_id ?? event.toEmployeeId ?? toPerson?.emp_id ?? null;

  const assetId = event.asset_id ?? event.assetId ?? event.Asset?.id ?? null;
  const asset = normalizeAsset(event.asset || event.Asset, assetId);

  return {
    id: event.id ?? null,
    event_type: event.event_type ?? event.eventType ?? "Unknown",
    event_date: event.event_date ?? event.eventDate ?? event.createdAt ?? null,
    notes: event.notes ?? null,
    approval_document_url:
      event.approval_document_url ?? event.approvalDocumentUrl ?? null,
    performed_by: event.performed_by ?? event.performedBy ?? null,
    daybook_id: event.daybook_id ?? event.daybookId ?? null,
    issued_item_id: event.issued_item_id ?? event.issuedItemId ?? null,
    asset_id: asset?.id ?? assetId,
    from_employee_id: fromId,
    to_employee_id: toId,
    from_employee: fromPerson,
    to_employee: toPerson,
    asset,
  };
}

export default function AssetTimeline() {
  const params = useParams();
  const navigate = useNavigate();
  const assetId = params.assetId ?? params.id;

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const assetSummary = useMemo(
    () => events.find((event) => event.asset)?.asset || null,
    [events],
  );

  useEffect(() => {
    if (!assetId) {
      setEvents([]);
      setLoading(false);
      setError("Missing asset ID in URL");
      return;
    }

    setLoading(true);
    setError("");

    axios
      .get(toStoreApiUrl(`/asset-events/timeline/${assetId}`))
      .then((res) => {
        const payload = res.data;
        const data = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];
        setEvents(data.map(normalizeEvent));
      })
      .catch((err) => {
        console.error("Failed to fetch timeline:", err);
        setEvents([]);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to fetch timeline",
        );
      })
      .finally(() => setLoading(false));
  }, [assetId]);

  return (
    <div className="p-4 space-y-4">
      <div className="sticky top-4 z-20 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs tracking-wide uppercase text-slate-500">
              Asset Timeline
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Asset #{assetId || "-"}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {assetSummary
                ? `SN: ${assetSummary.serial_number || "-"} | TAG: ${assetSummary.asset_tag || "-"} | ${assetSummary.item_name || "-"}`
                : "No asset metadata available"}
            </p>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm"
          >
            Back
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading timeline...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="text-sm text-gray-500">No events found.</div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200" />

          {events.map((event, idx) => {
            const style = getEventStyle(event.event_type);

            return (
              <div
                key={
                  event.id ?? `${event.event_type}-${event.event_date}-${idx}`
                }
                className="relative mb-4"
              >
                <span
                  className={`absolute -left-[1.17rem] top-5 h-3 w-3 rounded-full border-2 border-white ${style.dot}`}
                />

                <Card className="border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style.chip}`}
                    >
                      {event.event_type}
                    </span>
                    <span className="text-xs text-slate-500">
                      {event.event_date
                        ? new Date(event.event_date).toLocaleString()
                        : "-"}
                    </span>
                  </div>

                  <Separator className="my-3" />

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        From
                      </div>
                      <div className="mt-1 text-slate-800">
                        {partyText(event, "from")}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        To
                      </div>
                      <div className="mt-1 text-slate-800">
                        {partyText(event, "to")}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Asset ID
                      </div>
                      <div className="mt-1 text-slate-800">
                        {event.asset_id ?? "-"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        DayBook ID
                      </div>
                      <div className="mt-1 text-slate-800">
                        {event.daybook_id ?? "Not linked"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Issued Item ID
                      </div>
                      <div className="mt-1 text-slate-800">
                        {event.issued_item_id ?? "Not linked"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Noting Approval
                      </div>
                      <div className="mt-1 text-slate-800">
                        {buildApprovalViewUrl(event.approval_document_url) ? (
                          <a
                            href={buildApprovalViewUrl(
                              event.approval_document_url,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            View Approval
                          </a>
                        ) : (
                          "Not uploaded"
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Performed By
                      </div>
                      <div className="mt-1 text-slate-800">
                        {event.performed_by || "System"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Notes
                      </div>
                      <div className="mt-1 text-slate-800">
                        {event.notes || "No notes"}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
