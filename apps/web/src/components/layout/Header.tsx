import { useNavigate } from "react-router-dom";
import { APP_NAME } from "@healthy-eating-ai/shared";
import { useAuth } from "../../auth/AuthContext";
import "./Header.css";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="app-header">
      <span className="app-header__brand">{APP_NAME}</span>
      <div className="app-header__profile">
        {user && <span className="app-header__email">{user.email}</span>}
        <button type="button" className="app-header__logout" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
