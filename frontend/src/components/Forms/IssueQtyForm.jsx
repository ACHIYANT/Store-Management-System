import { useEffect, useState } from "react";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// import { SelectScrollable } from "@/components/SelectScrollable";
import PopupMessage from "@/components/PopupMessage";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

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

  useEffect(() => {
    // Adjust endpoints if yours differ
    axios
      .get("http://localhost:3000/api/v1/stocks")
      .then((r) => setStocks(r.data?.data || []));
    axios
      .get("http://localhost:3000/api/v1/employee")
      .then((r) => setEmployees(r.data?.data || []));
    axios
      .get("http://localhost:3000/api/v1/itemCategories")
      .then((r) => setItemCategories(r.data?.data || []));
  }, []);

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
      .get(`http://localhost:3000/api/v1/stock-items-all/${itemCategoryId}`, {
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
    if (!stockId || !employeeId || !qty)
      return setMsg({ type: "error", text: "Fill all fields" });
    if (stockQty != null && Number(qty) > Number(stockQty))
      return setMsg({ type: "error", text: "Insufficient stock" });
    await axios.post("http://localhost:3000/api/v1/issue", {
      stockId,
      employeeId,
      quantity: Number(qty),
    });
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
                {console.log(employees)}
                {/* {e.fullname || e.name || `Emp #${e.emp_id || e.id}`} */}
                {`${e.emp_id}, ${e.name}, ${e.division}, ${e.designation}`}
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
