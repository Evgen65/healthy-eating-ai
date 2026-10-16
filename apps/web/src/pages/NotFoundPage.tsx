import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section>
      <h1>Page not found</h1>
      <p>
        <Link to="/dashboard">Back to Dashboard</Link>
      </p>
    </section>
  );
}
