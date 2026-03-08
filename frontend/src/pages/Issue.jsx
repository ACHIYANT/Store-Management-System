import { useEffect, useState } from "react";

import IssueUnifiedForm from "@/components/Forms/IssueUnifiedForm";
import ListPage from "@/components/ListPage";

export default function Issue() {
  const [stockId, setStockId] = useState(null);
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const sid = sp.get("stockId");
    if (sid) setStockId(sid);
  }, []);

  return (
    <ListPage
      title="Issue Items"
      showSearch={false}
      showAdd={false}
      showUpdate={false}
      showFilter={false}
      aboveContent={
        <IssueUnifiedForm
          stockId={stockId}
          onStockChange={setStockId}
          employeeId={employeeId}
          onEmployeeChange={setEmployeeId}
        />
      }
      columns={[]} // safe no-op
      data={[1]} // safe no-op
    />
  );
}
