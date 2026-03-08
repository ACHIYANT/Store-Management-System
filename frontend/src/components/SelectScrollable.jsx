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

export  function SelectScrollable({ division, setDivision }) {
  console.log("Current division in SelectScrollable:", division); // Debug line
  return (
    <div className="w-full flex flex-col">
      <Select value={division} onValueChange={setDivision} className="w-full">
        <SelectTrigger className=" px-6">
          <SelectValue className="" placeholder="Select your division" />
        </SelectTrigger>
        <SelectContent className="">
          <SelectGroup className="">
            <SelectLabel>Divisions</SelectLabel>
            <SelectItem value="Procurement Division">
              Procurement Division
            </SelectItem>
            <SelectItem value="Administrative Division">
              Administrative Division
            </SelectItem>
            <SelectItem value="Assessment Division">
              Assessment Division
            </SelectItem>
            <SelectItem value="Awarding Division">Awarding Division</SelectItem>
            <SelectItem value="CS Division">CS Division</SelectItem>
            <SelectItem value="MD Staff">MD Staff</SelectItem>
            <SelectItem value="ICT Division">ICT Division</SelectItem>
            <SelectItem value="BPG Division">BPG Division</SelectItem>
            <SelectItem value="TDS Division">TDS Division</SelectItem>
            <SelectItem value="Accounts Division">Accounts Division</SelectItem>
            <SelectItem value="Deployment Division">
              Deployment Division
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
