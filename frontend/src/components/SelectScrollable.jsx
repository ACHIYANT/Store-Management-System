import * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DIVISIONS = [
  { value: "Procurement", label: "Procurement (Proc.)" },
  {
    value: "Business Promotion Group",
    label: "Business Promotion Group (BPG)",
  },
  {
    value: "Computer Education & Training - Assessment",
    label: "Computer Education & Training - Assessment",
  },
  {
    value: "Computer Education & Training - Awarding - I",
    label: "Computer Education & Training - Awarding - I",
  },
  {
    value: "Computer Education & Training - Awarding - II",
    label: "Computer Education & Training - Awarding - II",
  },
  { value: "Consultancy", label: "Consultancy" },
  { value: "Deployment", label: "Deployment" },
  { value: "E Office", label: "E Office" },
  { value: "Estate Management", label: "Estate Management (EM)" },
  { value: "Finance & Accounts", label: "Finance & Accounts (F&A)" },
  {
    value: "Information & Communication Technology - I",
    label: "Information & Communication Technology (ICT) - I",
  },
  {
    value: "Information & Communication Technology - Examination",
    label: "Information & Communication Technology (ICT-ET)",
  },
  { value: "JMD Camp Office", label: "JMD Camp Office" },
  { value: "JMD Office", label: "JMD Office" },
  { value: "Legal Secretarial & CSR", label: "Legal Secretarial & CSR" },
  { value: "MD Camp Office", label: "MD Camp Office" },
  { value: "MD Office", label: "MD Office" },
  {
    value: "Personnel & Administration",
    label: "Personnel & Administration (P&A)",
  },
  { value: "Project Division - 1", label: "Project Division - 1" },
  { value: "Project Division - 2", label: "Project Division - 2" },
  { value: "Right To Information", label: "Right To Information" },
  { value: "Scanning & Digitization", label: "Scanning & Digitization" },
  {
    value: "Telecom & Data Services",
    label: "Telecom & Data Services (TDS)",
  },
];

const DIVISION_VALUE_BY_LABEL = Object.fromEntries(
  DIVISIONS.map(({ value, label }) => [label, value]),
);

const normalizeDivisionValue = (division) => {
  const text = String(division || "").trim();
  if (!text) return "";
  return DIVISION_VALUE_BY_LABEL[text] || text;
};

export function SelectScrollable({ division, setDivision }) {
  const normalizedDivision = React.useMemo(
    () => normalizeDivisionValue(division),
    [division],
  );

  React.useEffect(() => {
    if (division && normalizedDivision && division !== normalizedDivision) {
      setDivision(normalizedDivision);
    }
  }, [division, normalizedDivision, setDivision]);

  const selectedDivision = DIVISIONS.some(
    (item) => item.value === normalizedDivision,
  )
    ? normalizedDivision
    : undefined;

  return (
    <div className="w-full flex flex-col">
      <Select
        value={selectedDivision}
        onValueChange={setDivision}
        className="w-full"
      >
        <SelectTrigger className=" px-6">
          <SelectValue className="" placeholder="Select your division" />
        </SelectTrigger>
        <SelectContent className="">
          <SelectGroup className="">
            <SelectLabel>Divisions</SelectLabel>
            {DIVISIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
