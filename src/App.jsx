import React, { useState } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { Wrench, LayoutDashboard, CalendarDays, LogIn, LogOut, ClipboardList, FileText, Users, Settings, CreditCard, LifeBuoy, Building2, ChevronDown } from "lucide-react";
import { AuthProvider } from "./auth/AuthProvider.jsx";
import RequireAuth from "./auth/RequireAuth.jsx";
import Login from "./auth/Login.jsx";
import SignUp from "./auth/SignUp.jsx";
import Logout from "./auth/Logout.jsx";

// ---- UI helpers ---- //
const Container = ({ children }) => <div className="mx-auto w-full max-w-screen-2xl p-4">{children}</div>;

const Card = ({ children, title, subtitle }) => (
  <div className="rounded-2xl border bg-white p-6 shadow-sm">
    {title && <h1 className="text-xl font-semibold">{title}</h1>}
    {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </div>
);

const Placeholder = ({ title, subtitle }) => (
  <Card title={title} subtitle={subtitle}>
    <div className="rounded-xl border border-dashed p-6 text-sm text-zinc-500">
      Placeholder — connect this screen to Firestore/Functions later.
    </div>
  </Card>
);

// ---- Global Navbar (post-auth) ---- //
const TopNav = () => {
  const [adminOpen, setAdminOpen] = useState(false);
  const navigate = useNavigate();
  const navCls = ({ isActive }) =>
    `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`;

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          <span className="text-sm font-semibold">ASAPro</span>
        </button>

        <nav className="ml-auto hidden items-center gap-2 md:flex">
          <NavLink className={navCls} to="/dashboard"><LayoutDashboard className="h-4 w-4"/> <span>DASH</span></NavLink>
          <NavLink className={navCls} to="/calendar"><CalendarDays className="h-4 w-4"/> <span>CALENDAR</span></NavLink>
          <NavLink className={navCls} to="/check-in"><LogIn className="h-4 w-4"/> <span>CHECK-IN</span></NavLink>
          <NavLink className={navCls} to="/inspections"><ClipboardList className="h-4 w-4"/> <span>INSPECTIONS</span></NavLink>
          <NavLink className={navCls} to="/ro"><FileText className="h-4 w-4"/> <span>RO MANAGER</span></NavLink>
          <NavLink className={navCls} to="/customers"><Users className="h-4 w-4"/> <span>CUSTOMER DATABASE</span></NavLink>

          <div className="relative">
            <button onClick={() => setAdminOpen(v => !v)} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-100">
              <Settings className="h-4 w-4"/><span>ADMIN</span><ChevronDown className="h-4 w-4"/>
            </button>
            {adminOpen && (
              <div onMouseLeave={() => setAdminOpen(false)} className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border bg-white shadow-lg">
                <DropdownLink to="/admin/shop" label="SHOP INFO" icon={<Building2 className="h-4 w-4"/>} />
                <DropdownLink to="/admin/calendar" label="CALENDAR OPTIONS" icon={<CalendarDays className="h-4 w-4"/>} />
                <DropdownLink to="/admin/users" label="USERS" icon={<Users className="h-4 w-4"/>} />
                <DropdownLink to="/admin/payroll" label="PAYROLL" icon={<FileText className="h-4 w-4"/>} />
                <DropdownLink to="/admin/plan" label="PLAN OPTIONS" icon={<CreditCard className="h-4 w-4"/>} />
                <DropdownLink to="/admin/support" label="SUPPORT" icon={<LifeBuoy className="h-4 w-4"/>} />
              </div>
            )}
          </div>

          <NavLink className={navCls} to="/logout"><LogOut className="h-4 w-4"/> <span>LOG OUT</span></NavLink>
        </nav>
      </div>

      {/* Mobile quick bar */}
      <div className="grid grid-cols-4 gap-1 border-t bg-white px-2 py-2 md:hidden">
        <NavMini to="/dashboard" label="Dash" icon={<LayoutDashboard className="h-5 w-5"/>} />
        <NavMini to="/calendar" label="Calendar" icon={<CalendarDays className="h-5 w-5"/>} />
        <NavMini to="/check-in" label="Check-In" icon={<LogIn className="h-5 w-5"/>} />
        <NavMini to="/inspections" label="Inspect" icon={<ClipboardList className="h-5 w-5"/>} />
      </div>
    </header>
  );
};

