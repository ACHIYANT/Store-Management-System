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
import NavBar from "../NavBar";

import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const DayBookFormFirstStepUpdate = () => {
  const [availableYears, setAvailableYears] = useState([]);

  const { id } = useParams();
  const navigate = useNavigate();

  const [entryType, setEntryType] = useState("");
  const [finYear, setFinYear] = useState("");
  const [daybook, setDaybook] = useState(null);

  useEffect(() => {
    const startYear = 2025;
    const today = new Date();
    const currentYear = today.getFullYear();
    // const currentYear = 2026;
    const currentMonth = today.getMonth(); // 0-indexed (0 = Jan)
    // const currentMonth = 3; // 0-indexed (0 = Jan)
    const currentDate = today.getDate();
    // const currentDate = 1;

    // Determine the current financial year based on the date
    const isAfterAprilFirst =
      currentMonth > 3 || (currentMonth === 3 && currentDate >= 1);
    const maxYear = isAfterAprilFirst ? currentYear : currentYear - 1;

    const years = [];
    for (let year = startYear; year <= maxYear; year++) {
      years.push(year.toString());
    }

    setAvailableYears(years);
  }, []);

  useEffect(() => {
    async function load() {
      const res = await axios.get(
        `http://localhost:3000/api/v1/daybook/${id}/full`
      );

      const db = res.data.data;
      console.log(db.fin_year);
      setDaybook(db);
      setEntryType(db.entry_type || "");
      setFinYear(
        db.fin_year !== null && db.fin_year !== undefined
          ? String(db.fin_year)
          : ""
      );
    }

    load();
  }, [id]);

  // ✅ Navigate to next step
  const handleNext = () => {
    if (!entryType || !finYear) {
      alert("Please select Entry Type and Financial Year");
      return;
    }

    navigate("/daybook-update-form", {
      state: {
        daybook,
        entryType,
        finYear,
      },
    });
  };

  return (
    <div className="flex flex-col justify-center">
      <div className="min-h-screen bg-white justify-items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-96 shadow-lg rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold">Select Entry Type</h2>

              {/* ✅ Entry Type */}
              <Select
                value={entryType}
                onValueChange={(value) => setEntryType(value)}
                disabled
              >
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

              {/* ✅ Financial Year */}
              <Select
                value={finYear}
                onValueChange={(value) => setFinYear(value)}
                disabled
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

              {/* ✅ Next Button */}
              <Button
                className="w-full mt-4"
                onClick={handleNext}
                disabled={!entryType || !finYear}
              >
                Next
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default DayBookFormFirstStepUpdate;
