import { useEffect, useState } from "react";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toStoreApiUrl } from "@/lib/api-config";
// import { SelectScrollable } from "@/components/SelectScrollable";
import PopupMessage from "@/components/PopupMessage";
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

export default function IssueQtyForm({
  stockId,
  onStockChange,
  employeeId,
  onEmployeeChange,
}) {
  const [qty, setQty] = useState("");
  const [stockQty, setStockQty] = useState(null);
  const [msg, setMsg] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [itemCategories, setItemCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [issueToType, setIssueToType] = useState("EMPLOYEE");
  const [custodianId, setCustodianId] = useState("");
  const [custodianOptions, setCustodianOptions] = useState([]);
  const [custodianLoading, setCustodianLoading] = useState(false);

  const isEmployeeIssue = issueToType === "EMPLOYEE";
  const resolvedCustodianId = isEmployeeIssue ? employeeId : custodianId;

  useEffect(() => {
    // Adjust endpoints if yours differ
    axios
      .get(toStoreApiUrl("/stocks"))
      .then((r) => setStocks(r.data?.data || []));
    axios
      .get(toStoreApiUrl("/employee"))
      .then((r) => setEmployees(r.data?.data || []));
    axios
      .get(toStoreApiUrl("/itemCategories"))
      .then((r) => setItemCategories(r.data?.data || []));
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
    if (!itemCategoryId) {
      setStocks([]);
      onStockChange?.(""); // reset selection
      return;
    }
    const category = itemCategories.find(
      (c) => String(c?.id) === String(itemCategoryId),
    );
    const isSerialized = Boolean(category?.serialized_required);
    axios
      .get(toStoreApiUrl(`/stock-items-all/${itemCategoryId}`), {
        params: {
          onlyInStock: true,
          groupByMaster: !isSerialized,
        },
      })
      .then((r) => setStocks(r.data?.data || []));
    onStockChange?.(""); // clear previously selected stock
  }, [itemCategoryId, itemCategories, onStockChange]);

  useEffect(() => {
    if (!stockId) {
      setStockQty(null);
      return;
    }
    const hit = stocks.find((s) => String(s.id) === String(stockId));
    setStockQty(hit?.quantity ?? null);
  }, [stockId, stocks]);

  const submit = async () => {
    if (!stockId || !resolvedCustodianId || !qty)
      return setMsg({ type: "error", text: "Fill all fields" });
    if (stockQty != null && Number(qty) > Number(stockQty))
      return setMsg({ type: "error", text: "Insufficient stock" });
    const payload = {
      stockId,
      quantity: Number(qty),
      custodianId: String(resolvedCustodianId),
      custodianType: issueToType,
    };
    if (isEmployeeIssue && employeeId) {
      payload.employeeId = Number(employeeId);
    }
    await axios.post(toStoreApiUrl("/issue"), payload);
    setMsg({ type: "success", text: "Issued" });
  };

  return (
    <div className="grid gap-3 max-w-xl">
      {/* <SelectScrollable
        label="Stock"
        value={stockId}
        onChange={onStockChange}
      />
      <SelectScrollable
        label="Employee"
        value={employeeId}
        onChange={onEmployeeChange}
      /> */}
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
                  {`${e.emp_id}, ${e.name}, ${e.division}, ${e.designation}`}
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
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600">Item Category</label>

        <Select
          value={String(itemCategoryId || "")}
          onValueChange={setItemCategoryId}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select Item Category" />
          </SelectTrigger>
          <SelectContent>
            {itemCategories.map((itemCategory) => (
              <SelectItem key={itemCategory.id} value={String(itemCategory.id)}>
                {itemCategory.category_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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

      <div>
        <label className="text-xs text-gray-600">Quantity</label>
        <Input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-11"
        />
      </div>
      <Button onClick={submit} className="h-11">
        Issue
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