const DropdownLink = ({ to, icon, label }) => (
  <NavLink to={to} className={({isActive}) => `flex items-center gap-2 px-3 py-2 text-sm ${isActive ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>
    {icon}<span>{label}</span>
  </NavLink>
);

const NavMini = ({ to, icon, label }) => (
  <NavLink to={to} className={({ isActive }) => `flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-xs ${isActive ? "bg-zinc-900 text-white" : "text-zinc-700 bg-zinc-100"}`}>
    {icon}<span>{label}</span>
  </NavLink>
);

// ---- Public screens ---- //
const Welcome = () => (
  <div className="bg-gradient-to-r from-zinc-50 to-zinc-100">
    <Container>
      <Card title="Welcome to ASAPro" subtitle="Run your independent shop like a dealership—at a fraction of the cost.">
        <div className="grid gap-3 md:grid-cols-3">
          <Card title="Create Account"><div className="text-sm text-zinc-600">Sign up your shop and start a free trial.</div></Card>
          <Card title="Subscribe"><div className="text-sm text-zinc-600">Pick a plan—cancel anytime.</div></Card>
          <Card title="Development Updates"><div className="text-sm text-zinc-600">Release notes & roadmap.</div></Card>
        </div>
        <div className="mt-4 flex gap-2">
          <a href="/signup" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">Get Started</a>
          <a href="/login" className="rounded-lg border px-4 py-2 text-sm">Log in</a>
        </div>
      </Card>
    </Container>
  </div>
);

const About = () => <Container><Placeholder title="About Us & Updates" subtitle="Roadmap, changelog, contact."/></Container>;

// ---- Protected screens ---- //
const Dashboard = () => <Container><Placeholder title="Account Dashboard" subtitle="KPIs: today’s appts, approvals, inspections in-progress."/></Container>;
const Calendar = () => <Container><Placeholder title="Calendar" subtitle="Day/Bay drag-and-drop appointments."/></Container>;
const CheckIn = () => <Container><Placeholder title="Check-In" subtitle="Customer/vehicle intake with VIN scan."/></Container>;
const Inspections = () => <Container><Placeholder title="Inspections" subtitle="Mobile-first inspections, photo capture."/></Container>;
const ROManager = () => <Container><Placeholder title="RO Manager" subtitle="Estimates, approvals, repair orders."/></Container>;
const Customers = () => <Container><Placeholder title="Customer Database" subtitle="CRM with vehicles & history."/></Container>;

// Admin submenu pages
const AdminShop = () => <Container><Placeholder title="Admin — Shop Info" subtitle="Branding, hours, bays, contact."/></Container>;
const AdminCalendar = () => <Container><Placeholder title="Admin — Calendar Options" subtitle="Working hours, bays, statuses."/></Container>;
const AdminUsers = () => <Container><Placeholder title="Admin — Users" subtitle="Create accounts, roles, access."/></Container>;
const AdminPayroll = () => <Container><Placeholder title="Admin — Payroll" subtitle="Time clock reports, adjustments, export."/></Container>;
const AdminPlan = () => <Container><Placeholder title="Admin — Plan Options" subtitle="Subscription, limits, invoices."/></Container>;
const AdminSupport = () => <Container><Placeholder title="Admin — Support" subtitle="Help center, contact, status."/></Container>;

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Welcome/>} />
        <Route path="/login" element={<Login/>} />
        <Route path="/signup" element={<SignUp/>} />
        <Route path="/about" element={<About/>} />

        {/* Authenticated */}
        <Route path="/dashboard" element={<RequireAuth><><TopNav/><Dashboard/></></RequireAuth>} />
        <Route path="/calendar" element={<RequireAuth><><TopNav/><Calendar/></></RequireAuth>} />
        <Route path="/check-in" element={<RequireAuth><><TopNav/><CheckIn/></></RequireAuth>} />
        <Route path="/inspections" element={<RequireAuth><><TopNav/><Inspections/></></RequireAuth>} />
        <Route path="/ro" element={<RequireAuth><><TopNav/><ROManager/></></RequireAuth>} />
        <Route path="/customers" element={<RequireAuth><><TopNav/><Customers/></></RequireAuth>} />

        {/* Admin submenu */}
        <Route path="/admin/shop" element={<RequireAuth><><TopNav/><AdminShop/></></RequireAuth>} />
        <Route path="/admin/calendar" element={<RequireAuth><><TopNav/><AdminCalendar/></></RequireAuth>} />
        <Route path="/admin/users" element={<RequireAuth><><TopNav/><AdminUsers/></></RequireAuth>} />
        <Route path="/admin/payroll" element={<RequireAuth><><TopNav/><AdminPayroll/></></RequireAuth>} />
        <Route path="/admin/plan" element={<RequireAuth><><TopNav/><AdminPlan/></></RequireAuth>} />
        <Route path="/admin/support" element={<RequireAuth><><TopNav/><AdminSupport/></></RequireAuth>} />

        {/* Logout */}
        <Route path="/logout" element={<RequireAuth><Logout/></RequireAuth>} />

        {/* Fallback */}
        <Route path="*" element={<Container><Placeholder title="Not Found" subtitle="Choose a destination from the navbar."/></Container>} />
      </Routes>
    </AuthProvider>
  );
}
