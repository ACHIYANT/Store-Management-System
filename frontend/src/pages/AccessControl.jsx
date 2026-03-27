import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import Modal from "@/components/Modal";
import PopupMessage from "@/components/PopupMessage";
import useDebounce from "@/hooks/useDebounce";
import { toAuthApiUrl, toStoreApiUrl } from "@/lib/api-config";
import { hasRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_ROLE_FORM = {
  roleName: "",
};

const DEFAULT_LOCATION_SCOPE_FORM = {
  locationScope: "",
};

const DEFAULT_ASSIGNMENT_FORM = {
  assignmentType: "DIVISION_HEAD",
  scopeValue: "",
  notes: "",
};

const ASSIGNMENT_LABELS = {
  DIVISION_HEAD: "Division Head",
  DIVISION_CUSTODIAN: "Division Custodian",
  VEHICLE_DRIVER: "Vehicle Driver",
  LOCATION_INCHARGE: "Location Incharge",
  STORE_INCHARGE: "Store Incharge",
  GLOBAL: "Global Responsibility",
};

const ASSIGNMENT_TYPE_CONFIG = {
  DIVISION_HEAD: {
    selector: "division",
    selectLabel: "Division",
    placeholder: "Select division",
  },
  DIVISION_CUSTODIAN: {
    selector: "division",
    selectLabel: "Division",
    placeholder: "Select division",
  },
  VEHICLE_DRIVER: {
    selector: "vehicle",
    selectLabel: "Vehicle",
    placeholder: "Select vehicle",
  },
  LOCATION_INCHARGE: {
    selector: "location",
    selectLabel: "Location",
    placeholder: "Select location",
  },
  STORE_INCHARGE: {
    selector: "location",
    selectLabel: "Store Location",
    placeholder: "Select store location",
  },
  GLOBAL: {
    selector: "global",
    selectLabel: "Scope",
    placeholder: "Entire Organization",
  },
};

const ASSIGNMENT_MANAGED_ROLE_NAMES = new Set([
  "DIVISION_HEAD",
  "DIVISION_CUSTODIAN",
  "VEHICLE_DRIVER",
  "LOCATION_INCHARGE",
  "STORE_INCHARGE",
]);

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const chipClassByRole = (roleName) => {
  const normalized = String(roleName || "").trim().toUpperCase();
  if (normalized === "SUPER_ADMIN") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
  if (normalized === "USER") {
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
  if (ASSIGNMENT_MANAGED_ROLE_NAMES.has(normalized)) {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }
  return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
};

const getReadableApiError = (
  error,
  fallbackMessage,
  { serviceName = "service", serviceUrl = "", hint = "" } = {},
) => {
  const responseMessage =
    error?.response?.data?.message ||
    error?.response?.data?.err?.message ||
    "";

  if (responseMessage) {
    return responseMessage;
  }

  if (!error?.response) {
    const parts = [`Cannot reach ${serviceName}`];
    if (serviceUrl) {
      parts.push(`at ${serviceUrl}`);
    }
    if (hint) {
      parts.push(hint);
    }
    return `${parts.join(" ")}.`;
  }

  return error?.message || fallbackMessage;
};

const normalizeLabelKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const formatScopedOptionLabel = (option, selector, duplicateCounts) => {
  const baseLabel = String(option?.display_name || option?.id || "").trim();
  const location = String(option?.location || "").trim();

  if (!baseLabel) return "—";
  if (!location || selector === "location" || selector === "global") {
    return baseLabel;
  }

  const duplicateCount = duplicateCounts.get(normalizeLabelKey(baseLabel)) || 0;
  if (duplicateCount > 1) {
    return `${baseLabel} (${location})`;
  }

  return `${baseLabel} (${location})`;
};

const formatAssignmentSummaryLabel = (assignment) => {
  const baseLabel = String(
    assignment?.scope_label ||
      assignment?.metadata_json?.display_name ||
      assignment?.scope_key ||
      "",
  ).trim();
  const scopeType = String(assignment?.scope_type || "")
    .trim()
    .toUpperCase();
  const location = String(assignment?.metadata_json?.location || "").trim();

  if (!baseLabel) return "—";
  if (
    !location ||
    scopeType === "LOCATION" ||
    scopeType === "GLOBAL"
  ) {
    return baseLabel;
  }

  if (baseLabel.toLowerCase().includes(location.toLowerCase())) {
    return baseLabel;
  }

  return `${baseLabel} (${location})`;
};

export default function AccessControl() {
  const isSuperAdmin = useMemo(() => hasRole("SUPER_ADMIN"), []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [search, setSearch] = useState("");
  const [rolesCatalog, setRolesCatalog] = useState([]);
  const [divisionCustodians, setDivisionCustodians] = useState([]);
  const [vehicleCustodians, setVehicleCustodians] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showLocationScopeModal, setShowLocationScopeModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [roleForm, setRoleForm] = useState(DEFAULT_ROLE_FORM);
  const [locationScopeForm, setLocationScopeForm] = useState(
    DEFAULT_LOCATION_SCOPE_FORM,
  );
  const [assignmentForm, setAssignmentForm] = useState(DEFAULT_ASSIGNMENT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
    moveTo: "",
  });

  const debouncedSearch = useDebounce(search, 350);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(toAuthApiUrl("/users"), {
        params: {
          search: debouncedSearch || undefined,
          limit: 200,
        },
      });
      const users = response?.data?.data || [];
      setRows(users);
      setSelectedUserId((prev) =>
        users.some((row) => row.id === prev) ? prev : users[0]?.id ?? null,
      );
    } catch (error) {
      setRows([]);
      setSelectedUserId(null);
      setPopup({
        open: true,
        type: "error",
        message: getReadableApiError(error, "Failed to fetch users.", {
          serviceName: "Auth service",
          serviceUrl: "http://localhost:3001",
          hint: "Start AuthService and make sure the latest Auth migrations are applied",
        }),
        moveTo: "",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  const fetchReferenceData = useCallback(async () => {
    const [rolesResult, divisionsResult, vehiclesResult] =
      await Promise.allSettled([
        axios.get(toAuthApiUrl("/roles")),
        axios.get(toStoreApiUrl("/custodians"), {
          params: { custodian_type: "DIVISION", limit: 500 },
        }),
        axios.get(toStoreApiUrl("/custodians"), {
          params: { custodian_type: "VEHICLE", limit: 500 },
        }),
      ]);

    const messages = [];

    if (rolesResult.status === "fulfilled") {
      setRolesCatalog(rolesResult.value?.data?.data || []);
    } else {
      setRolesCatalog([]);
      messages.push(
        getReadableApiError(rolesResult.reason, "Failed to load roles.", {
          serviceName: "Auth service",
          serviceUrl: "http://localhost:3001",
          hint:
            "Start AuthService and make sure the latest Auth migrations are applied",
        }),
      );
    }

    if (divisionsResult.status === "fulfilled") {
      setDivisionCustodians(divisionsResult.value?.data?.data || []);
    } else {
      setDivisionCustodians([]);
      messages.push(
        getReadableApiError(
          divisionsResult.reason,
          "Failed to load division custodians.",
          {
            serviceName: "Store service",
            serviceUrl: "http://localhost:3000",
            hint: "Start StoreManagementService after AuthService is available",
          },
        ),
      );
    }

    if (vehiclesResult.status === "fulfilled") {
      setVehicleCustodians(vehiclesResult.value?.data?.data || []);
    } else {
      setVehicleCustodians([]);
      messages.push(
        getReadableApiError(
          vehiclesResult.reason,
          "Failed to load vehicle custodians.",
          {
            serviceName: "Store service",
            serviceUrl: "http://localhost:3000",
            hint: "Start StoreManagementService after AuthService is available",
          },
        ),
      );
    }

    if (messages.length) {
      setPopup({
        open: true,
        type: "error",
        message: messages[0],
        moveTo: "",
      });
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchUsers();
  }, [fetchUsers, isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchReferenceData();
  }, [fetchReferenceData, isSuperAdmin]);

  const selectedUser = useMemo(
    () => rows.find((row) => Number(row.id) === Number(selectedUserId)) || null,
    [rows, selectedUserId],
  );

  const availableRoles = useMemo(
    () =>
      (rolesCatalog || []).filter(
        (role) => !role.is_default_role && !role.managed_by_assignment,
      ),
    [rolesCatalog],
  );

  const locationOptions = useMemo(() => {
    const locationMap = new Map();
    [...divisionCustodians, ...vehicleCustodians].forEach((option) => {
      const location = String(option?.location || "").trim();
      if (!location) return;
      const key = location.toUpperCase();
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          id: key,
          display_name: location,
          location,
          scopeType: "LOCATION",
        });
      }
    });
    return Array.from(locationMap.values()).sort((a, b) =>
      String(a.display_name).localeCompare(String(b.display_name)),
    );
  }, [divisionCustodians, vehicleCustodians]);

  const assignmentDefinition =
    ASSIGNMENT_TYPE_CONFIG[assignmentForm.assignmentType] ||
    ASSIGNMENT_TYPE_CONFIG.DIVISION_HEAD;

  const assignmentOptions = useMemo(() => {
    if (assignmentDefinition.selector === "vehicle") {
      return vehicleCustodians;
    }
    if (assignmentDefinition.selector === "location") {
      return locationOptions;
    }
    if (assignmentDefinition.selector === "global") {
      return [
        {
          id: "ENTIRE_ORGANIZATION",
          display_name: "Entire Organization",
          location: null,
          scopeType: "GLOBAL",
        },
      ];
    }
    return divisionCustodians;
  }, [
    assignmentDefinition.selector,
    divisionCustodians,
    vehicleCustodians,
    locationOptions,
  ]);

  const assignmentDuplicateCounts = useMemo(() => {
    const counts = new Map();
    assignmentOptions.forEach((option) => {
      const key = normalizeLabelKey(option?.display_name);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [assignmentOptions]);

  const selectedScope = useMemo(
    () =>
      assignmentOptions.find(
        (option) => String(option.id) === String(assignmentForm.scopeValue),
      ) || null,
    [assignmentForm.scopeValue, assignmentOptions],
  );

  const columns = useMemo(
    () => [
      { key: "empcode", label: "Emp Code" },
      { key: "fullname", label: "Full Name" },
      { key: "mobileno", label: "Mobile" },
      { key: "division", label: "Division" },
      {
        key: "roles",
        label: "Roles",
        render: (_, row) =>
          Array.isArray(row.roles) && row.roles.length
            ? row.roles.map((role) => role.name).join(", ")
            : "—",
      },
      {
        key: "location_scopes",
        label: "Locations",
        render: (_, row) =>
          Array.isArray(row.location_scopes) ? row.location_scopes.length : 0,
      },
      {
        key: "assignments",
        label: "Active Assignments",
        render: (_, row) => (Array.isArray(row.assignments) ? row.assignments.length : 0),
      },
    ],
    [],
  );

  const handleRoleAssign = async () => {
    if (!selectedUser) {
      setPopup({
        open: true,
        type: "warning",
        message: "Select a user first.",
        moveTo: "",
      });
      return;
    }
    if (!roleForm.roleName) {
      setPopup({
        open: true,
        type: "warning",
        message: "Select a role first.",
        moveTo: "",
      });
      return;
    }

    try {
      setSubmitting(true);
      await axios.post(toAuthApiUrl(`/users/${selectedUser.id}/roles`), {
        roleName: roleForm.roleName,
      });
      setShowRoleModal(false);
      setRoleForm(DEFAULT_ROLE_FORM);
      await fetchUsers();
      setPopup({
        open: true,
        type: "success",
        message: "Role assigned successfully.",
        moveTo: "",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to assign role.",
        moveTo: "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleRemove = async (roleName) => {
    if (!selectedUser || !roleName) return;
    try {
      setSubmitting(true);
      await axios.delete(
        toAuthApiUrl(
          `/users/${selectedUser.id}/roles/${encodeURIComponent(roleName)}`,
        ),
      );
      await fetchUsers();
      setPopup({
        open: true,
        type: "success",
        message: `${roleName} removed successfully.`,
        moveTo: "",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to remove role.",
        moveTo: "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLocationScopeSave = async () => {
    if (!selectedUser) {
      setPopup({
        open: true,
        type: "warning",
        message: "Select a user first.",
        moveTo: "",
      });
      return;
    }

    const selectedLocation = locationOptions.find(
      (option) =>
        String(option.id).toUpperCase() ===
        String(locationScopeForm.locationScope).toUpperCase(),
    );
    if (!selectedLocation) {
      setPopup({
        open: true,
        type: "warning",
        message: "Select a location first.",
        moveTo: "",
      });
      return;
    }

    try {
      setSubmitting(true);
      await axios.post(toAuthApiUrl(`/users/${selectedUser.id}/location-scopes`), {
        locationScope: selectedLocation.id,
        scopeLabel: selectedLocation.display_name,
      });
      setShowLocationScopeModal(false);
      setLocationScopeForm(DEFAULT_LOCATION_SCOPE_FORM);
      await fetchUsers();
      setPopup({
        open: true,
        type: "success",
        message: "Location scope assigned successfully.",
        moveTo: "",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to assign location scope.",
        moveTo: "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLocationScopeRemove = async (locationScope) => {
    if (!selectedUser || !locationScope) return;
    try {
      setSubmitting(true);
      await axios.delete(
        toAuthApiUrl(
          `/users/${selectedUser.id}/location-scopes/${encodeURIComponent(locationScope)}`,
        ),
      );
      await fetchUsers();
      setPopup({
        open: true,
        type: "success",
        message: `${locationScope} removed successfully.`,
        moveTo: "",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to remove location scope.",
        moveTo: "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignmentSave = async () => {
    if (!selectedUser) {
      setPopup({
        open: true,
        type: "warning",
        message: "Select a user first.",
        moveTo: "",
      });
      return;
    }
    if (assignmentDefinition.selector !== "global" && !selectedScope) {
      setPopup({
        open: true,
        type: "warning",
        message: `Select the ${assignmentDefinition.selectLabel.toLowerCase()} first.`,
        moveTo: "",
      });
      return;
    }

    try {
      setSubmitting(true);
      let requestPayload = {
        userId: selectedUser.id,
        assignmentType: assignmentForm.assignmentType,
        notes: assignmentForm.notes || null,
      };

      if (
        assignmentDefinition.selector === "division" ||
        assignmentDefinition.selector === "vehicle"
      ) {
        requestPayload = {
          ...requestPayload,
          scopeType: "CUSTODIAN",
          scopeKey: selectedScope.id,
          scopeLabel: selectedScope.display_name,
          metadata_json: {
            custodian_id: selectedScope.id,
            custodian_type: selectedScope.custodian_type,
            display_name: selectedScope.display_name,
            location: selectedScope.location || null,
          },
        };
      } else if (assignmentDefinition.selector === "location") {
        requestPayload = {
          ...requestPayload,
          scopeType: "LOCATION",
          scopeKey: selectedScope.id,
          scopeLabel: selectedScope.display_name,
          metadata_json: {
            location: selectedScope.location || selectedScope.display_name || null,
          },
        };
      } else {
        requestPayload = {
          ...requestPayload,
          scopeType: "GLOBAL",
          scopeKey: "ENTIRE_ORGANIZATION",
          scopeLabel: "Entire Organization",
          metadata_json: {
            display_name: "Entire Organization",
          },
        };
      }

      await axios.post(toAuthApiUrl("/org-assignments"), requestPayload);
      setShowAssignmentModal(false);
      setAssignmentForm(DEFAULT_ASSIGNMENT_FORM);
      await fetchUsers();
      setPopup({
        open: true,
        type: "success",
        message: "Assignment saved successfully.",
        moveTo: "",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to save assignment.",
        moveTo: "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignmentEnd = async (assignmentId) => {
    if (!assignmentId) return;
    try {
      setSubmitting(true);
      await axios.patch(toAuthApiUrl(`/org-assignments/${assignmentId}/end`), {});
      await fetchUsers();
      setPopup({
        open: true,
        type: "success",
        message: "Assignment ended successfully.",
        moveTo: "",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to end assignment.",
        moveTo: "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openRoleModal = () => {
    if (!selectedUser) {
      setPopup({
        open: true,
        type: "warning",
        message: "Select a user first.",
        moveTo: "",
      });
      return;
    }
    setRoleForm(DEFAULT_ROLE_FORM);
    setShowRoleModal(true);
  };

  const openLocationScopeModal = () => {
    if (!selectedUser) {
      setPopup({
        open: true,
        type: "warning",
        message: "Select a user first.",
        moveTo: "",
      });
      return;
    }
    setLocationScopeForm(DEFAULT_LOCATION_SCOPE_FORM);
    setShowLocationScopeModal(true);
  };

  const openAssignmentModal = () => {
    if (!selectedUser) {
      setPopup({
        open: true,
        type: "warning",
        message: "Select a user first.",
        moveTo: "",
      });
      return;
    }
    setAssignmentForm(DEFAULT_ASSIGNMENT_FORM);
    setShowAssignmentModal(true);
  };

  if (!isSuperAdmin) {
    return <div className="p-6 text-red-600">You don’t have access to this page.</div>;
  }

  return (
    <>
      <ListPage
        title="Access Control"
        columns={columns}
        data={rows}
        loading={loading}
        showAdd={false}
        showUpdate={false}
        showFilter={false}
        searchPlaceholder="Search user by name, mobile, division..."
        searchValue={search}
        onSearch={setSearch}
        actions={[
          { label: "Assign Role", onClick: openRoleModal },
          { label: "Assign Location", onClick: openLocationScopeModal },
          { label: "Assign Responsibility", onClick: openAssignmentModal },
        ]}
        table={
          <ListTable
            columns={columns}
            data={rows}
            idCol="id"
            selectedRows={selectedUserId}
            onRowSelect={(id) =>
              setSelectedUserId((prev) => (prev === id ? null : id))
            }
          />
        }
        belowContent={
          selectedUser ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <section className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {selectedUser.fullname}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Emp Code: {selectedUser.empcode || "—"} | Mobile:{" "}
                      {selectedUser.mobileno || "—"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Division: {selectedUser.division || "—"} | Designation:{" "}
                      {selectedUser.designation || "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-sm font-medium text-slate-900">
                    Current Roles
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedUser.roles || []).map((role) => {
              const normalizedRoleName = String(role.name || "")
                .trim()
                .toUpperCase();
              const canRemove =
                normalizedRoleName !== "USER" &&
                !ASSIGNMENT_MANAGED_ROLE_NAMES.has(normalizedRoleName);

                      return (
                        <div
                          key={role.name}
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${chipClassByRole(role.name)}`}
                        >
                          <span>{role.name}</span>
                          {canRemove ? (
                            <button
                              type="button"
                              className="rounded-full px-1 text-[11px] text-slate-500 hover:bg-white/80 hover:text-slate-900"
                              onClick={() => handleRoleRemove(role.name)}
                              disabled={submitting}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    `USER` is automatic. Responsibility-backed roles like
                    `DIVISION_HEAD`, `DIVISION_CUSTODIAN`, `VEHICLE_DRIVER`,
                    `LOCATION_INCHARGE`, and `STORE_INCHARGE` are controlled by
                    assignments, not manual role edits.
                  </p>
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-sm font-medium text-slate-900">
                    Account Location Access
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedUser.location_scopes || []).length ? (
                      selectedUser.location_scopes.map((scope) => (
                        <div
                          key={scope.location_scope}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
                        >
                          <span>{scope.scope_label || scope.location_scope}</span>
                          <button
                            type="button"
                            className="rounded-full px-1 text-[11px] text-emerald-600 hover:bg-white/80 hover:text-emerald-900"
                            onClick={() =>
                              handleLocationScopeRemove(scope.location_scope)
                            }
                            disabled={submitting}
                          >
                            ×
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
                        No explicit location scope assigned.
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Use location access for operational accounts like
                    `STORE_ENTRY`, `INSPECTION_OFFICER`, and approver accounts.
                    Responsibilities remain separate.
                  </p>
                </div>
              </section>

              <section className="rounded-lg border bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Active Responsibilities
                  </h3>
                  <span className="text-xs text-slate-500">
                    Current holder mapping only
                  </span>
                </div>
                <div className="space-y-3">
                  {(selectedUser.assignments || []).length ? (
                    selectedUser.assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {ASSIGNMENT_LABELS[assignment.assignment_type] ||
                                assignment.assignment_type}
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                              {formatAssignmentSummaryLabel(assignment)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Scope: {assignment.scope_type} | Ref: {assignment.scope_key}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Location: {assignment.metadata_json?.location || "—"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Since: {formatDateTime(assignment.effective_from)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            onClick={() => handleAssignmentEnd(assignment.id)}
                            disabled={submitting}
                          >
                            End Assignment
                          </Button>
                        </div>
                        {assignment.notes ? (
                          <p className="mt-2 text-xs text-slate-600">
                            Notes: {assignment.notes}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      No active organizational assignments for this user.
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null
        }
      />

      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Assign Role"
      >
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Role</Label>
            <Select
              value={roleForm.roleName}
              onValueChange={(value) => setRoleForm({ roleName: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.name} value={role.name}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRoleModal(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleRoleAssign} disabled={submitting}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        title="Assign Responsibility"
      >
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Assignment Type</Label>
            <Select
              value={assignmentForm.assignmentType}
              onValueChange={(value) =>
                setAssignmentForm({
                  assignmentType: value,
                  scopeValue:
                    ASSIGNMENT_TYPE_CONFIG[value]?.selector === "global"
                      ? "ENTIRE_ORGANIZATION"
                      : "",
                  notes: "",
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assignment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DIVISION_HEAD">Division Head</SelectItem>
                <SelectItem value="DIVISION_CUSTODIAN">
                  Division Custodian
                </SelectItem>
                <SelectItem value="VEHICLE_DRIVER">Vehicle Driver</SelectItem>
                <SelectItem value="LOCATION_INCHARGE">
                  Location Incharge
                </SelectItem>
                <SelectItem value="STORE_INCHARGE">Store Incharge</SelectItem>
                <SelectItem value="GLOBAL">Global Responsibility</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignmentDefinition.selector === "global" ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Scope: Entire Organization
            </div>
          ) : (
            <div>
              <Label className="mb-2 block">{assignmentDefinition.selectLabel}</Label>
              <Select
                value={assignmentForm.scopeValue}
                onValueChange={(value) =>
                  setAssignmentForm((prev) => ({ ...prev, scopeValue: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={assignmentDefinition.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {assignmentOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {formatScopedOptionLabel(
                        option,
                        assignmentDefinition.selector,
                        assignmentDuplicateCounts,
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedScope ? (
                <p className="mt-2 text-xs text-slate-500">
                  {assignmentDefinition.selector === "location"
                    ? `Location: ${selectedScope.display_name || "—"} | Ref: ${selectedScope.id}`
                    : `Location: ${selectedScope.location || "—"} | Ref: ${selectedScope.id}`}
                </p>
              ) : null}
            </div>
          )}

          <div>
            <Label className="mb-2 block">Notes</Label>
            <Input
              value={assignmentForm.notes}
              onChange={(event) =>
                setAssignmentForm((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional notes"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAssignmentModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAssignmentSave}
              disabled={submitting}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showLocationScopeModal}
        onClose={() => setShowLocationScopeModal(false)}
        title="Assign Location Access"
      >
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Location</Label>
            <Select
              value={locationScopeForm.locationScope}
              onValueChange={(value) =>
                setLocationScopeForm({ locationScope: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locationOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {locationScopeForm.locationScope ? (
              <p className="mt-2 text-xs text-slate-500">
                Scope key: {locationScopeForm.locationScope}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLocationScopeModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleLocationScopeSave}
              disabled={submitting}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        moveTo={popup.moveTo}
        onClose={() => setPopup((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}
