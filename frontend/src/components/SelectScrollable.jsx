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
import {
  DIVISION_OPTIONS,
  normalizeDivisionValue,
} from "@/lib/divisions";

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

  const selectedDivision = DIVISION_OPTIONS.some(
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
            {DIVISION_OPTIONS.map((item) => (
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
