import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toStoreApiUrl } from "@/lib/api-config";
import Modal from "@/components/Modal";
import AssetReturnForm from "@/components/Forms/AssetReturnForm";
import AssetTransferForm from "@/components/Forms/AssetTransferForm";
import AssetRepairForm from "@/components/Forms/AssetRepairForm";
import AssetFinalizeForm from "@/components/Forms/AssetFinalizeForm";
import AssetRetainForm from "@/components/Forms/AssetRetainForm";

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
  const empId = person?.emp_id ?? fallbackId ?? "-";
  const name = person?.name ?? "-";
  const division = person?.division ?? "-";
  const location = person?.office_location ?? person?.location ?? "-";
  return `EMPLOYEE | ${empId} | ${name} | ${division} | ${location}`;
}

function custodianText(custodian, fallbackId, fallbackType) {
  const id = custodian?.id ?? fallbackId ?? null;
  const type = custodian?.type ?? fallbackType ?? null;
  const name = custodian?.name ?? null;
  const location = custodian?.location ?? null;
  if (!id && !type && !name && !location) return "Not captured";
  const normalizedType = String(type || "CUSTODIAN").toUpperCase();
  return `${normalizedType} | ${id || "-"} | ${name || "-"} | ${location || "-"}`;
}

const EVENT_DEFAULT_PARTIES = {
  Created: { from: "Procurement Process", to: "Store" },
  Issued: { from: "Store", to: "Custodian" },
  Returned: { from: "Custodian", to: "Store" },
  Transferred: { from: "From Custodian", to: "To Custodian" },
  SubmittedToStore: { from: "Custodian", to: "Store" },
  RepairOut: { from: "Store / Custodian", to: "Repair Vendor" },
  RepairIn: { from: "Repair Vendor", to: "Store" },
  MarkedEWaste: { from: "Store", to: "E-Waste Yard" },
  EWasteOut: { from: "E-Waste Yard", to: "E-Waste Vendor" },
  Adjusted: { from: "System", to: "System" },
  Disposed: { from: "Store", to: "Disposed" },
  Lost: { from: "Custodian / Store", to: "Lost" },
  Retained: { from: "Custodian", to: "Retained by Custodian" },
  "MRN Cancelled": { from: "System", to: "Store" },
};

function partyText(event, side) {
  const person = side === "from" ? event.from_employee : event.to_employee;
  const id = side === "from" ? event.from_employee_id : event.to_employee_id;
  if (person || id) return personText(person, id);

  const sideCustodian = side === "from" ? event.from_custodian : event.to_custodian;
  const sideCustodianId =
    side === "from" ? event.from_custodian_id : event.to_custodian_id;
  const sideCustodianType =
    side === "from" ? event.from_custodian_type : event.to_custodian_type;
  if (sideCustodian || sideCustodianId || sideCustodianType) {
    return custodianText(
      sideCustodian,
      sideCustodianId,
      sideCustodianType,
    );
  }

  const eventType = String(event.event_type || "");
  const fallbackCustodian =
    side === "to" && ["Issued", "Transferred", "Retained"].includes(eventType)
      ? event.custodian
      : side === "from" &&
          ["Returned", "SubmittedToStore"].includes(eventType)
        ? event.custodian
        : null;
  if (fallbackCustodian) {
    return custodianText(
      fallbackCustodian,
      event.custodian_id,
      event.custodian_type,
    );
  }

  return EVENT_DEFAULT_PARTIES[event.event_type]?.[side] || "Not captured";
}

function normalizePerson(raw) {
  if (!raw) return null;
  return {
    emp_id: raw.emp_id ?? raw.empId ?? null,
    name: raw.name ?? null,
    division: raw.division ?? null,
    office_location: raw.office_location ?? raw.officeLocation ?? null,
  };
}

