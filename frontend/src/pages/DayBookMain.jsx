import ListPageLayout from "./ListPageLayout";

const fields = [
  "Serial No",
  "Name",
  "Date",
  "Amount",
  "Vendor",
  "Entry No",
  "Status",
];
const sampleData = [
  {
    "Serial No": 1,
    Name: "Item 1",
    Date: "2024-01-01",
    Amount: "₹5000",
    Vendor: "ABC Ltd",
    "Entry No": "E001",
    Status: "Approved",
  },
  {
    "Serial No": 2,
    Name: "Item 2",
    Date: "2024-01-02",
    Amount: "₹3000",
    Vendor: "XYZ Pvt",
    "Entry No": "E002",
    Status: "Pending",
  },
];

export default function SomeListPage() {
  return (
    <ListPageLayout
      tabName="Day Book Entries"
      fields={fields}
      data={sampleData}
    />
  );
}
