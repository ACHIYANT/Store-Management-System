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
    if (!stockId) return setAssets([]);
    axios
      .get(toStoreApiUrl(`/assets/instore/${stockId}`))
      .then((r) => setAssets(r.data?.data || []));
  }, [stockId]);

  const submit = async () => {
    if (!stockId || !employeeId || selected.length === 0)
      return setMsg({
        type: "error",
        text: "Select stock, employee, and assets",
      });
    await axios.post(toStoreApiUrl("/issue"), {
      stockId,
      employeeId,
      assetIds: selected,
    });
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
        <label className="text-xs text-gray-600">Employee</label>
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
