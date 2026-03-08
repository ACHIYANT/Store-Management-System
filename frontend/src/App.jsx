import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import PageNotFound from "./pages/PageNotFound";
import Homepage from "./pages/Homepage";
import VendorsForm from "./components/Forms/VendorsForm";
import ItemCategoryAddForm from "./components/Forms/ItemCategoryAddForm";
import DayBookFormFirstStepUpdate from "./components/Forms/DayBookFormFirstStepUpdate";
import DayBookFormUpdate from "./components/Forms/DayBookFormUpdate";
import DayBookItemsFormUpdate from "./components/Forms/DayBookItemsFormUpdate";
import EmployeesForm from "./components/Forms/EmployeesForm";
import DayBookFormFirstStep from "./components/Forms/DayBookFormFirstStep";
import DayBook from "./pages/DayBook";
import Layout from "./components/Layout";
import Vendor from "./pages/Vendor";
import ItemCategory from "./pages/ItemCategory";
import Employee from "./pages/Employee";
import EmployeeUpdateForm from "./components/Forms/EmployeeUpdateForm";
import VendorUpdateForm from "./components/Forms/VendorUpdateForm";
import DayBookItemsForm from "./components/Forms/DayBookItemsForm";
import DayBookItems from "./pages/DayBookItems";
import Mrn from "./pages/Mrn";
import MrnPage from "./pages/MrnPage";
import MrnVerify from "./pages/MrnVerify";
import ItemCategoryUpdateForm from "./components/Forms/ItemCategoryUpdateForm";
import Stocks from "./pages/Stocks";
import StockItems from "./pages/StockItems";
import Issue from "./pages/Issue";
import Assets from "./pages/Assets";
import AssetEvents from "./pages/AssetEvents";
import AssetTimeline from "./pages/AssetTimeline";
import GatePasses from "./pages/GatePasses";
import GatePassPage from "./pages/GatePassPage";
import GatePassVerify from "./pages/GatePassVerify";
import IssuedItems from "./pages/IssuedItems";
import ProtectedRoute from "./auth/ProtectedRoute";
import ApprovalInbox from "./pages/ApprovalInbox";
import EmployeeIssues from "./pages/EmployeeIssues";
import EmployeeIssuedItems from "./pages/EmployeeIssuedItems";
import EmployeeIssuedStatement from "./pages/EmployeeIssuedStatement";
import Noc from "./pages/Noc";
import NocPage from "./pages/NocPage";
import AssetCategories from "./pages/AssetCategories";
import AssetsInStore from "./pages/AssetInstore"; // adjust path if needed
import OutOfStockReport from "./pages/OutOfStockReport";
import EWasteItems from "./pages/EWasteItems";
import DisposeList from "./pages/DisposeList";
import NetworkOfflineOverlay from "./components/NetworkOfflineOverlay";
import Requisitions from "./pages/Requisitions";
import RequisitionInbox from "./pages/RequisitionInbox";
import RequisitionStoreQueue from "./pages/RequisitionStoreQueue";
import RequisitionDetail from "./pages/RequisitionDetail";

function App() {
  const user = JSON.parse(localStorage.getItem("me") || "null"); // {roles: [...]}
  return (
    <BrowserRouter>
      <NetworkOfflineOverlay />
      <Routes>
        {/* Public Routes - no sidebar */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/sign-up" element={<Signup />} />
        <Route path="/reset-pwd" element={<ResetPassword />} />

        {/* Protected Routes - with sidebar */}
        <Route path="/" element={<Layout />}>
          <Route
            path="/approvals"
            element={
              <ProtectedRoute
                user={user}
                anyOf={[
                  "ADMIN_APPROVER",
                  "INSPECTION_OFFICER",
                  "PROC_APPROVER",
                  "ACCTS_APPROVER",
                ]}
              >
                <ApprovalInbox />
              </ProtectedRoute>
            }
          />
          <Route path="homepage" element={<Homepage />} />
          <Route path="day-book-entry" element={<DayBookFormFirstStep />} />
          <Route path="daybook" element={<DayBook />} />
          <Route path="/daybook-items/" element={<DayBookItemsForm />} />
          <Route path="/daybook-items-all/:id" element={<DayBookItems />} />
          <Route path="vendors" element={<Vendor />} />
          <Route path="itemCategory" element={<ItemCategory />} />
          <Route path="employees" element={<Employee />} />
          {/* Entry Forms */}
          <Route path="employees-entry" element={<EmployeesForm />} />
          <Route path="vendors-entry" element={<VendorsForm />} />
          <Route path="itemCategory-entry" element={<ItemCategoryAddForm />} />
          {/* Updated Form */}
          <Route path="/employee-update" element={<EmployeeUpdateForm />} />
          <Route path="/vendor-update" element={<VendorUpdateForm />} />
          <Route
            path="/itemCategory-update"
            element={<ItemCategoryUpdateForm />}
          />
          {/* <Route path="/daybook-update" element={<DayBookUpdateFrom />} /> */}
          <Route
            path="/daybook/edit/:id"
            element={<DayBookFormFirstStepUpdate />}
          />
          <Route path="/daybook-update-form" element={<DayBookFormUpdate />} />
          <Route
            path="/daybook-update-items"
            element={<DayBookItemsFormUpdate />}
          />
          <Route path="/mrn" element={<Mrn />} />
          <Route path="/mrn/verify" element={<MrnVerify />} />
          <Route path="/stocks" element={<Stocks />}></Route>
          <Route path="/mrn-page/:daybookId" element={<MrnPage />} />
          <Route path="/stock-items-all/:id" element={<StockItems />} />
          <Route path="/issue" element={<Issue />} />
          <Route path="/requisitions" element={<Requisitions />} />
          <Route path="/requisitions/inbox" element={<RequisitionInbox />} />
          <Route
            path="/requisitions/store-queue"
            element={<RequisitionStoreQueue />}
          />
          <Route path="/requisitions/:id" element={<RequisitionDetail />} />
          <Route path="/asset-categories" element={<AssetCategories />} />
          <Route path="/assets-by-category/:categoryId" element={<Assets />} />
          <Route path="/assets/instore/:stockId" element={<AssetsInStore />} />
          <Route path="/asset-events" element={<AssetEvents />} />
          <Route path="/asset/:assetId/timeline" element={<AssetTimeline />} />
          <Route path="/gate-passes" element={<GatePasses />} />
          <Route path="/gate-pass/verify" element={<GatePassVerify />} />
          <Route path="/gate-pass/:gatePassId" element={<GatePassPage />} />
          <Route path="/issued-items" element={<IssuedItems />} />
          <Route path="/reports/employee-issues" element={<EmployeeIssues />} />

          <Route
            path="/reports/employee-issues/:id"
            element={<EmployeeIssuedItems />}
          />
          <Route
            path="/reports/employee-issues/:id/statement"
            element={<EmployeeIssuedStatement />}
          />
          <Route path="/reports/noc" element={<Noc />} />
          <Route path="/reports/noc/:id" element={<NocPage />} />
          <Route
            path="/reports/out-of-stock"
            element={<OutOfStockReport />}
          />
          <Route path="/dispose-list" element={<DisposeList />} />
          <Route path="/e-waste" element={<EWasteItems />} />
          <Route path="*" element={<PageNotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
