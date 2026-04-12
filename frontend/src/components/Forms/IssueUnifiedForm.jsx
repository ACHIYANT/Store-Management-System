import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import ListTable from "@/components/ListTable";
import PopupMessage from "@/components/PopupMessage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";
import Modal from "@/components/Modal";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DEFAULT_SKU_UNIT } from "@/constants/skuUnits";
import { STORE_API_BASE_URL } from "@/lib/api-config";

const API = STORE_API_BASE_URL;
const CUSTODIAN_TYPES = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "DIVISION", label: "Division" },
  { value: "VEHICLE", label: "Vehicle" },
];

export default function IssueUnifiedForm({
  stockId,
  onStockChange,
  employeeId,
  onEmployeeChange,
}) {
  const [itemCategories, setItemCategories] = useState([]);
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [categoryHeads, setCategoryHeads] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [categoryHeadId, setCategoryHeadId] = useState("");
  const [categoryGroupId, setCategoryGroupId] = useState("");
  const [stocks, setStocks] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [qty, setQty] = useState("");
  const [stockQty, setStockQty] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "", message: "" });

  // NEW: “cart” to hold multiple issue items
  const [cartItems, setCartItems] = useState([]); // [{stockId, quantity, stockLabel}]
  const [cartSerialized, setCartSerialized] = useState([]); // [{stockId, assetIds, stockLabel}]

  // NEW: optional requisition file
  const [requisitionFile, setRequisitionFile] = useState(null);
  const [requisitionMode, setRequisitionMode] = useState("offline"); // offline | online
  const [onlineRequisitions, setOnlineRequisitions] = useState([]);
  const [onlineReqCursor, setOnlineReqCursor] = useState(null);
  const [onlineReqHasMore, setOnlineReqHasMore] = useState(false);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState("");
  const [onlineReqLoading, setOnlineReqLoading] = useState(false);
  const onlineReqRequestSeqRef = useRef(0);
  const autoMappedReqIdRef = useRef("");

  //qr code states
  const [qrOpen, setQrOpen] = useState(false);
  const [qrAsset, setQrAsset] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrBusy, setQrBusy] = useState(false);

  // employees
  const [employees, setEmployees] = useState([]);
  const [custodianType, setCustodianType] = useState("EMPLOYEE");
  const [custodianId, setCustodianId] = useState("");
  const [custodianOptions, setCustodianOptions] = useState([]);
  const [custodianLoading, setCustodianLoading] = useState(false);

  const isEmployeeCustodian = custodianType === "EMPLOYEE";
  const resolvedCustodianId = isEmployeeCustodian ? employeeId : custodianId;
  const resolvedCustodianType = custodianType;
  const activeEmployeeId = isEmployeeCustodian ? employeeId : "";

  useEffect(() => {
    axios
      .get(`${API}/itemCategories`)
      .then((r) => setItemCategories(r.data?.data || []));
    axios
      .get(`${API}/category-head`)
      .then((r) => setCategoryHeads(r.data?.data || []));
    axios.get(`${API}/employee`).then((r) => setEmployees(r.data?.data || []));
  }, []);

  useEffect(() => {
    if (isEmployeeCustodian) {
      setCustodianOptions([]);
      setCustodianLoading(false);
      return;
    }
    let active = true;
    setCustodianLoading(true);
    axios
      .get(`${API}/custodians`, {
        params: { custodian_type: custodianType, is_active: true },
      })
      .then((r) => {
        if (!active) return;
        setCustodianOptions(r.data?.data || []);
      })
      .catch(() => {
        if (!active) return;
        setCustodianOptions([]);
      })
      .finally(() => {
        if (!active) return;
        setCustodianLoading(false);
      });
    return () => {
      active = false;
    };
  }, [custodianType, isEmployeeCustodian]);

  useEffect(() => {
    if (isEmployeeCustodian) return;
    if (requisitionMode !== "online") return;
    setRequisitionMode("offline");
    setSelectedRequisitionId("");
    setOnlineRequisitions([]);
    setOnlineReqCursor(null);
    setOnlineReqHasMore(false);
    autoMappedReqIdRef.current = "";
  }, [isEmployeeCustodian, requisitionMode]);

  const selectedOnlineRequisition = useMemo(() => {
    return onlineRequisitions.find(
      (r) => String(r.id) === String(selectedRequisitionId),
    );
  }, [onlineRequisitions, selectedRequisitionId]);

  const selectedOnlineReqPendingItems = useMemo(() => {
    const rows = [];
    for (const item of selectedOnlineRequisition?.items || []) {
      const approved = Number(item?.approved_qty || 0);
      const issued = Number(item?.issued_qty || 0);
      const remaining = Math.max(0, approved - issued);
      if (remaining <= 0) continue;

      const requisitionItemId = Number(item?.id);
      if (!Number.isFinite(requisitionItemId)) continue;

      const stockId = Number(item?.stock_id);
      const itemCategoryId = Number(item?.item_category_id);
      const itemNo = Number(item?.item_no);

      rows.push({
        requisition_item_id: requisitionItemId,
        stock_id: Number.isFinite(stockId) ? stockId : null,
        item_category_id: Number.isFinite(itemCategoryId)
          ? itemCategoryId
          : null,
        remaining_qty: remaining,
        sku_unit:
          item?.sku_unit ||
          item?.stock_sku_unit ||
          item?.stock?.sku_unit ||
          DEFAULT_SKU_UNIT,
        particulars: item?.particulars || null,
        stock_item_name:
          item?.stock_item_name || item?.stock?.item_name || null,
        stock_quantity: item?.stock_quantity ?? item?.stock?.quantity ?? null,
        item_no: Number.isFinite(itemNo) ? itemNo : Number.MAX_SAFE_INTEGER,
      });
    }

    return rows.sort(
      (a, b) =>
        a.item_no - b.item_no || a.requisition_item_id - b.requisition_item_id,
    );
  }, [selectedOnlineRequisition]);

  const selectedOnlineReqItemsByStock = useMemo(() => {
    const map = new Map();
    for (const item of selectedOnlineReqPendingItems) {
      if (!Number.isFinite(Number(item.stock_id))) continue;
      const stockId = Number(item.stock_id);
      if (!map.has(stockId)) map.set(stockId, []);
      map.get(stockId).push(item);
    }
    return map;
  }, [selectedOnlineReqPendingItems]);

  const selectedOnlineReqItemsByCategory = useMemo(() => {
    const map = new Map();
    for (const item of selectedOnlineReqPendingItems) {
      if (Number.isFinite(Number(item.stock_id))) continue;
      if (!Number.isFinite(Number(item.item_category_id))) continue;
      const categoryId = Number(item.item_category_id);
      if (!map.has(categoryId)) map.set(categoryId, []);
      map.get(categoryId).push(item);
    }
    return map;
  }, [selectedOnlineReqPendingItems]);

  const hasOnlineUnmappedPending = useMemo(
    () =>
      selectedOnlineReqPendingItems.some(
        (item) =>
          !Number.isFinite(Number(item.stock_id)) ||
          !Number.isFinite(Number(item.item_category_id)),
      ),
    [selectedOnlineReqPendingItems],
  );

  const itemCategoryMap = useMemo(() => {
    const map = new Map();
    for (const category of itemCategories || []) {
      const id = Number(category?.id);
      if (Number.isFinite(id)) map.set(id, category);
    }
    return map;
  }, [itemCategories]);

  const getOnlineCandidatesForStock = useCallback(
    (stockValue) => {
      const sid = Number(stockValue);
      if (!Number.isFinite(sid)) return [];

      const byStock = selectedOnlineReqItemsByStock.get(sid) || [];
      if (byStock.length) return byStock;

      const stockRow = stocks.find((s) => Number(s?._id) === sid);
      const categoryId = Number(stockRow?.item_category_id ?? itemCategoryId);
      if (Number.isFinite(categoryId)) {
        const byCategory =
          selectedOnlineReqItemsByCategory.get(categoryId) || [];
        if (byCategory.length) return byCategory;
      }

      return [];
    },
    [
      selectedOnlineReqItemsByStock,
      selectedOnlineReqItemsByCategory,
      stocks,
      itemCategoryId,
    ],
  );

  const getOnlineRemainingForStock = useCallback(
    (stockValue) =>
      getOnlineCandidatesForStock(stockValue).reduce(
        (sum, item) => sum + Number(item.remaining_qty || 0),
        0,
      ),
    [getOnlineCandidatesForStock],
  );

  const fetchOnlineRequisitions = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      const requestSeq = ++onlineReqRequestSeqRef.current;

      if (!activeEmployeeId) {
        setOnlineRequisitions([]);
        setOnlineReqCursor(null);
        setOnlineReqHasMore(false);
        setSelectedRequisitionId("");
        return;
      }
      try {
        setOnlineReqLoading(true);
        const res = await axios.get(`${API}/requisitions/for-issue`, {
          params: {
            employeeId: activeEmployeeId,
            cursorMode: true,
            cursor: cursor || undefined,
            limit: 50,
          },
        });
        if (requestSeq !== onlineReqRequestSeqRef.current) return;

        const rows = res.data?.data || [];
        const meta = res.data?.meta || {};
        setOnlineRequisitions((prev) => (append ? [...prev, ...rows] : rows));
        setOnlineReqCursor(meta?.nextCursor || null);
        setOnlineReqHasMore(Boolean(meta?.hasMore));
        if (!append) {
          autoMappedReqIdRef.current = "";
          setSelectedRequisitionId((prev) => {
            if (!prev) return rows[0]?.id ? String(rows[0].id) : "";
            return rows.some((r) => String(r.id) === String(prev))
              ? prev
              : rows[0]?.id
                ? String(rows[0].id)
                : "";
          });
        }
      } catch {
        if (requestSeq !== onlineReqRequestSeqRef.current) return;
        if (!append) {
          setOnlineRequisitions([]);
          setOnlineReqCursor(null);
          setOnlineReqHasMore(false);
          setSelectedRequisitionId("");
        }
      } finally {
        if (requestSeq === onlineReqRequestSeqRef.current) {
          setOnlineReqLoading(false);
        }
      }
    },
    [activeEmployeeId],
  );

  useEffect(() => {
    if (requisitionMode !== "online") return;
    fetchOnlineRequisitions({ cursor: null, append: false });
  }, [requisitionMode, activeEmployeeId, fetchOnlineRequisitions]);

  useEffect(() => {
    if (requisitionMode !== "online") return;
    onStockChange?.("");
    setAssets([]);
    setSelectedAssets([]);
    setQty("");
    setStockQty(null);
  }, [selectedRequisitionId, requisitionMode, onStockChange]);

  useEffect(() => {
    if (requisitionMode !== "online") {
      autoMappedReqIdRef.current = "";
      return;
    }

    if (!selectedRequisitionId) {
      autoMappedReqIdRef.current = "";
      setCartItems([]);
      setCartSerialized([]);
      return;
    }

    if (autoMappedReqIdRef.current === String(selectedRequisitionId)) return;
    if (!itemCategories.length) return;

    let cancelled = false;

    const autoAssignRequisitionItems = async () => {
      const pendingItems = selectedOnlineReqPendingItems || [];
      if (!pendingItems.length) {
        if (!cancelled) {
          setCartItems([]);
          setCartSerialized([]);
          autoMappedReqIdRef.current = String(selectedRequisitionId);
        }
        return;
      }

      const unmappedItems = pendingItems
        .filter(
          (item) =>
            !Number.isFinite(Number(item.stock_id)) ||
            !Number.isFinite(Number(item.item_category_id)),
        )
        .map((item) => item.item_no || item.requisition_item_id);

      if (unmappedItems.length > 0) {
        if (!cancelled) {
          setCartItems([]);
          setCartSerialized([]);
          setPopup({
            open: true,
            type: "error",
            message: `Requisition mapping is incomplete. Map item no: ${unmappedItems.join(
              ", ",
            )} in Requisition Detail first.`,
          });
          autoMappedReqIdRef.current = String(selectedRequisitionId);
        }
        return;
      }

      const unknownCategoryItems = pendingItems
        .filter((item) => !itemCategoryMap.has(Number(item.item_category_id)))
        .map((item) => item.item_no || item.requisition_item_id);

      if (unknownCategoryItems.length > 0) {
        if (!cancelled) {
          setCartItems([]);
          setCartSerialized([]);
          setPopup({
            open: true,
            type: "error",
            message: `Category metadata is missing for item no: ${unknownCategoryItems.join(
              ", ",
            )}.`,
          });
          autoMappedReqIdRef.current = String(selectedRequisitionId);
        }
        return;
      }

      const buildStockLabel = (item) => {
        const base =
          item?.stock_item_name ||
          item?.particulars ||
          `Stock #${item.stock_id}`;
        const stockQty = Number(item?.stock_quantity);
        const stockUnit = item?.sku_unit || DEFAULT_SKU_UNIT;
        return Number.isFinite(stockQty)
          ? `${base} (${stockQty} ${stockUnit})`
          : base;
      };

      const nonSerializedCart = [];
      const serializedPendingItems = [];
      for (const item of pendingItems) {
        const category = itemCategoryMap.get(Number(item.item_category_id));
        if (category?.serialized_required) {
          serializedPendingItems.push(item);
          continue;
        }
        nonSerializedCart.push({
          stockId: Number(item.stock_id),
          quantity: Number(item.remaining_qty || 0),
          sku_unit: item?.sku_unit || DEFAULT_SKU_UNIT,
          stockLabel: buildStockLabel(item),
          requisition_item_id: item.requisition_item_id,
        });
      }

      const serializedStockIds = [
        ...new Set(
          serializedPendingItems
            .map((item) => Number(item.stock_id))
            .filter((id) => Number.isFinite(id)),
        ),
      ];

      const assetsByStock = new Map();
      await Promise.all(
        serializedStockIds.map(async (stockValue) => {
          try {
            const res = await axios.get(`${API}/assets/instore/${stockValue}`);
            assetsByStock.set(
              stockValue,
              Array.isArray(res.data?.data) ? res.data.data : [],
            );
          } catch {
            assetsByStock.set(stockValue, []);
          }
        }),
      );

      const serializedCursorByStock = new Map();
      const serializedCart = [];
      const partialItems = [];

      for (const item of serializedPendingItems) {
        const stockValue = Number(item.stock_id);
        const requiredQty = Math.max(0, Number(item.remaining_qty || 0));
        const stockAssets = assetsByStock.get(stockValue) || [];
        const start = serializedCursorByStock.get(stockValue) || 0;

        const pickedAssetIds = stockAssets
          .slice(start, start + requiredQty)
          .map((asset) => Number(asset?.id))
          .filter((assetId) => Number.isFinite(assetId));

        serializedCursorByStock.set(stockValue, start + pickedAssetIds.length);

        if (pickedAssetIds.length < requiredQty) {
          partialItems.push(item.item_no || item.requisition_item_id);
        }

        if (pickedAssetIds.length > 0) {
          serializedCart.push({
            stockId: stockValue,
            assetIds: pickedAssetIds,
            sku_unit: item?.sku_unit || DEFAULT_SKU_UNIT,
            stockLabel: buildStockLabel(item),
            requisition_item_id: item.requisition_item_id,
          });
        }
      }

      if (!cancelled) {
        setCartItems(nonSerializedCart);
        setCartSerialized(serializedCart);
        if (partialItems.length > 0) {
          setPopup({
            open: true,
            type: "warning",
            message: `Serialized assets are partially available for item no: ${partialItems.join(
              ", ",
            )}. Review before final issue.`,
          });
        } else {
          setPopup({
            open: true,
            type: "info",
            message:
              "Mapped requisition items were auto-added to the issue list.",
          });
        }
        autoMappedReqIdRef.current = String(selectedRequisitionId);
      }
    };

    void autoAssignRequisitionItems();
    return () => {
      cancelled = true;
    };
  }, [
    requisitionMode,
    selectedRequisitionId,
    selectedOnlineReqPendingItems,
    itemCategories.length,
    itemCategoryMap,
  ]);

  useEffect(() => {
    if (!categoryHeadId) {
      setCategoryGroups([]);
      setCategoryGroupId("");
      setItemCategoryId("");
      return;
    }
    axios
      .get(`${API}/category-group/by-head/${categoryHeadId}`)
      .then((r) => setCategoryGroups(r.data?.data || []))
      .catch(() => setCategoryGroups([]));
    setCategoryGroupId("");
    setItemCategoryId("");
  }, [categoryHeadId]);

  useEffect(() => {
    if (!categoryGroupId) {
      setItemCategoryId("");
      return;
    }
    setItemCategoryId("");
  }, [categoryGroupId]);

  // when category changes → fetch its stocks, clear stock and assets
  useEffect(() => {
    if (!itemCategoryId) {
      setStocks([]);
      onStockChange?.("");
      setAssets([]);
      setSelectedAssets([]);
      return;
    }
    const categoryRow = itemCategories.find(
      (c) => String(c?.id) === String(itemCategoryId),
    );
    const categoryIsSerialized = Boolean(categoryRow?.serialized_required);
    const shouldGroupByMaster =
      requisitionMode !== "online" && !categoryIsSerialized;
    axios
      .get(`${API}/stock-items-all/${itemCategoryId}`, {
        params: {
          onlyInStock: true,
          groupByMaster: shouldGroupByMaster,
        },
      })
      .then((r) => {
        const raw = r.data?.data || [];

        // Normalize: ensure we have a consistent id and qty for every row.
        const normalized = raw.map((x) => {
          const id = x.id ?? x.stock_id ?? x.StockId ?? x.stockId;
          const qty = Number(
            x.quantity ??
              x.available_quantity ??
              x.availableQty ??
              x.available_qty ??
              x.instore_count ??
              x.instore ??
              x.count ??
              0,
          );
          const skuUnit = x.sku_unit || x.skuUnit || DEFAULT_SKU_UNIT;

          return {
            ...x,
            _id: id,
            _qty: Number.isFinite(qty) ? qty : 0,
            _sku_unit: String(skuUnit || DEFAULT_SKU_UNIT),
          };
        });

        setStocks(normalized);
        onStockChange?.("");
        setAssets([]);
        setSelectedAssets([]);
      })
      .catch(() => {
        setStocks([]);
        onStockChange?.("");
        setAssets([]);
        setSelectedAssets([]);
        setStockQty(null);
      });
  }, [itemCategoryId, onStockChange, itemCategories, requisitionMode]);

  // when stock changes → fetch asset list and set available qty
  useEffect(() => {
    if (!stockId) {
      setAssets([]);
      setSelectedAssets([]);
      setStockQty(null);
      return;
    }
    const hit = stocks.find((s) => String(s._id) === String(stockId));
    setStockQty(hit?._qty ?? null);
    axios
      .get(`${API}/assets/instore/${stockId}`)
      .then((r) => setAssets(r.data?.data || []))
      .catch(() => setAssets([]));
  }, [stockId, stocks]);

  const currentStockLabel = useMemo(() => {
    const s = stocks.find((x) => String(x._id) === String(stockId));
    if (!s) return "";
    const base = s.item_name || s.name || `Stock #${s._id}`;
    const unit = s?._sku_unit || DEFAULT_SKU_UNIT;
    const qtyStr = Number.isFinite(s?._qty) ? ` (${s._qty} ${unit})` : "";
    return `${base}${qtyStr}`;
  }, [stocks, stockId]);

  const currentSkuUnit = useMemo(() => {
    const s = stocks.find((x) => String(x._id) === String(stockId));
    return s?._sku_unit || DEFAULT_SKU_UNIT;
  }, [stocks, stockId]);

  const filteredCategories = useMemo(() => {
    if (!categoryGroupId) return [];
    return itemCategories.filter(
      (c) => String(c.group_id) === String(categoryGroupId),
    );
  }, [itemCategories, categoryGroupId]);

  // find whether current category is serialized
  const isSerialized = useMemo(() => {
    const cat = itemCategories.find(
      (c) => String(c.id) === String(itemCategoryId),
    );
    return Boolean(cat?.serialized_required);
  }, [itemCategories, itemCategoryId]);

  const issueTargetLocked = cartItems.length > 0 || cartSerialized.length > 0;

  const usedAssetIds = useMemo(
    () => new Set(cartSerialized.flatMap((c) => c.assetIds || [])),
    [cartSerialized],
  );

  const availableAssets = useMemo(
    () => assets.filter((a) => !usedAssetIds.has(a.id)),
    [assets, usedAssetIds],
  );

  const availableStocks = useMemo(() => {
    let scopedStocks = stocks;
    if (requisitionMode === "online") {
      if (!selectedRequisitionId) return [];
      const mapped = stocks.filter(
        (s) => getOnlineCandidatesForStock(Number(s._id)).length > 0,
      );
      scopedStocks = mapped;
    }
    if (isSerialized) return scopedStocks;
    return scopedStocks.filter(
      (s) => !cartItems.some((it) => String(it.stockId) === String(s._id)),
    );
  }, [
    stocks,
    cartItems,
    isSerialized,
    requisitionMode,
    selectedRequisitionId,
    getOnlineCandidatesForStock,
  ]);

  useEffect(() => {
    if (!stockId) return;
    const stillAvailable = availableStocks.some(
      (s) => String(s._id) === String(stockId),
    );
    if (!stillAvailable) {
      onStockChange?.("");
      setSelectedAssets([]);
      setQty("");
      setStockQty(null);
    }
  }, [availableStocks, stockId, onStockChange]);

  useEffect(() => {
    if (usedAssetIds.size === 0) return;
    setSelectedAssets((prev) => prev.filter((id) => !usedAssetIds.has(id)));
  }, [usedAssetIds]);

  const resetIssueContext = useCallback(() => {
    // Invalidate in-flight requisition fetches and clear dependent state.
    onlineReqRequestSeqRef.current += 1;
    setOnlineReqLoading(false);
    setSelectedRequisitionId("");
    setOnlineRequisitions([]);
    setOnlineReqCursor(null);
    setOnlineReqHasMore(false);
    autoMappedReqIdRef.current = "";

    onStockChange?.("");
    setCategoryHeadId("");
    setCategoryGroupId("");
    setItemCategoryId("");
    setStocks([]);
    setAssets([]);
    setSelectedAssets([]);
    setQty("");
    setStockQty(null);
    setRequisitionFile(null);
  }, [onStockChange]);

  const handleEmployeeChange = useCallback(
    (nextEmployeeId) => {
      if (String(nextEmployeeId || "") === String(employeeId || "")) return;
      resetIssueContext();
      onEmployeeChange?.(nextEmployeeId);
    },
    [employeeId, onEmployeeChange, resetIssueContext],
  );

  const handleCustodianTypeChange = useCallback(
    (nextType) => {
      if (String(nextType || "") === String(custodianType || "")) return;
      resetIssueContext();
      setCustodianType(nextType);
      setCustodianId("");
      onEmployeeChange?.("");
    },
    [custodianType, onEmployeeChange, resetIssueContext],
  );

  const handleCustodianIdChange = useCallback(
    (nextId) => {
      if (String(nextId || "") === String(custodianId || "")) return;
      resetIssueContext();
      setCustodianId(nextId);
    },
    [custodianId, resetIssueContext],
  );
  const addItemToCart = () => {
    if (!itemCategoryId || !stockId || !resolvedCustodianId) {
      return setPopup({
        open: true,
        type: "error",
        message: "Select Item Category, Stock, and Issue To",
      });
    }

    const onlineCandidates =
      requisitionMode === "online"
        ? getOnlineCandidatesForStock(Number(stockId))
        : [];
    const onlineItem = onlineCandidates[0] || null;
    const onlineRemaining =
      requisitionMode === "online"
        ? getOnlineRemainingForStock(Number(stockId))
        : 0;

    if (requisitionMode === "online") {
      if (!selectedRequisitionId) {
        return setPopup({
          open: true,
          type: "error",
          message: "Select an online requisition first.",
        });
      }
      if (hasOnlineUnmappedPending) {
        return setPopup({
          open: true,
          type: "error",
          message:
            "Requisition item mapping is incomplete. Please map all pending items first.",
        });
      }
      if (!onlineItem) {
        return setPopup({
          open: true,
          type: "error",
          message: "Selected stock is not pending in the chosen requisition.",
        });
      }
    }

    if (isSerialized) {
      const uniqueSelected = selectedAssets.filter(
        (id) => !usedAssetIds.has(id),
      );
      if (uniqueSelected.length === 0) {
        return setPopup({
          open: true,
          type: "error",
          message: "Select at least one new asset to issue",
        });
      }
      if (
        requisitionMode === "online" &&
        uniqueSelected.length > Number(onlineRemaining || 0)
      ) {
        return setPopup({
          open: true,
          type: "error",
          message: `Selected assets exceed requisition pending qty (${onlineRemaining || 0}).`,
        });
      }
      // push a serialized group for this stock
      setCartSerialized((prev) => [
        ...prev,
        {
          stockId: Number(stockId),
          assetIds: [...uniqueSelected],
          sku_unit: onlineItem?.sku_unit || currentSkuUnit,
          stockLabel: currentStockLabel,
          requisition_item_id: onlineItem?.requisition_item_id || null,
        },
      ]);
      // clear selection for next item
      setSelectedAssets([]);
      onStockChange?.("");
      setPopup({
        open: true,
        type: "success",
        message: `Added ${uniqueSelected.length} asset(s) to issue list`,
      });
    } else {
      if (!qty)
        return setPopup({
          open: true,
          type: "error",
          message: "Enter quantity",
        });
      if (cartItems.some((it) => String(it.stockId) === String(stockId))) {
        return setPopup({
          open: true,
          type: "error",
          message: "This stock is already in the issue list",
        });
      }
      if (stockQty != null && Number(qty) > Number(stockQty)) {
        return setPopup({
          open: true,
          type: "error",
          message: "Insufficient stock",
        });
      }
      if (
        requisitionMode === "online" &&
        Number(qty) > Number(onlineRemaining || 0)
      ) {
        return setPopup({
          open: true,
          type: "error",
          message: `Requested issue qty exceeds requisition pending qty (${onlineRemaining || 0}).`,
        });
      }
      setCartItems((prev) => [
        ...prev,
        {
          stockId: Number(stockId),
          quantity: Number(qty),
          sku_unit: onlineItem?.sku_unit || currentSkuUnit,
          stockLabel: currentStockLabel,
          requisition_item_id: onlineItem?.requisition_item_id || null,
        },
      ]);
      setQty("");
      onStockChange?.("");
      setPopup({
        open: true,
        type: "success",
        message: "Added quantity to issue list",
      });
    }
  };

  const removeCartItem = (idx) => {
    setCartItems((prev) => prev.filter((_, i) => i !== idx));
  };
  const removeCartSerialized = (idx) => {
    setCartSerialized((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildBulkPayload = () => {
    // If user didn’t click “Add”, auto-add current selection as single item for convenience
    let items = [...cartItems];
    let serializedItems = [...cartSerialized];

    if (!isSerialized && qty && stockId) {
      const alreadyInCart = cartItems.some(
        (it) => String(it.stockId) === String(stockId),
      );
      if (
        !alreadyInCart &&
        (stockQty == null || Number(qty) <= Number(stockQty))
      ) {
        const onlineCandidates =
          requisitionMode === "online"
            ? getOnlineCandidatesForStock(Number(stockId))
            : [];
        const onlineItem = onlineCandidates[0] || null;
        const onlineRemaining =
          requisitionMode === "online"
            ? getOnlineRemainingForStock(Number(stockId))
            : 0;
        const allowOnlineQty =
          requisitionMode !== "online" ||
          (onlineItem && Number(qty) <= Number(onlineRemaining || 0));
        if (allowOnlineQty) {
          items.push({
            stockId: Number(stockId),
            quantity: Number(qty),
            sku_unit: onlineItem?.sku_unit || currentSkuUnit,
            stockLabel: currentStockLabel,
            requisition_item_id: onlineItem?.requisition_item_id || null,
          });
        }
      }
    }
    if (isSerialized && selectedAssets.length && stockId) {
      const uniqueSelected = selectedAssets.filter(
        (id) => !usedAssetIds.has(id),
      );
      if (uniqueSelected.length > 0) {
        const onlineCandidates =
          requisitionMode === "online"
            ? getOnlineCandidatesForStock(Number(stockId))
            : [];
        const onlineItem = onlineCandidates[0] || null;
        serializedItems.push({
          stockId: Number(stockId),
          assetIds: [...uniqueSelected],
          sku_unit: onlineItem?.sku_unit || currentSkuUnit,
          stockLabel: currentStockLabel,
          requisition_item_id: onlineItem?.requisition_item_id || null,
        });
      }
    }

    // Strip UI labels for payload
    const resolvedEmployeeId =
      isEmployeeCustodian && employeeId ? Number(employeeId) : undefined;
    const custodianIdValue =
      resolvedCustodianId != null && String(resolvedCustodianId).trim() !== ""
        ? String(resolvedCustodianId)
        : undefined;

    const payload = {
      employeeId: resolvedEmployeeId,
      custodianId: custodianIdValue,
      custodianType: custodianIdValue ? resolvedCustodianType : undefined,
      requisitionId:
        isEmployeeCustodian &&
        requisitionMode === "online" &&
        selectedRequisitionId
          ? Number(selectedRequisitionId)
          : undefined,
      items: items.map(
        ({ stockId, quantity, sku_unit, requisition_item_id }) => ({
          stockId,
          quantity,
          sku_unit: sku_unit || DEFAULT_SKU_UNIT,
          requisition_item_id: requisition_item_id || undefined,
        }),
      ),
      serializedItems: serializedItems.map(
        ({ stockId, assetIds, sku_unit, requisition_item_id }) => ({
          stockId,
          assetIds,
          sku_unit: sku_unit || DEFAULT_SKU_UNIT,
          requisition_item_id: requisition_item_id || undefined,
        }),
      ),
    };
    return { payload, items, serializedItems };
  };

  const submit = async () => {
    if (!resolvedCustodianId) {
      return setPopup({
        open: true,
        type: "error",
        message: "Select Issue To",
      });
    }
    const { payload, items, serializedItems } = buildBulkPayload();
    if (
      (!items || items.length === 0) &&
      (!serializedItems || serializedItems.length === 0)
    ) {
      return setPopup({
        open: true,
        type: "error",
        message: "Add at least one item to issue",
      });
    }
    if (requisitionMode === "offline" && !requisitionFile) {
      return setPopup({
        open: true,
        type: "error",
        message: "Please upload the requisition Copy.",
      });
    }
    if (
      requisitionMode === "online" &&
      (!isEmployeeCustodian || !selectedRequisitionId)
    ) {
      return setPopup({
        open: true,
        type: "error",
        message: isEmployeeCustodian
          ? "Select a digital requisition before issuing."
          : "Online requisition requires Employee Issue To",
      });
    }
    if (requisitionMode === "online" && hasOnlineUnmappedPending) {
      return setPopup({
        open: true,
        type: "error",
        message:
          "Requisition item mapping is incomplete. Map all pending items first.",
      });
    }
    try {
      let response = null;
      if (requisitionMode === "offline" && requisitionFile) {
        // multipart with file
        const fd = new FormData();
        fd.append("file", requisitionFile);
        if (payload.employeeId != null) {
          fd.append("employeeId", String(payload.employeeId));
        }
        if (payload.custodianId) {
          fd.append("custodianId", String(payload.custodianId));
          if (payload.custodianType) {
            fd.append("custodianType", String(payload.custodianType));
          }
        }
        fd.append("items", JSON.stringify(payload.items));
        fd.append("serializedItems", JSON.stringify(payload.serializedItems));
        response = await axios.post(`${API}/issue/bulk-with-requisition`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        // simple JSON
        response = await axios.post(`${API}/issue/bulk`, payload, {
          headers: { "Content-Type": "application/json" },
        });
      }

      const totalQty =
        (payload.items || []).reduce((a, b) => a + Number(b.quantity || 0), 0) +
        (payload.serializedItems || []).reduce(
          (a, b) => a + (b.assetIds?.length || 0),
          0,
        );
      const generatedMir = response?.data?.data?.mir || null;

      setPopup({
        open: true,
        type: "success",
        message: generatedMir?.mir_no
          ? `Issued ${totalQty} item(s) successfully.\nMIR generated: ${generatedMir.mir_no}`
          : `Issued ${totalQty} item(s) successfully`,
      });

      // reset lightweight fields; keep selections that are still on screen?
      setCartItems([]);
      setCartSerialized([]);
      setSelectedAssets([]);
      setQty("");
      setRequisitionFile(null);
      setSelectedRequisitionId("");
      setOnlineRequisitions([]);
      setOnlineReqCursor(null);
      setOnlineReqHasMore(false);
      autoMappedReqIdRef.current = "";
      setCategoryHeadId("");
      setCategoryGroupId("");
      setItemCategoryId("");
      onStockChange?.("");
      onEmployeeChange?.("");
      setStocks([]);
      setAssets([]);
      setStockQty(null);
    } catch (e) {
      setPopup({
        open: true,
        type: "error",
        message: e?.response?.data?.message || "Issuing failed",
      });
    }
  };

  // Table columns for serialized assets
  const assetColumns = [
    { key: "id", label: "ID" },
    { key: "serial_number", label: "Serial" },
    { key: "asset_tag", label: "Asset Tag" },
    {
      key: "qr",
      label: "QR",
      render: (_, row) => (
        <Button
          type="button"
          className="h-8 px-3"
          onClick={(e) => {
            e.stopPropagation();
            openQrPreview(row);
          }}
        >
          Preview
        </Button>
      ),
    },
    {
      key: "print",
      label: "Print",
      render: (_, row) => (
        <Button
          type="button"
          variant="secondary"
          className="h-8 px-3"
          onClick={async (e) => {
            e.stopPropagation();
            await openQrPreview(row);
            printQr();
          }}
        >
          Print
        </Button>
      ),
    },
  ];

  // QR helpers
  const buildQrPayload = (a) =>
    `asset_id=${a.id}&asset_tag=${encodeURIComponent(
      a.asset_tag || "",
    )}&serial=${encodeURIComponent(a.serial_number || "")}`;

  const openQrPreview = async (assetRow) => {
    try {
      setQrBusy(true);
      setQrAsset(assetRow);
      const payload = buildQrPayload(assetRow);
      const url = await QRCode.toDataURL(payload, { width: 256, margin: 1 });
      setQrDataUrl(url);
      setQrOpen(true);
    } finally {
      setQrBusy(false);
    }
  };

  const printQr = () => {
    const w = window.open("", "_blank", "width=420,height=520");
    if (!w) return;
    const title = `Asset ${qrAsset?.asset_tag || qrAsset?.id || ""}`;
    w.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body{margin:0;padding:20px;font-family:ui-sans-serif,system-ui,Arial}
          .wrap{display:flex;flex-direction:column;align-items:center;gap:8px}
          img{width:256px;height:256px}
          .text{font-size:12px;color:#111}
          .bold{font-weight:600}
        </style>
      </head>
      <body>
        <div class="wrap">
          <img src="${qrDataUrl}" />
          <div class="text"><span class="bold">Asset:</span> ${
            qrAsset?.asset_tag || qrAsset?.id || "-"
          }</div>
          <div class="text"><span class="bold">Serial:</span> ${
            qrAsset?.serial_number || "-"
          }</div>
        </div>
        <script>window.onload = () => { window.print(); setTimeout(()=>window.close(), 300); };</script>
      </body>
    </html>`);
    w.document.close();
  };

  const enableItemSelection = Boolean(resolvedCustodianId);

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
        <div className="text-sm font-semibold text-slate-700 mb-3">
          Issue Details
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          {/* Issue To Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Issue To Type
            </label>
            <Select
              value={custodianType}
              onValueChange={handleCustodianTypeChange}
              disabled={issueTargetLocked}
            >
              <SelectTrigger className="h-10 border-slate-300 bg-white">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {CUSTODIAN_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Issue To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              {isEmployeeCustodian
                ? "Employee"
                : custodianType === "DIVISION"
                  ? "Division"
                  : "Vehicle"}
            </label>
            {isEmployeeCustodian ? (
              <Select
                value={String(employeeId || "")}
                onValueChange={handleEmployeeChange}
                disabled={issueTargetLocked}
              >
                <SelectTrigger className="h-10 border-slate-300 bg-white">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem
                      key={e.emp_id || e.id}
                      value={String(e.emp_id || e.id)}
                    >
                      {e.fullname || e.name || `Emp #${e.emp_id || e.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={String(custodianId || "")}
                onValueChange={handleCustodianIdChange}
                disabled={issueTargetLocked}
              >
                <SelectTrigger className="h-10 border-slate-300 bg-white">
                  <SelectValue
                    placeholder={
                      custodianLoading
                        ? "Loading..."
                        : `Select ${custodianType.toLowerCase()}`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {custodianLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : custodianOptions.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      No custodians found
                    </SelectItem>
                  ) : (
                    custodianOptions.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {`${c.id} - ${c.display_name}${c.location ? ` (${c.location})` : ""}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            {issueTargetLocked ? (
              <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                Issue-to selection is locked while issue items are present.
                Remove items from the issue list to change.
              </div>
            ) : !enableItemSelection ? (
              <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600">
                Begin by selecting an issue target to continue.
              </div>
            ) : null}
            {!isEmployeeCustodian && requisitionMode === "online" ? (
              <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                Online requisition is available only for Employee issue.
              </div>
            ) : null}
          </div>

          {requisitionMode === "offline" ? (
            <>
              {/* Category Head */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Category Head
                </label>
                <Select
                  value={String(categoryHeadId || "")}
                  onValueChange={setCategoryHeadId}
                  disabled={!enableItemSelection}
                >
                  <SelectTrigger className="h-10 border-slate-300 bg-white">
                    <SelectValue
                      placeholder={
                        enableItemSelection
                          ? "Select head"
                          : "Select issue target first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryHeads.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>
                        {h.category_head_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Group */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Category Group
                </label>
                <Select
                  value={String(categoryGroupId || "")}
                  onValueChange={setCategoryGroupId}
                  disabled={!enableItemSelection || !categoryHeadId}
                >
                  <SelectTrigger className="h-10 border-slate-300 bg-white">
                    <SelectValue
                      placeholder={
                        !enableItemSelection
                          ? "Select issue target first"
                          : categoryHeadId
                            ? "Select group"
                            : "Select head first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryGroups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.category_group_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Item Category */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Item Category
                </label>
                <Select
                  value={String(itemCategoryId || "")}
                  onValueChange={setItemCategoryId}
                  disabled={!enableItemSelection || !categoryGroupId}
                >
                  <SelectTrigger className="h-10 border-slate-300 bg-white">
                    <SelectValue
                      placeholder={
                        !enableItemSelection
                          ? "Select issue target first"
                          : categoryGroupId
                            ? "Select category"
                            : "Select group first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((ic) => (
                      <SelectItem key={ic.id} value={String(ic.id)}>
                        {ic.category_name}{" "}
                        {ic.serialized_required ? "(Serialized)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stock filtered by category */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Stock
                </label>
                <Select
                  key={itemCategoryId}
                  value={
                    stockId != null && stockId !== ""
                      ? String(stockId)
                      : undefined
                  }
                  onValueChange={(v) => onStockChange?.(Number(v))}
                  disabled={!enableItemSelection || !itemCategoryId}
                >
                  <SelectTrigger className="h-10 border-slate-300 bg-white">
                    <SelectValue
                      placeholder={
                        !enableItemSelection
                          ? "Select issue target first"
                          : !itemCategoryId
                            ? "Select category first"
                            : "Select stock"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStocks.map((s) => (
                      <SelectItem key={s._id} value={String(s._id)}>
                        {s.item_name || s.name || `Stock #${s._id}`}{" "}
                        {`(${s._qty} ${s._sku_unit || DEFAULT_SKU_UNIT})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="md:col-span-4 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                Online Requisition Workflow
              </div>
              <p className="mt-1 text-sm leading-5 text-sky-900">
                {enableItemSelection
                  ? "Online Requisition mode is active. Category and stock selectors are unavailable because items are sourced from mapped requisition entries."
                  : "Please select an employee issue target to load mapped online requisition entries."}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
        <div className="text-sm font-semibold text-slate-700 mb-3">
          Issue Mode
        </div>
        {requisitionMode === "offline" ? (
          <>
            {/* Mode switch: Serialized → assets table; Non-serialized → qty */}
            {isSerialized ? (
              <>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Select serialized assets to issue
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <ListTable
                    data={availableAssets}
                    columns={assetColumns}
                    selectedRows={selectedAssets}
                    // onRowSelect={(_, next) => setSelectedAssets(next)}
                    onRowSelect={(id) =>
                      setSelectedAssets((prev) =>
                        prev.includes(id)
                          ? prev.filter((x) => x !== id)
                          : [...prev, id],
                      )
                    }
                    idCol="id"
                  />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-4 items-end sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    Quantity
                  </label>
                  <Input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    disabled={!enableItemSelection || !stockId}
                    className="h-10 max-w-[220px] border-slate-300 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    SKU Unit
                  </label>
                  <Input
                    value={currentSkuUnit}
                    readOnly
                    className="h-10 max-w-[220px] border-slate-300 bg-slate-100"
                  />
                </div>
                {stockQty != null ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="text-xs font-medium text-emerald-700">
                      Available Quantity
                    </div>
                    <div className="mt-0.5 text-base font-semibold text-emerald-900">
                      {stockQty}{" "}
                      <span className="text-sm font-medium text-emerald-700">
                        {currentSkuUnit}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    Select stock to view available quantity.
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Automated Issue Source
            </div>
            <p className="mt-1 text-sm leading-5 text-emerald-900">
              Online Requisition mode is active. The issue list is prepared from
              mapped requisition entries, and manual item addition is disabled.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
        <div className="text-sm font-semibold text-slate-700 mb-3">
          Requisition & Cart
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              requisitionMode === "offline"
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
            onClick={() => {
              setRequisitionMode("offline");
              setSelectedRequisitionId("");
              autoMappedReqIdRef.current = "";
            }}
          >
            Offline Requisition
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              requisitionMode === "online"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
            onClick={() => {
              setRequisitionMode("online");
              setRequisitionFile(null);
              autoMappedReqIdRef.current = "";
              setCategoryHeadId("");
              setCategoryGroupId("");
              setItemCategoryId("");
              setStocks([]);
              onStockChange?.("");
              setSelectedAssets([]);
              setQty("");
              setStockQty(null);
            }}
            disabled={!isEmployeeCustodian}
          >
            Online Requisition
          </button>
        </div>

        {/* Add to list + requisition source */}
        <div className="flex flex-wrap items-start gap-4">
          {requisitionMode === "offline" && (
            <Button
              type="button"
              variant="secondary"
              onClick={addItemToCart}
              disabled={!enableItemSelection}
            >
              Add to Issue List
            </Button>
          )}

          {requisitionMode === "offline" ? (
            <div className="flex-1 min-w-[260px]">
              <label className="text-sm font-medium text-gray-700">
                Requisition Scan (Required)
              </label>
              <div className="relative mt-2">
                {requisitionFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setRequisitionFile(null);
                    }}
                    className="absolute top-2 right-2 bg-white border rounded-full p-1
              text-gray-400 hover:text-red-600 hover:border-red-300 shadow-sm
              transition"
                    title="Remove file"
                  >
                    ✕
                  </button>
                )}
                <label
                  htmlFor="requisitionFile"
                  className="group cursor-pointer border-2 border-dashed border-gray-300 
                 rounded-xl p-5 flex flex-col items-center justify-center
                 hover:border-blue-500 hover:bg-blue-50 transition"
                >
                  <svg
                    className="w-9 h-9 text-gray-400 group-hover:text-blue-500 mb-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
                    <path d="M12 12v9" />
                    <path d="M8 12l4-4 4 4" />
                  </svg>

                  <p className="text-sm font-medium text-gray-700">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG, PDF (max 5MB)
                  </p>

                  {requisitionFile && (
                    <span className="mt-2 text-xs text-green-600">
                      ✔ {requisitionFile.name}
                    </span>
                  )}
                  <input
                    id="requisitionFile"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      setRequisitionFile(e.target.files?.[0] || null)
                    }
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-[280px] rounded-lg border bg-white p-3">
              <div className="text-sm font-medium text-slate-700 mb-2">
                Select Approved Digital Requisition
              </div>
              <Select
                value={String(selectedRequisitionId || "")}
                onValueChange={setSelectedRequisitionId}
                disabled={!activeEmployeeId || onlineReqLoading}
              >
                <SelectTrigger className="h-10">
                  <SelectValue
                    placeholder={
                      activeEmployeeId
                        ? "Select requisition"
                        : "Select an employee issue target first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {onlineRequisitions.map((req) => (
                    <SelectItem key={req.id} value={String(req.id)}>
                      {req.req_no} - {req.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-2"
                  onClick={() =>
                    fetchOnlineRequisitions({ cursor: null, append: false })
                  }
                  disabled={!activeEmployeeId || onlineReqLoading}
                >
                  Refresh
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-2"
                  onClick={() =>
                    fetchOnlineRequisitions({
                      cursor: onlineReqCursor,
                      append: true,
                    })
                  }
                  disabled={!onlineReqHasMore || onlineReqLoading}
                >
                  Load More
                </Button>
              </div>
              {selectedOnlineRequisition && (
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                  Pending line items available for issue:{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedOnlineRequisition.items?.length || 0}
                  </span>
                  .
                </div>
              )}
              {selectedOnlineRequisition && hasOnlineUnmappedPending && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                  Some requisition entries are not mapped to category/stock.
                  Please complete item mapping before proceeding.
                </div>
              )}
              {!onlineReqLoading &&
                activeEmployeeId &&
                onlineRequisitions.length === 0 && (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                    No approved digital requisitions are available for the
                    selected employee.
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Cart preview */}
        {(cartItems.length > 0 || cartSerialized.length > 0) && (
          <div className="rounded-md border p-3 space-y-2 mt-4 bg-white">
            <div className="text-sm font-medium">Issue List</div>

            {cartItems.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Non-serialized</div>
                {cartItems.map((it, idx) => (
                  <div
                    key={`ns-${idx}`}
                    className="flex items-center justify-between py-1"
                  >
                    <div>
                      {it.stockLabel} — Qty: <b>{it.quantity}</b>{" "}
                      {it.sku_unit || DEFAULT_SKU_UNIT}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => removeCartItem(idx)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {cartSerialized.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Serialized</div>
                {cartSerialized.map((s, idx) => (
                  <div
                    key={`sz-${idx}`}
                    className="flex items-center justify-between py-1"
                  >
                    <div>
                      {s.stockLabel} — Assets: <b>{s.assetIds.length}</b>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => removeCartSerialized(idx)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        type="button"
        onClick={submit}
        disabled={!enableItemSelection}
        className="h-10 w-32 self-start"
      >
        Issue
      </Button>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ open: false, type: "", message: "" })}
      />

      {/* QR Preview Modal */}
      <Modal isOpen={qrOpen} onClose={() => setQrOpen(false)} title="QR Code">
        <div className="flex flex-col items-center gap-3 p-2">
          {qrBusy ? (
            <div className="text-sm text-gray-600">Generating…</div>
          ) : (
            <>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR"
                  className="w-56 h-56 border rounded"
                />
              ) : null}
              <div className="text-xs text-gray-700">
                <div>
                  <b>Asset:</b> {qrAsset?.asset_tag || qrAsset?.id || "-"}
                </div>
                <div>
                  <b>Serial:</b> {qrAsset?.serial_number || "-"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={printQr} className="h-9">
                  Print
                </Button>
                <a
                  href={qrDataUrl}
                  download={`asset-${qrAsset?.id || "qr"}.png`}
                  className="h-9 inline-flex items-center px-4 border rounded"
                >
                  Download
                </a>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
