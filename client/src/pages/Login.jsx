import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import riseoraLogoVerti from "../assets/riseora-Logo-Vertical.jpeg";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter username and password.");
      return;
    }

    try {
      setLoading(true);
      await login(username.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-ambient login-ambient-one" />
      <div className="login-ambient login-ambient-two" />

      <div className="login-shell">
        <section className="login-story" aria-hidden="true">
          <div className="login-story-badge">RISEORA BUSINESS SYSTEM</div>
          <h1>From raw material to finished product — one connected workflow.</h1>
          <p>
            Inventory, formulas, production costing, sales, returns, ledgers and
            reports in one lightweight local ERP.
          </p>
          <div className="login-story-points">
            <span>Inventory & costing</span>
            <span>Manufacturing control</span>
            <span>Sales & profitability</span>
          </div>
        </section>

        <section className="login-card">
          <div className="login-brand">
            <img src={riseoraLogoVerti} alt="Riseora" className="login-logo" />
          </div>

          <div className="login-heading">
            <h2>Welcome back</h2>
            <p>Sign in to your Riseora ERP workspace.</p>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">Username</label>
              <input
                id="username"
                type="text"
                className="form-control form-control-lg"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                id="password"
                type="password"
                className="form-control form-control-lg"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-100" disabled={loading}>
              {loading ? (
                <span className="d-inline-flex align-items-center gap-2">
                  <span className="riseora-spinner" /> Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="login-footnote">Secure local access • Riseora ERP</div>
        </section>
      </div>
    </div>
  );
}

export default Login;
