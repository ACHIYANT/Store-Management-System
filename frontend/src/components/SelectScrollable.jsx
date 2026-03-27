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

// ✅ Single source of truth
const DIVISIONS = [
  "Procurement (Proc.)",
  "Business Promotion Group (BPG)",
  "Computer Education & Training - Assessment",
  "Computer Education & Training - Awarding - I",
  "Computer Education & Training - Awarding - II",
  "Deployment Division",
  "Estate Management (EM)",
  "Finance & Accounts (F&A)",
  "Information & Communication Technology (ICT) - I",
  "JMD Camp Office",
  "JMD Office",
  "Legal Secretarial & CSR",
  "MD Camp Office",
  "MD Office",
  "Personnel & Administration (P&A)",
  "Project Division - 1",
  "Project Division - 2",
  "Scanning & Digitization",
  "Telecom & Data Services (TDS)",
];

export function SelectScrollable({ division, setDivision }) {
  return (
    <div className="w-full flex flex-col">
      <Select value={division} onValueChange={setDivision} className="w-full">
        <SelectTrigger className=" px-6">
          <SelectValue className="" placeholder="Select your division" />
        </SelectTrigger>
        <SelectContent className="">
          <SelectGroup className="">
            <SelectLabel>Divisions</SelectLabel>
            {/* ✅ Dynamic rendering */}
            {DIVISIONS.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
