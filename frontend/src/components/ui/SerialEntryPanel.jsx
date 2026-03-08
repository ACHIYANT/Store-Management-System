// import React, { useEffect } from "react";

// const SerialEntryPanel = ({ itemIndex, requestedQty, serials, onChange }) => {
//   function normalizeSerials(arr) {
//     const seen = new Set();
//     const cleaned = [];
//     for (const raw of arr) {
//       const s = String(raw || "").trim();
//       if (!s) continue;
//       const key = s.toUpperCase(); // normalize case
//       if (seen.has(key)) continue; // de-dupe
//       seen.add(key);
//       cleaned.push(s);
//     }
//     return cleaned;
//   }

//   const [tab, setTab] = React.useState("TYPE"); // TYPE | FILE | SCAN
//   const remaining = Math.max(0, (requestedQty || 0) - (serials?.length || 0));
//   const canSubmit = requestedQty ? serials.length === requestedQty : true;

//   const apply = (vals) => onChange(normalizeSerials(vals));

//   // TYPE/Paste
//   const [text, setText] = React.useState(serials.join("\n"));
//   useEffect(() => {
//     setText((serials || []).join("\n"));
//   }, [itemIndex]); // reset when switching rows

//   const fromTextarea = () => {
//     const lines = text.split(/\r?\n/);
//     apply(lines);
//   };

//   // FILE (CSV/Excel)
//   const handleFile = async (e) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     const ext = file.name.split(".").pop()?.toLowerCase();
//     if (ext === "csv") {
//       try {
//         const { parse } = await import("papaparse");
//         parse(file, {
//           header: true,
//           skipEmptyLines: true,
//           complete: (res) => {
//             // try common column names or fallback to first column
//             const rows = res.data || [];
//             const keys = rows.length ? Object.keys(rows[0]) : [];
//             const col = keys.find((k) => /serial/i.test(k)) || keys[0] || null;
//             const vals = col ? rows.map((r) => r[col]) : [];
//             apply(vals);
//           },
//         });
//       } catch {
//         // lightweight fallback: no header CSV (first column)
//         const text = await file.text();
//         const vals = text.split(/\r?\n/).map((r) => r.split(",")[0]);
//         apply(vals);
//       }
//     } else if (ext === "xls" || ext === "xlsx") {
//       try {
//         const XLSX = await import("xlsx");
//         const data = await file.arrayBuffer();
//         const wb = XLSX.read(data);
//         const ws = wb.Sheets[wb.SheetNames[0]];
//         const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
//         const keys = json.length ? Object.keys(json[0]) : [];
//         const col = keys.find((k) => /serial/i.test(k)) || keys[0] || null;
//         const vals = col ? json.map((r) => r[col]) : [];
//         apply(vals);
//       } catch (err) {
//         console.error("Excel parse failed", err);
//         alert("Could not read Excel. Save as CSV and try again.");
//       }
//     } else {
//       // TXT or unknown → treat as line list
//       const text = await file.text();
//       apply(text.split(/\r?\n/));
//     }
//     e.target.value = ""; // reset input
//   };

//   // SCAN
//   const [scanValue, setScanValue] = React.useState("");
//   const addScan = () => {
//     if (!scanValue.trim()) return;
//     const next = normalizeSerials([...(serials || []), scanValue]);
//     onChange(next);
//     setScanValue("");
//   };

//   return (
//     <div className="space-y-2">
//       <div className="flex gap-2">
//         {["TYPE", "FILE", "SCAN"].map((t) => (
//           <button
//             key={t}
//             onClick={() => setTab(t)}
//             className={`px-3 py-1 rounded border ${
//               tab === t ? "bg-white" : "bg-gray-200"
//             }`}
//           >
//             {t === "TYPE"
//               ? "Type / Paste"
//               : t === "FILE"
//               ? "CSV / Excel"
//               : "Scan"}
//           </button>
//         ))}
//         <div className="ml-auto text-sm">
//           <span
//             className={`px-2 py-1 rounded ${
//               canSubmit ? "bg-green-100" : "bg-yellow-100"
//             }`}
//           >
//             Serials: {serials.length}
//             {requestedQty ? ` / ${requestedQty}` : ""}
//           </span>
//           {requestedQty ? (
//             <span className="ml-2 text-gray-600">Remaining: {remaining}</span>
//           ) : null}
//         </div>
//       </div>