function normalizeCustodian(raw, fallbackId = null, fallbackType = null) {
  const id = raw?.id ?? raw?.custodian_id ?? raw?.custodianId ?? fallbackId ?? null;
  const type =
    raw?.type ??
    raw?.custodian_type ??
    raw?.custodianType ??
    fallbackType ??
    null;
  const name = raw?.name ?? raw?.display_name ?? raw?.displayName ?? null;
  const location = raw?.location ?? null;
  if (!id && !type && !name && !location) return null;
  return { id, type, name, location };
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

function resolveNotingLink(event) {
  const approvalUrl = buildApprovalViewUrl(event?.approval_document_url);
  if (approvalUrl) {
    return {
      href: approvalUrl,
      label: "View Approval",
      external: true,
    };
  }

  if (String(event?.event_type || "") !== "Issued") return null;

  const source = String(event?.issued_item_source || "").toUpperCase();
  const requisitionId = event?.requisition_id ?? null;
  const requisitionReqNo = event?.requisition_req_no ?? null;
  const offlineReqUrl = buildApprovalViewUrl(event?.requisition_url);

  if (source === "OFFLINE_REQUISITION" && offlineReqUrl) {
    return {
      href: offlineReqUrl,
      label: "Offline Requisition",
      external: true,
    };
  }

  if (requisitionId) {
    return {
      href: `/requisitions/${requisitionId}`,
      label: requisitionReqNo || `Online Req #${requisitionId}`,
      external: false,
    };
  }

  if (offlineReqUrl) {
    return {
      href: offlineReqUrl,
      label: "Offline Requisition",
      external: true,
    };
  }

  return null;
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
  const custodianId =
    event.custodian_id ?? event.custodianId ?? event.custodian?.id ?? null;
  const custodianType =
    event.custodian_type ??
    event.custodianType ??
    event.custodian?.type ??
    null;
  const custodian = normalizeCustodian(event.custodian, custodianId, custodianType);
  const fromCustodianId =
    event.from_custodian_id ??
    event.fromCustodianId ??
    event.from_custodian?.id ??
    event.fromCustodian?.id ??
    null;
  const fromCustodianType =
    event.from_custodian_type ??
    event.fromCustodianType ??
    event.from_custodian?.type ??
    event.fromCustodian?.type ??
    null;
  const toCustodianId =
    event.to_custodian_id ??
    event.toCustodianId ??
    event.to_custodian?.id ??
    event.toCustodian?.id ??
    null;
  const toCustodianType =
    event.to_custodian_type ??
    event.toCustodianType ??
    event.to_custodian?.type ??
    event.toCustodian?.type ??
    null;
  const fromCustodian = normalizeCustodian(
    event.from_custodian || event.fromCustodian,
    fromCustodianId,
    fromCustodianType,
  );
  const toCustodian = normalizeCustodian(
    event.to_custodian || event.toCustodian,
    toCustodianId,
    toCustodianType,
  );

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
    issued_item_source:
      event.issued_item_source ?? event.issuedItemSource ?? null,
    requisition_url: event.requisition_url ?? event.requisitionUrl ?? null,
    requisition_id: event.requisition_id ?? event.requisitionId ?? null,
    requisition_req_no:
      event.requisition_req_no ?? event.requisitionReqNo ?? null,
    asset_id: asset?.id ?? assetId,
    custodian_id: custodianId,
    custodian_type: custodianType,
    custodian,
    from_custodian_id: fromCustodianId,
    from_custodian_type: fromCustodianType,
    from_custodian: fromCustodian,
    to_custodian_id: toCustodianId,
    to_custodian_type: toCustodianType,
    to_custodian: toCustodian,
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
  const assetIdNumber = Number(assetId);
  const assetIds = Number.isFinite(assetIdNumber) ? [assetIdNumber] : [];

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [assetId, refreshKey]);

  const openActionDialog = (nextDialog) => {
    if (!assetIds.length) return;
    setDialog(nextDialog);
  };

  const handleActionDone = (success) => {
    if (!success) return;
    setDialog(null);
    setRefreshKey((prev) => prev + 1);
  };

  const actions = [
    { key: "return", label: "Return" },
    { key: "transfer", label: "Transfer" },
    { key: "repairOut", label: "Repair Out" },
    { key: "repairIn", label: "Repair In" },
    { key: "finalize", label: "Dispose / Lost / E-Waste" },
    { key: "retain", label: "Retain" },
  ];

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

        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => openActionDialog(action.key)}
              disabled={!assetIds.length}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
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

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Custodian
                      </div>
                      <div className="mt-1 text-slate-800">
                        {event.custodian
                          ? custodianText(
                              event.custodian,
                              event.custodian_id,
                              event.custodian_type,
                            )
                          : "Not captured"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2">
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Noting Approval
                      </div>
                      <div className="mt-1 text-slate-800">
                        {resolveNotingLink(event)?.external ? (
                          <a
                            href={resolveNotingLink(event).href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            {resolveNotingLink(event).label}
                          </a>
                        ) : resolveNotingLink(event) ? (
                          <Link
                            to={resolveNotingLink(event).href}
                            className="text-emerald-700 underline"
                          >
                            {resolveNotingLink(event).label}
                          </Link>
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

      <Modal
        isOpen={dialog === "return"}
        onClose={() => setDialog(null)}
        title="Return"
      >
        <AssetReturnForm assetIds={assetIds} onDone={handleActionDone} />
      </Modal>

      <Modal
        isOpen={dialog === "transfer"}
        onClose={() => setDialog(null)}
        title="Transfer"
      >
        <AssetTransferForm assetIds={assetIds} onDone={handleActionDone} />
      </Modal>

      <Modal
        isOpen={dialog === "repairOut"}
        onClose={() => setDialog(null)}
        title="Repair Out"
      >
        <AssetRepairForm
          mode="out"
          assetIds={assetIds}
          onDone={handleActionDone}
        />
      </Modal>

      <Modal
        isOpen={dialog === "repairIn"}
        onClose={() => setDialog(null)}
        title="Repair In"
      >
        <AssetRepairForm
          mode="in"
          assetIds={assetIds}
          onDone={handleActionDone}
        />
      </Modal>

      <Modal
        isOpen={dialog === "finalize"}
        onClose={() => setDialog(null)}
        title="Dispose / Lost / E-Waste"
      >
        <AssetFinalizeForm assetIds={assetIds} onDone={handleActionDone} />
      </Modal>

      <Modal
        isOpen={dialog === "retain"}
        onClose={() => setDialog(null)}
        title="Retain"
      >
        <AssetRetainForm assetIds={assetIds} onDone={handleActionDone} />
      </Modal>
    </div>
  );
}
