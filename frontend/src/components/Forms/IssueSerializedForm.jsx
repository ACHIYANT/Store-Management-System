import { useEffect, useState } from "react";
import axios from "axios";
import ListTable from "@/components/ListTable";
import { Button } from "@/components/ui/button";
import PopupMessage from "@/components/PopupMessage";
import { toStoreApiUrl } from "@/lib/api-config";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const CUSTODIAN_TYPES = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "DIVISION", label: "Division" },
  { value: "VEHICLE", label: "Vehicle" },
];

export default function IssueSerializedForm({
  stockId,
  onStockChange,
  employeeId,
  onEmployeeChange,
}) {
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState([]);
  const [msg, setMsg] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [issueToType, setIssueToType] = useState("EMPLOYEE");
  const [custodianId, setCustodianId] = useState("");
  const [custodianOptions, setCustodianOptions] = useState([]);
  const [custodianLoading, setCustodianLoading] = useState(false);

  const isEmployeeIssue = issueToType === "EMPLOYEE";
  const resolvedCustodianId = isEmployeeIssue ? employeeId : custodianId;

  useEffect(() => {
    // Adjust to your actual endpoints
    axios
      .get(toStoreApiUrl("/stocks"))
      .then((r) => setStocks(r.data?.data || []));
    axios
      .get(toStoreApiUrl("/employee"))
      .then((r) => setEmployees(r.data?.data || []));
  }, []);

  useEffect(() => {
    if (isEmployeeIssue) {
      setCustodianOptions([]);
      setCustodianLoading(false);
      return;
    }
    let active = true;
    setCustodianLoading(true);
    axios
      .get(toStoreApiUrl("/custodians"), {
        params: { custodian_type: issueToType, is_active: true },
      })
      .then((r) => {
        if (!active) return;
        setCustodianOptions(r.data?.data || []);
      })
      .catch(() => {
        if (!active) return;
        setCustodianOptions([]);
      })
      .finally(() => {
        if (!active) return;
        setCustodianLoading(false);
      });
    return () => {
      active = false;
    };
  }, [issueToType, isEmployeeIssue]);

  useEffect(() => {
    if (!stockId) return setAssets([]);
    axios
      .get(toStoreApiUrl(`/assets/instore/${stockId}`))
      .then((r) => setAssets(r.data?.data || []));
  }, [stockId]);

  const submit = async () => {
    if (!stockId || !resolvedCustodianId || selected.length === 0)
      return setMsg({
        type: "error",
        text: "Select stock, Issue To, and assets",
      });
    const payload = {
      stockId,
      assetIds: selected,
      custodianId: String(resolvedCustodianId),
      custodianType: issueToType,
    };
    if (isEmployeeIssue && employeeId) {
      payload.employeeId = Number(employeeId);
    }
    await axios.post(toStoreApiUrl("/issue"), payload);
    setMsg({ type: "success", text: "Issued serialized assets" });
  };

  const columns = [
    { key: "id", label: "ID" },
    { key: "asset_tag", label: "Asset Tag" },
    { key: "serial_number", label: "Serial" },
  ];

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600">Stock</label>
        <Select value={String(stockId || "")} onValueChange={onStockChange}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select stock" />
          </SelectTrigger>
          <SelectContent>
            {stocks.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.item_name || s.name || `Stock #${s.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600">Issue To Type</label>
        <Select
          value={issueToType}
          onValueChange={(value) => {
            setIssueToType(value);
            setCustodianId("");
            if (value !== "EMPLOYEE") {
              onEmployeeChange?.("");
            }
          }}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {CUSTODIAN_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600">
          {isEmployeeIssue
            ? "Employee"
            : issueToType === "DIVISION"
              ? "Division"
              : "Vehicle"}
        </label>
        {isEmployeeIssue ? (
          <Select
            value={String(employeeId || "")}
            onValueChange={onEmployeeChange}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem
                  key={e.emp_id || e.id}
                  value={String(e.emp_id || e.id)}
                >
                  {e.fullname || e.name || `Emp #${e.emp_id || e.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={String(custodianId || "")}
            onValueChange={setCustodianId}
          >
            <SelectTrigger className="h-11">
              <SelectValue
                placeholder={
                  custodianLoading
                    ? "Loading..."
                    : `Select ${issueToType.toLowerCase()}`
                }
              />
            </SelectTrigger>
            <SelectContent>
              {custodianLoading ? (
                <SelectItem value="loading" disabled>
                  Loading...
                </SelectItem>
              ) : custodianOptions.length === 0 ? (
                <SelectItem value="empty" disabled>
                  No custodians found
                </SelectItem>
              ) : (
                custodianOptions.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {`${c.id} - ${c.display_name}${c.location ? ` (${c.location})` : ""}`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      <ListTable
        data={assets}
        columns={columns}
        selectedRows={selected}
        onRowSelect={(_, next) => setSelected(next)}
        idCol="id"
      />
      <Button onClick={submit} className="h-11">
        Issue Selected
      </Button>
      {msg && (
        <PopupMessage
          type={msg.type}
          message={msg.text}
          onClose={() => setMsg(null)}
        />
      )}
    </div>
  );
}
