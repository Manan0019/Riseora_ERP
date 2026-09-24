import {
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

import api from "../api/api";

import riseoraLogoVerti from "../assets/riseora-Logo-Vertical.png";

import "./LoginProduction.css";

const MODE = {
  SIGN_IN: "SIGN_IN",
  REQUEST_OTP: "REQUEST_OTP",
  RESET_PASSWORD: "RESET_PASSWORD",
};

function Login() {
  const navigate =
    useNavigate();

  const {
    login,
  } = useAuth();

  const [
    mode,
    setMode,
  ] = useState(
    MODE.SIGN_IN,
  );

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    otp,
    setOtp,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    maskedEmail,
    setMaskedEmail,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const openForgotPassword = () => {
    clearFeedback();
    setPassword("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setMaskedEmail("");
    setMode(
      MODE.REQUEST_OTP,
    );
  };

  const backToSignIn = () => {
    clearFeedback();
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setMaskedEmail("");
    setMode(
      MODE.SIGN_IN,
    );
  };

  const handleSubmit = async (
    event,
  ) => {
    event.preventDefault();
    clearFeedback();

    if (
      !username.trim() ||
      !password
    ) {
      setError(
        "Please enter username and password.",
      );
      return;
    }

    try {
      setLoading(true);

      await login(
        username.trim(),
        password,
      );

      navigate(
        "/dashboard",
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to connect to the server.",
      );
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async ({
    isResend = false,
  } = {}) => {
    clearFeedback();

    if (!username.trim()) {
      setError(
        "Enter your username first.",
      );
      return;
    }

    try {
      setLoading(true);

      const response =
        await api.post(
          "/auth/password-reset/request",
          {
            username:
              username.trim(),
          },
        );

      setMaskedEmail(
        response.data
          ?.maskedEmail ||
          "",
      );

      setMessage(
        isResend
          ? "A new OTP request was submitted. Check the company email."
          : response.data
              ?.message ||
              "Check the company email for the OTP.",
      );

      setMode(
        MODE.RESET_PASSWORD,
      );
    } catch (err) {
      setError(
        err.response?.data
          ?.message ||
          "Unable to send the password-reset OTP.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp =
    async (event) => {
      event.preventDefault();

      await sendOtp();
    };

  const handleResetPassword =
    async (event) => {
      event.preventDefault();
      clearFeedback();

      if (!username.trim()) {
        setError(
          "Username is required.",
        );
        return;
      }

      if (
        !/^\d{6}$/.test(
          otp.trim(),
        )
      ) {
        setError(
          "Enter the 6-digit OTP sent to the company email.",
        );
        return;
      }

      if (
        newPassword.length <
        8
      ) {
        setError(
          "New password must contain at least 8 characters.",
        );
        return;
      }

      if (
        !/[A-Za-z]/.test(
          newPassword,
        ) ||
        !/\d/.test(
          newPassword,
        )
      ) {
        setError(
          "New password must contain at least one letter and one number.",
        );
        return;
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        setError(
          "New password and confirm password do not match.",
        );
        return;
      }

      try {
        setLoading(true);

        const response =
          await api.post(
            "/auth/password-reset/confirm",
            {
              username:
                username.trim(),
              otp:
                otp.trim(),
              newPassword,
            },
          );

        setPassword("");
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setMaskedEmail("");

        setMode(
          MODE.SIGN_IN,
        );

        setMessage(
          response.data
            ?.message ||
            "Password reset successfully. Sign in with your new password.",
        );
      } catch (err) {
        setError(
          err.response?.data
            ?.message ||
            "Unable to reset the password.",
        );
      } finally {
        setLoading(false);
      }
    };

  const renderSignIn = () => (
    <>
      <div className="login-heading">
        <h2>
          Welcome back
        </h2>

        <p>
          Sign in to your
          Riseora ERP workspace.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger py-2">
          {error}
        </div>
      )}

      {message && (
        <div className="alert alert-success py-2">
          {message}
        </div>
      )}

      <form
        onSubmit={
          handleSubmit
        }
      >
        <div className="mb-3">
          <label
            htmlFor="username"
            className="form-label"
          >
            Username
          </label>

          <input
            id="username"
            type="text"
            className="form-control form-control-lg"
            value={
              username
            }
            onChange={(
              event,
            ) =>
              setUsername(
                event
                  .target
                  .value,
              )
            }
            autoComplete="username"
            autoFocus
          />
        </div>

        <div className="mb-2">
          <div className="login-password-row">
            <label
              htmlFor="password"
              className="form-label mb-0"
            >
              Password
            </label>

            <button
              type="button"
              className="login-forgot-link"
              onClick={
                openForgotPassword
              }
              disabled={
                loading
              }
            >
              Forgot password?
            </button>
          </div>

          <input
            id="password"
            type="password"
            className="form-control form-control-lg mt-2"
            value={
              password
            }
            onChange={(
              event,
            ) =>
              setPassword(
                event
                  .target
                  .value,
              )
            }
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg w-100 mt-4"
          disabled={
            loading
          }
        >
          {loading ? (
            <span className="d-inline-flex align-items-center gap-2">
              <span className="riseora-spinner" />
              Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </>
  );

  const renderRequestOtp =
    () => (
      <>
        <div className="login-heading">
          <h2>
            Reset password
          </h2>

          <p>
            Enter your ERP
            username. The OTP
            will be sent to the
            email saved in
            Company Master.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger py-2">
            {error}
          </div>
        )}

        {message && (
          <div className="alert alert-success py-2">
            {message}
          </div>
        )}

        <div className="login-reset-note">
          For security, you
          cannot enter a
          different destination
          email here. Riseora
          always uses the
          company email already
          configured in the ERP.
        </div>

        <form
          onSubmit={
            handleRequestOtp
          }
        >
          <div className="mb-3">
            <label
              htmlFor="reset-username"
              className="form-label"
            >
              Username
            </label>

            <input
              id="reset-username"
              type="text"
              className="form-control form-control-lg"
              value={
                username
              }
              onChange={(
                event,
              ) =>
                setUsername(
                  event
                    .target
                    .value,
                )
              }
              autoComplete="username"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-100"
            disabled={
              loading
            }
          >
            {loading
              ? "Sending OTP..."
              : "Send OTP"}
          </button>
        </form>

        <div className="login-reset-actions">
          <button
            type="button"
            className="login-back-link"
            onClick={
              backToSignIn
            }
            disabled={
              loading
            }
          >
            ← Back to sign in
          </button>
        </div>
      </>
    );

  const renderResetPassword =
    () => (
      <>
        <div className="login-heading">
          <h2>
            Enter OTP
          </h2>

          <p>
            Enter the OTP and
            choose a new ERP
            password.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger py-2">
            {error}
          </div>
        )}

        {message && (
          <div className="alert alert-success py-2">
            {message}
          </div>
        )}

        <div className="login-reset-note">
          OTP destination:
          <div className="login-reset-email">
            {maskedEmail ||
              "Company Master email"}
          </div>
        </div>

        <form
          onSubmit={
            handleResetPassword
          }
        >
          <div className="mb-3">
            <label
              htmlFor="otp"
              className="form-label"
            >
              6-digit OTP
            </label>

            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="form-control form-control-lg"
              value={otp}
              onChange={(
                event,
              ) =>
                setOtp(
                  event
                    .target
                    .value
                    .replace(
                      /\D/g,
                      "",
                    )
                    .slice(
                      0,
                      6,
                    ),
                )
              }
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label
              htmlFor="new-password"
              className="form-label"
            >
              New Password
            </label>

            <input
              id="new-password"
              type="password"
              className="form-control form-control-lg"
              value={
                newPassword
              }
              onChange={(
                event,
              ) =>
                setNewPassword(
                  event
                    .target
                    .value,
                )
              }
              autoComplete="new-password"
            />

            <div className="form-text">
              Minimum 8
              characters with at
              least one letter
              and one number.
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="confirm-new-password"
              className="form-label"
            >
              Confirm New
              Password
            </label>

            <input
              id="confirm-new-password"
              type="password"
              className="form-control form-control-lg"
              value={
                confirmPassword
              }
              onChange={(
                event,
              ) =>
                setConfirmPassword(
                  event
                    .target
                    .value,
                )
              }
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-100"
            disabled={
              loading
            }
          >
            {loading
              ? "Resetting Password..."
              : "Reset Password"}
          </button>
        </form>

        <div className="login-reset-actions">
          <button
            type="button"
            className="login-back-link"
            onClick={
              backToSignIn
            }
            disabled={
              loading
            }
          >
            ← Back to sign in
          </button>

          <button
            type="button"
            className="login-secondary-action"
            onClick={() =>
              sendOtp({
                isResend:
                  true,
              })
            }
            disabled={
              loading
            }
          >
            Resend OTP
          </button>
        </div>
      </>
    );

  return (
    <div className="login-page">
      <div className="login-ambient login-ambient-one" />
      <div className="login-ambient login-ambient-two" />

      <div className="login-shell">
        <section
          className="login-story"
          aria-hidden="true"
        >
          <div className="login-story-badge">
            RISEORA BUSINESS
            SYSTEM
          </div>

          <h1>
            From raw material
            to finished product
            — one connected
            workflow.
          </h1>

          <p>
            Inventory, formulas,
            production costing,
            sales, returns,
            ledgers and reports
            in one lightweight
            local ERP.
          </p>

          <div className="login-story-points">
            <span>
              Inventory &
              costing
            </span>

            <span>
              Manufacturing
              control
            </span>

            <span>
              Sales &
              profitability
            </span>
          </div>
        </section>

        <section className="login-card">
          <div className="login-brand">
            <img
              src={
                riseoraLogoVerti
              }
              alt="Riseora"
              className="login-logo"
            />
          </div>

          {mode ===
            MODE.SIGN_IN &&
            renderSignIn()}

          {mode ===
            MODE.REQUEST_OTP &&
            renderRequestOtp()}

          {mode ===
            MODE.RESET_PASSWORD &&
            renderResetPassword()}

          <div className="login-footnote">
            Secure local access
            • Riseora ERP
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