//       {tab === "TYPE" && (
//         <div className="space-y-2">
//           <textarea
//             rows={5}
//             className="w-full border p-2"
//             placeholder={"One serial per line"}
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//           />
//           <div className="flex gap-2">
//             <button
//               className="bg-blue-600 text-white px-3 py-1 rounded"
//               onClick={fromTextarea}
//             >
//               Use List
//             </button>
//             <button
//               className="px-3 py-1 rounded border"
//               onClick={() => {
//                 setText("");
//                 onChange([]);
//               }}
//             >
//               Clear
//             </button>
//             <button
//               className="px-3 py-1 rounded border"
//               onClick={() => {
//                 // quick tools
//                 const vals = text
//                   .split(/\r?\n/)
//                   .map((s) => s.trim().toUpperCase())
//                   .filter(Boolean);
//                 setText(vals.join("\n"));
//               }}
//             >
//               Trim & Uppercase
//             </button>
//           </div>
//         </div>
//       )}

//       {tab === "FILE" && (
//         <div className="space-y-2">
//           <input
//             type="file"
//             accept=".csv,.xlsx,.xls,.txt"
//             onChange={handleFile}
//           />
//           <p className="text-sm text-gray-600">
//             CSV: include a <code>serial</code> column (or first column will be
//             used). Excel: first sheet, first column or any column named
//             “serial”.
//           </p>
//         </div>
//       )}

//       {tab === "SCAN" && (
//         <div className="space-y-2">
//           <input
//             autoFocus
//             className="border p-2 w-full text-lg"
//             placeholder="Focus here and scan"
//             value={scanValue}
//             onChange={(e) => setScanValue(e.target.value)}
//             onKeyDown={(e) => {
//               if (e.key === "Enter") {
//                 e.preventDefault();
//                 addScan();
//               }
//             }}
//           />
//           <button
//             className="bg-blue-600 text-white px-3 py-1 rounded"
//             onClick={addScan}
//           >
//             Add
//           </button>
//         </div>
//       )}

//       {!!serials.length && (
//         <div className="max-h-40 overflow-auto border rounded">
//           <ul className="text-sm divide-y">
//             {serials.map((s, i) => (
//               <li
//                 key={i}
//                 className="flex items-center justify-between px-2 py-1"
//               >
//                 <span>{s}</span>
//                 <button
//                   className="text-red-600"
//                   onClick={() =>
//                     onChange(serials.filter((_, idx) => idx !== i))
//                   }
//                 >
//                   remove
//                 </button>
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}

//       {requestedQty > 0 && serials.length !== requestedQty && (
//         <div className="text-yellow-700 text-sm">
//           Provide exactly {requestedQty} serials (currently {serials.length}).
//         </div>
//       )}
//     </div>
//   );
// };

// export default SerialEntryPanel;

import React, { useEffect, useRef } from "react";

