import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import FilterPanel from "@/components/FilterPanel";
import Modal from "@/components/Modal";
import PopupMessage from "@/components/PopupMessage";
import useDebounce from "@/hooks/useDebounce";
import { toStoreApiUrl } from "@/lib/api-config";
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

const TYPE_OPTIONS = [
  { value: "DIVISION", label: "Division" },
  { value: "VEHICLE", label: "Vehicle" },
];

const TYPE_FILTER_OPTIONS = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "DIVISION", label: "Division" },
  { value: "VEHICLE", label: "Vehicle" },
];

const TYPE_CHIPS = {
  EMPLOYEE: { color: "blue" },
  DIVISION: { color: "indigo" },
  VEHICLE: { color: "yellow" },
};

const DEFAULT_FORM = {
  custodianType: "DIVISION",
  displayName: "",
  location: "",
};

export default function Custodians() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const canManageMaster = useMemo(() => hasRole("SUPER_ADMIN"), []);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [filters, setFilters] = useState({ custodianType: "", location: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState({
    open: false,
    type: "success",
    message: "",
    moveTo: "",
  });

  const closeFilterPanel = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowFilters(false);
      setIsClosing(false);
    }, 160);
  };

  const fetchCustodians = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(toStoreApiUrl("/custodians"), {
        params: {
          search: debouncedSearch || undefined,
          custodian_type: filters.custodianType || undefined,
          location: filters.location || undefined,
          include_inactive: true,
          limit: 500,
        },
      });
      setRows(res?.data?.data || []);
    } catch (error) {
      setRows([]);
      setPopup({
        open: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to fetch custodians.",
        moveTo: "",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters.custodianType, filters.location]);

  useEffect(() => {
    fetchCustodians();
  }, [fetchCustodians]);

  const columns = useMemo(
    () => [
      { key: "id", label: "Custodian ID" },
      { key: "display_name", label: "Display Name" },
      { key: "location", label: "Location" },
      {
        key: "custodian_type",
        label: "Type",
        chip: true,
        chipMap: TYPE_CHIPS,
      },
      {
        key: "employee_id",
        label: "Employee ID",
        render: (_, row) => row.employee_id ?? "-",
      },
      {
        key: "is_active",
        label: "Status",
        render: (val) => (val ? "Active" : "Inactive"),
      },
    ],
    [],
  );

  const openCreate = () => {
    setForm(DEFAULT_FORM);
    setShowCreateDialog(true);
  };

  const handleCreate = async () => {
    if (submitting) return;
    const displayName = String(form.displayName || "").trim();
    const location = String(form.location || "").trim();

    if (!displayName) {
      setPopup({
        open: true,
        type: "error",
        message: "Display name is required.",
        moveTo: "",
      });
      return;
    }
    if (!location) {
      setPopup({
        open: true,
        type: "error",
        message: "Location is required.",
        moveTo: "",
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await axios.post(toStoreApiUrl("/custodians"), {
        custodian_type: form.custodianType,
        display_name: displayName,
        location,
      });
      const createdId = response?.data?.data?.id || null;
      setShowCreateDialog(false);
      setForm(DEFAULT_FORM);
      fetchCustodians();
      setPopup({
        open: true,
        type: "success",
        message: createdId
          ? `Custodian created successfully (${createdId}).`
          : "Custodian created successfully.",
        moveTo: "",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to create custodian.",
        moveTo: "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ListPage
        title="Custodians"
        columns={columns}
        data={rows}
        loading={loading}
        onAdd={openCreate}
        showAdd={canManageMaster}
        showUpdate={false}
        showFilter={true}
        onFilter={() =>
          showFilters ? closeFilterPanel() : setShowFilters(true)
        }
        searchPlaceholder="Search custodian id or name..."
        searchValue={search}
        onSearch={setSearch}
        table={<ListTable columns={columns} data={rows} idCol="id" />}
        aboveContent={
          showFilters && (
            <FilterPanel
              title="Custodian Filters"
              fields={[
                {
                  key: "custodianType",
                  label: "Custodian Type",
                  type: "select",
                  options: TYPE_FILTER_OPTIONS,
                },
                {
                  key: "location",
                  label: "Location",
                  type: "text",
                },
              ]}
              filters={filters}
              onChange={(k, v) =>
                setFilters((prev) => ({ ...prev, [k]: v }))
              }
              onReset={() => {
                setFilters({ custodianType: "", location: "" });
                setSearch("");
                closeFilterPanel();
              }}
              onClose={closeFilterPanel}
              isClosing={isClosing}
            />
          )
        }
      />

      <Modal
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        title="Create Custodian"
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Custodian Type</Label>
            <Select
              value={form.custodianType}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  custodianType: value,
                }))
              }
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Display Name</Label>
            <Input
              value={form.displayName}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  displayName: e.target.value,
                }))
              }
              placeholder={
                form.custodianType === "DIVISION"
                  ? "Administration Division"
                  : "Vehicle KA01AB1234"
              }
              className="h-11"
            />
            <p className="text-xs text-slate-500">
              Custodian ID is auto-generated as the next sequence for the
              selected type.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Location</Label>
            <Input
              value={form.location}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  location: e.target.value,
                }))
              }
              placeholder="Mumbai / Delhi / Panchkula"
              className="h-11"
            />
            <p className="text-xs text-slate-500">
              Used in auto-generated IDs: DIV-MUM-001 / VEH-DEL-002.
            </p>
          </div>

          <p className="text-xs text-slate-500">
            Employee custodians are synced from Employee records.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={
                submitting ||
                !String(form.displayName || "").trim() ||
                !String(form.location || "").trim()
              }
            >
              {submitting ? "Saving..." : "Create"}
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
