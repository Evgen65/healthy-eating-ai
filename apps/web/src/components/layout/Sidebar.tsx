import { NavigationLink } from "./NavigationLink";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/meals", label: "Meals" },
  { to: "/history", label: "History" },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/plan", label: "Plan" },
  { to: "/shopping", label: "Shopping" },
  { to: "/profile", label: "Profile" },
];

export function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Main navigation">
      <ul className="sidebar__list">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavigationLink to={item.to}>{item.label}</NavigationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
