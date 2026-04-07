import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DayBook from "@/pages/DayBook";

import {
  Home,
  History,
  Star,
  Settings,
  BookOpen,
  Users,
  LogOut,
  User,
  Bell,
  CreditCard,
  Rocket,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Store,
  BookMarked,
  Notebook,
  UserRoundCog,
  PersonStanding,
  PencilOff,
  ShoppingBasket,
  PackageOpen,
  Eraser,
  Recycle,
  Package,
  Activity,
  Send,
  FolderOpenDot,
  CircleCheckBig,
  FileSpreadsheet,
  FileCheck2,
  FileText,
  DoorOpen,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion as Motion, AnimatePresence } from "framer-motion";
import IssueQtyForm from "./Forms/IssueQtyForm";
import AccountProfilePopover from "@/components/profile/AccountProfilePopover";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState([]);
  const [expanded, setExpanded] = useState({
    "Day Book Entry": false,
    Requisitions: false,
    MRN: false,
    Vendor: false,
    "Master Entry": false,
    Administration: false,
    "Gate Pass": false,
    Stocks: false,
    Reports: false,
    Issue: false,
    "Dispose Off": false,
  });

  const [userName, setUserName] = useState("Login Name");
  useEffect(() => {
    const storedUser = localStorage.getItem("fullname");
    console.log(storedUser);
    if (storedUser) {
      setUserName(storedUser);
    }
  }, []);

  useEffect(() => {
    const normalize = (value) =>
      String(value || "")
        .trim()
        .toUpperCase();

    const parseRoleList = () => {
      const rawRoles = localStorage.getItem("roles");
      let parsedRoles = [];

      if (rawRoles) {
        try {
          const data = JSON.parse(rawRoles);
          if (Array.isArray(data)) {
            parsedRoles = data;
          } else if (typeof data === "string") {
            parsedRoles = [data];
          }
        } catch {
          parsedRoles = [rawRoles];
        }
      }

      if (!parsedRoles.length) {
        try {
          const me = JSON.parse(localStorage.getItem("me") || "null");
          if (Array.isArray(me?.roles)) {
            parsedRoles = me.roles;
          } else if (typeof me?.roles === "string") {
            parsedRoles = [me.roles];
          }
        } catch {
          parsedRoles = [];
        }
      }

      return [...new Set(parsedRoles.map(normalize).filter(Boolean))];
    };

    setRoles(parseRoleList());
  }, []);

  const hasRole = (role) => roles.includes(String(role || "").toUpperCase());
  const hasAnyRole = (allowedRoles = []) =>
    allowedRoles.some((role) => hasRole(role));
  const hasSubItemAccessStrict = (allowedRoles = []) =>
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    hasAnyRole(allowedRoles);

  const subItemRoleRules = {
    requisitionsMy: [
      "USER",
      "EMPLOYEE",
      "DIVISION_HEAD",
      "DIVISIONAL_HEAD",
      // "SUPER_ADMIN",
      // "STORE_ENTRY",
      // "CLERK_APPROVER",
      // "ADMIN_APPROVER",
      // "INSPECTION_OFFICER",
      // "PROC_APPROVER",
      // "ACCTS_APPROVER",
    ],
    requisitionsInbox: [
      "USER",
      "EMPLOYEE",
      "ADMIN_HEAD",
      "SUPER_ADMIN",
      "STORE_ENTRY",
      "DIVISION_HEAD",
      "DIVISIONAL_HEAD",
      "CLERK_APPROVER",
      "ADMIN_APPROVER",
      "INSPECTION_OFFICER",
      "PROC_APPROVER",
      "ACCTS_APPROVER",
    ],
    requisitionsStoreQueue: [
      "USER",
      "EMPLOYEE",
      "DIVISION_HEAD",
      "DIVISIONAL_HEAD",
      "ADMIN_APPROVER",
      "ADMIN_HEAD",
      "SUPER_ADMIN",
      "STORE_ENTRY",
    ],
    mrnList: ["STORE_ENTRY"],
    mrnVerify: ["SUPER_ADMIN", "STORE_ENTRY"],
    issueItems: ["STORE_ENTRY"],
    issuedItems: ["STORE_ENTRY"],
    issuedStatement: ["STORE_ENTRY"],
    gatePasses: ["STORE_ENTRY"],
    gatePassVerify: ["SUPER_ADMIN", "STORE_ENTRY"],
    viewStocks: ["ADMIN_APPROVER", "STORE_ENTRY"],
    manageAsset: ["STORE_ENTRY"],
    assetEvents: ["STORE_ENTRY"],
    issuesReports: ["STORE_ENTRY"],
    outOfStock: ["STORE_ENTRY"],
    noc: ["SUPER_ADMIN", "STORE_ENTRY"],
    vendor: ["SUPER_ADMIN", "STORE_ENTRY"],
    employee: ["SUPER_ADMIN", "STORE_ENTRY"],
    custodians: ["SUPER_ADMIN", "STORE_ENTRY"],
    itemCategory: ["SUPER_ADMIN", "STORE_ENTRY"],
    accessControl: ["SUPER_ADMIN"],
    disposeOff: ["SUPER_ADMIN", "STORE_ENTRY"],
    eWaste: ["SUPER_ADMIN", "STORE_ENTRY"],
  };

  const canAccessMasterEntry = hasAnyRole(["SUPER_ADMIN", "STORE_ENTRY"]);
  const canAccessDayBook = hasAnyRole([
    "SUPER_ADMIN",
    "STORE_ENTRY",
    "CLERK_APPROVER",
    "ADMIN_APPROVER",
    "INSPECTION_OFFICER",
    "PROC_APPROVER",
    "ACCTS_APPROVER",
  ]);
  const canAccessMrn = canAccessDayBook;
  const canAccessRequisition = hasAnyRole([
    "USER",
    "EMPLOYEE",
    "ADMIN_HEAD",
    "SUPER_ADMIN",
    "STORE_ENTRY",
    "DIVISION_HEAD",
    "DIVISIONAL_HEAD",
    "CLERK_APPROVER",
    "ADMIN_APPROVER",
    "INSPECTION_OFFICER",
    "PROC_APPROVER",
    "ACCTS_APPROVER",
  ]);
  const canAccessIssue = hasAnyRole(["SUPER_ADMIN", "STORE_ENTRY"]);
  const canAccessGatePass = hasAnyRole(["SUPER_ADMIN", "STORE_ENTRY"]);
  const canAccessInventory = hasAnyRole([
    "SUPER_ADMIN",
    "STORE_ENTRY",
    "PROC_APPROVER",
    "ACCTS_APPROVER",
    "ADMIN_APPROVER",
  ]);
  const canAccessReports = canAccessInventory;
  const canAccessDisposeOff = hasAnyRole(["SUPER_ADMIN", "STORE_ENTRY"]);

  const canSeeMrnList = hasSubItemAccessStrict(subItemRoleRules.mrnList);
  const canSeeMrnVerify = hasSubItemAccessStrict(subItemRoleRules.mrnVerify);
  const showMrnNav = canAccessMrn && (canSeeMrnList || canSeeMrnVerify);

  const canSeeRequisitionMy = hasSubItemAccessStrict(
    subItemRoleRules.requisitionsMy,
  );
  const canSeeRequisitionInbox = hasSubItemAccessStrict(
    subItemRoleRules.requisitionsInbox,
  );
  const canSeeRequisitionStoreQueue = hasSubItemAccessStrict(
    subItemRoleRules.requisitionsStoreQueue,
  );
  const showRequisitionNav =
    canAccessRequisition &&
    (canSeeRequisitionMy ||
      canSeeRequisitionInbox ||
      canSeeRequisitionStoreQueue);

  const canSeeIssueItems = hasSubItemAccessStrict(subItemRoleRules.issueItems);
  const canSeeIssuedItems = hasSubItemAccessStrict(
    subItemRoleRules.issuedItems,
  );
  const canSeeIssuedStatement = hasSubItemAccessStrict(
    subItemRoleRules.issuedStatement,
  );
  const showIssueNav =
    canAccessIssue &&
    (canSeeIssueItems || canSeeIssuedItems || canSeeIssuedStatement);

  const canSeeGatePasses = hasSubItemAccessStrict(subItemRoleRules.gatePasses);
  const canSeeGatePassVerify = hasSubItemAccessStrict(
    subItemRoleRules.gatePassVerify,
  );
  const showGatePassNav =
    canAccessGatePass && (canSeeGatePasses || canSeeGatePassVerify);

  const canSeeViewStocks = hasSubItemAccessStrict(subItemRoleRules.viewStocks);
  const canSeeManageAsset = hasSubItemAccessStrict(
    subItemRoleRules.manageAsset,
  );
  const canSeeAssetEvents = hasSubItemAccessStrict(
    subItemRoleRules.assetEvents,
  );
  const showStocksNav =
    canAccessInventory &&
    (canSeeViewStocks || canSeeManageAsset || canSeeAssetEvents);

  const canSeeIssuesReports = hasSubItemAccessStrict(
    subItemRoleRules.issuesReports,
  );
  const canSeeOutOfStock = hasSubItemAccessStrict(subItemRoleRules.outOfStock);
  const canSeeNoc = hasSubItemAccessStrict(subItemRoleRules.noc);
  const showReportsNav =
    canAccessReports && (canSeeIssuesReports || canSeeOutOfStock || canSeeNoc);

  const canSeeVendor = hasSubItemAccessStrict(subItemRoleRules.vendor);
  const canSeeEmployee = hasSubItemAccessStrict(subItemRoleRules.employee);
  const canSeeCustodians = hasSubItemAccessStrict(subItemRoleRules.custodians);
  const canSeeItemCategory = hasSubItemAccessStrict(
    subItemRoleRules.itemCategory,
  );
  const showMasterEntryNav =
    canAccessMasterEntry &&
    (canSeeVendor || canSeeEmployee || canSeeCustodians || canSeeItemCategory);
  const canSeeAccessControl = hasSubItemAccessStrict(
    subItemRoleRules.accessControl,
  );
  const showAdministrationNav = canSeeAccessControl;

  const canSeeDisposeOff = hasSubItemAccessStrict(subItemRoleRules.disposeOff);
  const canSeeEWaste = hasSubItemAccessStrict(subItemRoleRules.eWaste);
  const showDisposeOffNav =
    canAccessDisposeOff && (canSeeDisposeOff || canSeeEWaste);

  const getInitials = (userName) => {
    if (!userName) return "";

    const words = userName.trim().split(" ").filter(Boolean);
    if (words.length === 1) {
      return words[0][0].toUpperCase();
    }

    const first = words[0][0].toUpperCase();
    const last = words[words.length - 1][0].toUpperCase();

    return first + last;
  };

  const initials = getInitials(userName);

  const openOnlySection = (section) => {
    setExpanded((prev) =>
      Object.keys(prev).reduce((acc, key) => {
        acc[key] = key === section;
        return acc;
      }, {}),
    );
  };

  const toggleSection = (section) => {
    setExpanded((prev) => {
      if (prev[section]) {
        return { ...prev, [section]: false };
      }
      return Object.keys(prev).reduce((acc, key) => {
        acc[key] = key === section;
        return acc;
      }, {});
    });
  };

  const handleNavigate = (path) => {
    navigate(path);
  };

  const sectionForPath = (pathname) => {
    const path = String(pathname || "").toLowerCase();

    if (path.startsWith("/requisitions")) {
      return "Requisitions";
    }
    if (
      path.startsWith("/issue") ||
      path.startsWith("/issued-items") ||
      path.startsWith("/reports/employee-issues") ||
      path.startsWith("/reports/custodian-issues")
    ) {
      return "Issue";
    }
    if (path.startsWith("/gate-pass")) {
      return "Gate Pass";
    }
    if (
      path.startsWith("/stocks") ||
      path.startsWith("/stock-items-all") ||
      path.startsWith("/asset-categories") ||
      path.startsWith("/assets-by-category") ||
      path.startsWith("/assets/instore") ||
      path.startsWith("/asset-events") ||
      path.startsWith("/asset/")
    ) {
      return "Stocks";
    }
    if (
      path.startsWith("/vendors") ||
      path.startsWith("/employees") ||
      path.startsWith("/custodians") ||
      path.startsWith("/itemcategory")
    ) {
      return "Master Entry";
    }
    if (path.startsWith("/access-control")) {
      return "Administration";
    }
    if (path.startsWith("/daybook")) return "Day Book Entry";
    if (path.startsWith("/mrn")) return "MRN";
    if (path.startsWith("/e-waste") || path.startsWith("/dispose-list")) {
      return "Dispose Off";
    }
    if (path.startsWith("/reports")) return "Reports";
    return null;
  };

  const handleSectionNavigate = (section, path) => {
    openOnlySection(section);
    navigate(path);
  };

  useEffect(() => {
    const section = sectionForPath(location.pathname);
    setExpanded((prev) =>
      Object.keys(prev).reduce((acc, key) => {
        acc[key] = section ? key === section : false;
        return acc;
      }, {}),
    );
  }, [location.pathname]);

  const NavItem = ({ icon, label, children, collapsible, onClick }) => {
    const Icon = icon;
    return (
      <div className="overflow-hidden print:hidden">
        <Motion.div
          whileHover={{ x: 1 }}
          whileTap={{ scale: 0.99 }}
          className={`group relative flex items-center justify-between px-2.5 py-2 text-xs sm:text-[13px] rounded-xl cursor-pointer transition-all print:hidden ${
            expanded[label]
              ? "bg-white/80 text-slate-900 ring-1 ring-slate-200/70 shadow-[0_6px_14px_rgba(15,23,42,0.08)]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
          }`}
          onClick={() => {
            if (onClick) return onClick(); // handle redirect
            if (collapsible) toggleSection(label); // handle expand/collapse
          }}
        >
          <div className="flex items-center gap-2.5 print:hidden">
            <span className="grid place-items-center h-7 w-7 rounded-lg bg-gradient-to-br from-sky-50 via-white to-indigo-50 ring-1 ring-slate-200/70">
              <Motion.div
                className="h-3.5 w-3.5 print:hidden"
                animate={{
                  rotate: expanded[label] ? 90 : 0,
                  transition: { duration: 0.3 },
                }}
              >
                <Icon className="h-3.5 w-3.5 print:hidden" />
              </Motion.div>
            </span>
            <span className="font-medium tracking-wide">{label}</span>
          </div>
          {collapsible &&
            (expanded[label] ? (
              <ChevronUp className="h-4 w-4 opacity-80 print:hidden" />
            ) : (
              <ChevronRight className="h-4 w-4 opacity-60 print:hidden" />
            ))}
        </Motion.div>

        <AnimatePresence initial={false}>
          {collapsible && (
            <Motion.div
              className="ml-9 mt-0.5 overflow-hidden"
              initial="collapsed"
              animate={expanded[label] ? "open" : "collapsed"}
              exit="collapsed"
              variants={{
                open: {
                  opacity: 1,
                  height: "auto",
                  transition: { staggerChildren: 0.1 },
                },
                collapsed: { opacity: 0, height: 0 },
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
            >
              <div className="space-y-1">{children}</div>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const SubItem = ({ icon, label, onClick }) => {
    const Icon = icon;
    return (
      <Motion.div
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-white/70 hover:text-slate-900 cursor-pointer print:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClick}
      >
        <Icon className="h-3.5 w-3.5 print:hidden opacity-80" />
        <span>{label}</span>
      </Motion.div>
    );
  };

  const GroupCard = ({ title, children }) => (
    <div className="relative rounded-2xl bg-white/70 backdrop-blur-md ring-1 ring-slate-200/70 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25),transparent_60%),radial-gradient(circle_at_bottom,_rgba(203,213,225,0.35),transparent_55%)]" />
      <div className="relative px-2.5 py-2.5">
        <div className="px-2.5 pb-1.5 text-[10px] uppercase tracking-[0.24em] text-slate-500">
          {title}
        </div>
        <div className="space-y-1">{children}</div>
      </div>
    </div>
  );

  const renderSidebarContent = () => (
    <div className="space-y-3 px-2.5 pb-4 pt-1 sm:px-3 print:hidden">
      {(canAccessDayBook ||
        canAccessRequisition ||
        canAccessMrn ||
        canAccessIssue ||
        canAccessGatePass) && (
        <GroupCard title="Operations">
          {canAccessDayBook && (
            <NavItem
              icon={BookMarked}
              onClick={() =>
                handleSectionNavigate("Day Book Entry", "/daybook")
              }
              label="Day Book Entry"
              collapsible
            />
          )}
          {showMrnNav && (
            <NavItem icon={Notebook} label="MRN" collapsible>
              {canSeeMrnList && (
                <SubItem
                  icon={FileText}
                  label="MRN List"
                  onClick={() => handleNavigate("/mrn")}
                />
              )}
              {canSeeMrnVerify && (
                <SubItem
                  icon={CircleCheckBig}
                  label="MRN Verify"
                  onClick={() => handleNavigate("/mrn/verify")}
                />
              )}
            </NavItem>
          )}
          {showRequisitionNav && (
            <NavItem icon={FileText} label="Requisitions" collapsible>
              {canSeeRequisitionMy && (
                <SubItem
                  icon={FileText}
                  label="My Requisitions"
                  onClick={() => handleNavigate("/requisitions")}
                />
              )}
              {canSeeRequisitionInbox && (
                <SubItem
                  icon={CircleCheckBig}
                  label="Requisition History"
                  onClick={() => handleNavigate("/requisitions/inbox")}
                />
              )}
              {canSeeRequisitionStoreQueue && (
                <SubItem
                  icon={FolderOpenDot}
                  label="Requisition Queue"
                  onClick={() => handleNavigate("/requisitions/store-queue")}
                />
              )}
            </NavItem>
          )}
          {showIssueNav && (
            <NavItem icon={Send} label="Issue" collapsible>
              {canSeeIssueItems && (
                <SubItem
                  icon={FolderOpenDot}
                  label="Issue Items"
                  onClick={() => handleNavigate("/issue")}
                />
              )}
              {canSeeIssuedItems && (
                <SubItem
                  icon={CircleCheckBig}
                  label="Issued Items"
                  onClick={() => handleNavigate("/issued-items")}
                />
              )}
              {canSeeIssuedStatement && (
                <SubItem
                  icon={FileText}
                  label="Issued Statement"
                  onClick={() => handleNavigate("/reports/custodian-issues")}
                />
              )}
            </NavItem>
          )}
          {showGatePassNav && (
            <NavItem icon={DoorOpen} label="Gate Pass" collapsible>
              {canSeeGatePasses && (
                <SubItem
                  icon={FileText}
                  label="Gate Passes"
                  onClick={() => handleNavigate("/gate-passes")}
                />
              )}
              {canSeeGatePassVerify && (
                <SubItem
                  icon={CircleCheckBig}
                  label="Gate Pass Verify"
                  onClick={() => handleNavigate("/gate-pass/verify")}
                />
              )}
            </NavItem>
          )}
        </GroupCard>
      )}

      {(canAccessInventory || canAccessReports) && (
        <GroupCard title="Inventory">
          {showStocksNav && (
            <NavItem icon={PackageOpen} label="Stocks" collapsible>
              {canSeeViewStocks && (
                <SubItem
                  icon={ShoppingBasket}
                  label="View Stocks"
                  onClick={() => handleNavigate("/stocks")}
                />
              )}
              {canSeeManageAsset && (
                <SubItem
                  icon={Package}
                  label="Manage Asset"
                  onClick={() => handleNavigate("/asset-categories")}
                />
              )}
              {canSeeAssetEvents && (
                <SubItem
                  icon={Activity}
                  label="Asset Events"
                  onClick={() => handleNavigate("/asset-events")}
                />
              )}
            </NavItem>
          )}
          {showReportsNav && (
            <NavItem icon={FileSpreadsheet} label="Reports" collapsible>
              {canSeeIssuesReports && (
                <SubItem
                  icon={FileCheck2}
                  label="Issues Reports"
                  onClick={() => handleNavigate("/reports/custodian-issues")}
                />
              )}
              {canSeeOutOfStock && (
                <SubItem
                  icon={Package}
                  label="Out of Stock"
                  onClick={() => handleNavigate("/reports/out-of-stock")}
                />
              )}
              {canSeeNoc && (
                <SubItem
                  icon={FileText}
                  label="NOC"
                  onClick={() => handleNavigate("/reports/noc")}
                />
              )}
            </NavItem>
          )}
        </GroupCard>
      )}

      {(canAccessMasterEntry || canAccessDisposeOff) && (
        <GroupCard title="Admin">
          {showMasterEntryNav && (
            <NavItem icon={UserRoundCog} label="Master Entry" collapsible>
              {canSeeVendor && (
                <SubItem
                  icon={Store}
                  label="Vendor"
                  onClick={() => handleNavigate("/vendors")}
                />
              )}
              {canSeeEmployee && (
                <SubItem
                  icon={PersonStanding}
                  label="Employee"
                  onClick={() => handleNavigate("/employees")}
                />
              )}
              {canSeeCustodians && (
                <SubItem
                  icon={Users}
                  label="Custodians"
                  onClick={() => handleNavigate("/custodians")}
                />
              )}
              {canSeeItemCategory && (
                <SubItem
                  icon={ShoppingBasket}
                  label="Item Category"
                  onClick={() => handleNavigate("/itemCategory")}
                />
              )}
            </NavItem>
          )}
          {showAdministrationNav && (
            <NavItem icon={Settings} label="Administration" collapsible>
              {canSeeAccessControl && (
                <SubItem
                  icon={UserRoundCog}
                  label="Access Control"
                  onClick={() => handleNavigate("/access-control")}
                />
              )}
            </NavItem>
          )}
          {showDisposeOffNav && (
            <NavItem icon={PencilOff} label="Dispose Off" collapsible>
              {canSeeDisposeOff && (
                <SubItem
                  icon={Eraser}
                  label="Dispose Off"
                  onClick={() => handleNavigate("/dispose-list")}
                />
              )}
              {canSeeEWaste && (
                <SubItem
                  icon={Recycle}
                  label="E-Waste"
                  onClick={() => handleNavigate("/e-waste")}
                />
              )}
            </NavItem>
          )}
        </GroupCard>
      )}
      {!canAccessDayBook &&
        !canAccessRequisition &&
        !canAccessMrn &&
        !canAccessIssue &&
        !canAccessGatePass &&
        !canAccessInventory &&
        !canAccessReports &&
        !canAccessMasterEntry &&
        !canAccessDisposeOff && (
          <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-3 text-xs text-slate-600">
            No sidebar options are available for your role.
          </div>
        )}
    </div>
  );

  return (
    <div className="h-full min-h-0 overflow-hidden print:hidden">
      <div className="hidden h-full min-h-0 flex-col overflow-hidden print:hidden md:flex">
        <div className="px-3 pt-3 pb-2.5 lg:px-4 lg:pt-4 print:hidden">
          <AccountProfilePopover
            fallbackName={userName}
            fallbackInitials={initials}
            onAction={null}
          >
            <div className="cursor-pointer rounded-xl bg-white/70 px-2.5 py-2 backdrop-blur-md ring-1 ring-slate-200/70 shadow-[0_10px_20px_rgba(15,23,42,0.08)] transition hover:bg-white/85 hover:shadow-[0_16px_26px_rgba(15,23,42,0.12)]">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 print:hidden">
                  <AvatarFallback className="bg-slate-900 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900 print:hidden">
                    {userName}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    Open account hub
                  </p>
                </div>
              </div>
            </div>
          </AccountProfilePopover>
        </div>
        <ScrollArea className="h-full min-h-0 flex-1 print:hidden [&_[data-slot=scroll-area-scrollbar]]:hidden">
          {renderSidebarContent()}
        </ScrollArea>
        {/* Ensure the user info section is pinned to the bottom */}
        {/* <div className="mt-auto border-t">
          <UserSidebarTrigger />
        </div> */}
      </div>

      <div className="md:hidden px-1.5 pb-1.5 print:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="h-9 w-9 border border-slate-200/70 bg-white/80"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[85vw] max-w-[22rem] p-0 bg-white/90 backdrop-blur-xl shadow-[inset_-1px_0_0_rgba(15,23,42,0.06)] print:hidden"
          >
            <div className="h-full flex flex-col print:hidden">
              <div className="px-3 pt-4 pb-3">
                <AccountProfilePopover
                  fallbackName={userName}
                  fallbackInitials={initials}
                  onAction={() => setOpen(false)}
                >
                  <div className="cursor-pointer rounded-xl bg-white/70 px-2.5 py-2 backdrop-blur-md ring-1 ring-slate-200/70 transition hover:bg-white/85">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 print:hidden">
                        <AvatarFallback className="bg-slate-900 text-white">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-slate-900 print:hidden">
                          {userName}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          Open account hub
                        </p>
                      </div>
                    </div>
                  </div>
                </AccountProfilePopover>
              </div>
              <ScrollArea className="flex-1 [&_[data-slot=scroll-area-scrollbar]]:hidden">
                {renderSidebarContent()}
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