const SerialEntryPanel = ({ itemIndex, requestedQty, serials, onChange }) => {
  // function normalizeSerials(arr) {
  //   const seen = new Set();
  //   const cleaned = [];
  //   for (const raw of arr) {
  //     const s = String(raw || "").trim();
  //     if (!s) continue;
  //     const key = s.toUpperCase();
  //     if (seen.has(key)) continue;
  //     seen.add(key);
  //     cleaned.push(s);
  //   }
  //   return cleaned;
  // }

  function normalizeSerials(arr) {
    const seen = new Set();
    const cleaned = [];

    for (const raw of arr || []) {
      // ✅ Support both string and object
      const serialValue =
        typeof raw === "string"
          ? raw
          : typeof raw === "object"
          ? raw.serial_number
          : "";

      const s = String(serialValue || "").trim();
      if (!s) continue;

      const key = s.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // ✅ Preserve object shape if present
      if (typeof raw === "object") {
        cleaned.push({
          ...raw,
          serial_number: s,
        });
      } else {
        cleaned.push(s);
      }
    }

    return cleaned;
  }

  const [tab, setTab] = React.useState("TYPE"); // TYPE | FILE | SCAN
  const remaining = Math.max(0, (requestedQty || 0) - (serials?.length || 0));
  const canSubmit = requestedQty ? serials.length === requestedQty : true;

  const apply = (vals) => onChange(normalizeSerials(vals));

  // TYPE/Paste
  // const [text, setText] = React.useState(serials.join("\n"));
  const serializeToText = (arr) =>
    (arr || [])
      .map((s) => (typeof s === "string" ? s : s?.serial_number || ""))
      .filter(Boolean)
      .join("\n");

  const [text, setText] = React.useState(serializeToText(serials));

  useEffect(() => {
    setText(serializeToText(serials));
  }, [itemIndex, serials]);

  // useEffect(() => {
  //   setText((serials || []).join("\n"));
  // }, [itemIndex]); // reset when switching rows

  const fromTextarea = () => apply(text.split(/\r?\n/));

  // FILE (CSV/Excel) – unchanged from your version
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      try {
        const { parse } = await import("papaparse");
        parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const rows = res.data || [];
            const keys = rows.length ? Object.keys(rows[0]) : [];
            const col = keys.find((k) => /serial/i.test(k)) || keys[0] || null;
            const vals = col ? rows.map((r) => r[col]) : [];
            apply(vals);
          },
        });
      } catch {
        const t = await file.text();
        const vals = t.split(/\r?\n/).map((r) => r.split(",")[0]);
        apply(vals);
      }
    } else if (ext === "xls" || ext === "xlsx") {
      try {
        const XLSX = await import("xlsx");
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const keys = json.length ? Object.keys(json[0]) : [];
        const col = keys.find((k) => /serial/i.test(k)) || keys[0] || null;
        const vals = col ? json.map((r) => r[col]) : [];
        apply(vals);
      } catch (err) {
        console.error("Excel parse failed", err);
        alert("Could not read Excel. Save as CSV and try again.");
      }
    } else {
      const t = await file.text();
      apply(t.split(/\r?\n/));
    }
    // e.target.value = "";
  };

  // ======== SCAN (hardware-friendly) ========
  // Many scanners: very fast key bursts + Enter/Tab.
  // We'll detect by timing and finalize on Enter/Tab or by timeout.
  const [scanValue, setScanValue] = React.useState("");
  const hiddenInputRef = useRef(null);

  // Tuning knobs (adjust if needed)
  const SCAN_CHAR_MAX_INTERVAL_MS = 40; // max time between chars to qualify as "scan"
  const SCAN_FINALIZE_SILENCE_MS = 120; // finalize if silence after last char (no terminator)
  const SCAN_MIN_LENGTH = 3; // ignore very short noise

  // Internal buffer driven by global key events
  const bufRef = useRef("");
  const lastTsRef = useRef(0);
  const timeoutRef = useRef(null);

  const resetBuffer = () => {
    bufRef.current = "";
    lastTsRef.current = 0;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const finalizeScan = () => {
    const raw = bufRef.current.trim();
    resetBuffer();
    if (raw.length >= SCAN_MIN_LENGTH) {
      const next = normalizeSerials([...(serials || []), raw]);
      onChange(next);
      setScanValue(""); // visible field
    }
  };

  useEffect(() => {
    if (tab !== "SCAN") {
      resetBuffer();
      return;
    }

    // Ensure the hidden input is focused to avoid page-level side effects,
    // but we still capture at window so even if focus slips, we keep reading.
    hiddenInputRef.current?.focus();

    const onKeyDown = (e) => {
      // If user is typing into other editable controls (except our hidden input), ignore.
      const tag = (e.target?.tagName || "").toLowerCase();
      const isEditable =
        tag === "input" || tag === "textarea" || e.target?.isContentEditable;

      // We *allow* our own hidden input to capture; ignore other editables.
      if (isEditable && e.target !== hiddenInputRef.current) return;

      // Only when SCAN tab is active
      if (tab !== "SCAN") return;

      const now = performance.now();

      // Terminators
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault(); // avoid blurring on Tab
        if (bufRef.current) finalizeScan();
        return;
      }

      // Only consider single printable characters
      if (e.key?.length === 1) {
        const delta = now - (lastTsRef.current || 0);

        // Start a new scan if:
        //  - buffer empty, OR
        //  - previous char was too long ago (human typing)
        if (!bufRef.current || (delta && delta > SCAN_CHAR_MAX_INTERVAL_MS)) {
          // If we had a small buffer and it timed out like a human, drop it.
          if (bufRef.current && bufRef.current.length < SCAN_MIN_LENGTH) {
            resetBuffer();
          }
          bufRef.current = "";
        }

        bufRef.current += e.key;
        lastTsRef.current = now;

        // Rolling "silence" timer to auto-finalize scanners without terminator
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          // finalize only if it *looked like* a scan (fast chars)
          if (bufRef.current.length >= SCAN_MIN_LENGTH) finalizeScan();
          else resetBuffer();
        }, SCAN_FINALIZE_SILENCE_MS);
      }
    };

    window.addEventListener("keydown", onKeyDown, true); // capture phase
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      resetBuffer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, serials]);

  // Manual "Add" button still supported (e.g., for testing with keyboard)
  const addScan = () => {
    const val = scanValue.trim();
    if (!val) return;
    const next = normalizeSerials([...(serials || []), val]);
    onChange(next);
    setScanValue("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {["TYPE", "FILE", "SCAN"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded border ${
              tab === t ? "bg-white" : "bg-gray-200"
            }`}
          >
            {t === "TYPE"
              ? "Type / Paste"
              : t === "FILE"
              ? "CSV / Excel"
              : "Scan"}
          </button>
        ))}
        <div className="ml-auto text-sm">
          <span
            className={`px-2 py-1 rounded ${
              canSubmit ? "bg-green-100" : "bg-yellow-100"
            }`}
          >
            Serials: {serials.length}
            {requestedQty ? ` / ${requestedQty}` : ""}
          </span>
          {requestedQty ? (
            <span className="ml-2 text-gray-600">Remaining: {remaining}</span>
          ) : null}
        </div>
      </div>

      {tab === "TYPE" && (
        <div className="space-y-2">
          <textarea
            rows={5}
            className="w-full border p-2"
            placeholder="One serial per line"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="bg-blue-600 text-white px-3 py-1 rounded"
              onClick={fromTextarea}
            >
              Use List
            </button>
            <button
              className="px-3 py-1 rounded border"
              onClick={() => {
                setText("");
                onChange([]);
              }}
            >
              Clear
            </button>
            <button
              className="px-3 py-1 rounded border"
              onClick={() => {
                const vals = text
                  .split(/\r?\n/)
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean);
                setText(vals.join("\n"));
              }}
            >
              Trim & Uppercase
            </button>
          </div>
        </div>
      )}

      {tab === "FILE" && (
        <div className="space-y-2">
          <input
            className=" bg-white text-black border-2 rounded cursor-pointer inline-block"
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            onChange={handleFile}
          />
          <p className="text-sm text-gray-600">
            CSV: include a <code>serial</code> column (or first column will be
            used). Excel: first sheet, first column or any column named
            “serial”.
          </p>
        </div>
      )}

      {tab === "SCAN" && (
        <div className="space-y-2">
          {/* Hidden focus sink for scanners; we also listen globally. */}
          <input
            ref={hiddenInputRef}
            style={{
              position: "absolute",
              opacity: 0,
              height: 0,
              width: 0,
              pointerEvents: "none",
            }}
            aria-hidden
            tabIndex={-1}
          />
          <input
            className="border p-2 w-full text-lg"
            placeholder="Scan a barcode (Enter/Tab to finish)…"
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addScan();
              }
            }}
          />
          <div className="flex gap-2">
            <button
              className="bg-gray-200 text-black px-6 py-1 rounded border-2 cursor-pointer"
              onClick={addScan}
            >
              {/* "bg-blue-600 text-white px-3 py-1 rounded" */}
              Add
            </button>
            <span className="text-sm text-gray-600 self-center">
              Tip: Most scanners send fast characters + Enter/Tab. This field is
              optional; scans are captured globally while this tab is open.
            </span>
          </div>
        </div>
      )}

      {!!serials.length && (
        <div className="max-h-40 overflow-auto border rounded">
          <ul className="text-sm divide-y">
            {serials.map((s, i) => (
              <li
                key={i}
                className="flex items-center justify-between px-2 py-1"
              >
                {/* <span>{s}</span> */}
                <span>
                  {typeof s === "string" ? s : s?.serial_number || ""}
                </span>

                <button
                  className="text-red-600"
                  onClick={() =>
                    onChange(serials.filter((_, idx) => idx !== i))
                  }
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requestedQty > 0 && serials.length !== requestedQty && (
        <div className="text-yellow-700 text-sm">
          Provide exactly {requestedQty} serials (currently {serials.length}).
        </div>
      )}
    </div>
  );
};

export default SerialEntryPanel;
