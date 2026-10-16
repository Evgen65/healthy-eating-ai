import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

interface NavigationLinkProps {
  to: string;
  children: ReactNode;
}

export function NavigationLink({ to, children }: NavigationLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive ? "nav-link nav-link--active" : "nav-link"
      }
    >
      {children}
    </NavLink>
  );
}
