import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import DayBookForm from "./DayBookForm";


const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan

  return month >= 3 ? year : year - 1;
};

const DayBookFormFirstStep = ({ vendors = [], onSubmit }) => {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [availableYears, setAvailableYears] = useState([]);


  // ! Added nwe useEffect :
  useEffect(() => {
    const fy = getFinancialYear();
    const years = [];

    for (let y = 2025; y <= fy; y++) {
      years.push(y.toString());
    }

    setAvailableYears(years);
    setSelectedYear(fy.toString());
  }, []);

  const handleNext = () => {
    if (!selectedType || !selectedYear) return;
    setStep(2);
  };

  return (
    <div className="flex flex-col justify-center">

      <div className="min-h-screen bg-white justify-items-center">
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="w-96 shadow-lg rounded-2xl">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-semibold">Select Entry Type</h2>
                <Select onValueChange={(value) => setSelectedType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fixed Assets">Fixed Assets</SelectItem>
                    <SelectItem value="Consumable Items">
                      Consumable Items
                    </SelectItem>
                    <SelectItem value="Vehicle Items">Vehicle Items</SelectItem>
                    <SelectItem value="Stationary Items">
                      Stationary Items
                    </SelectItem>
                  </SelectContent>
                </Select>

                <h2 className="text-xl font-semibold pt-4">
                  Select Financial Year
                </h2>
                <Select
                  value={selectedYear}
                  onValueChange={(value) => setSelectedYear(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Financial Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  className="w-full mt-4"
                  onClick={handleNext}
                  disabled={!selectedType || !selectedYear}
                >
                  Next
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <DayBookForm
            vendors={vendors}
            onSubmit={onSubmit}
            defaultType={selectedType}
            defaultFinYear={selectedYear}
          />
        )}
      </div>
    </div>
  );
};

export default DayBookFormFirstStep;
