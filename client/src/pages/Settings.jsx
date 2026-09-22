import {
  useEffect,
  useState,
} from "react";

import api from "../api/api";

function Settings() {
  const [backups, setBackups] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [backingUp, setBackingUp] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get("/backups");

      setBackups(
        response.data.backups
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load backup history."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      setBackingUp(true);
      setMessage("");
      setError("");

      const response =
        await api.post("/backups");

      setMessage(
        `${response.data.backup.fileName} created successfully.`
      );

      await loadBackups();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to create backup."
      );
    } finally {
      setBackingUp(false);
    }
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((current) => ({ ...current, [name]: value }));
  };

  const savePassword = async () => {
    setMessage("");
    setError("");

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError("Complete all password fields.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setError("New password must contain at least 8 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      setChangingPassword(true);
      const response = await api.post("/auth/change-password", passwordForm);
      setMessage(response.data.message || "Password changed successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const formatSize = (
    sizeBytes
  ) => {
    if (sizeBytes < 1024) {
      return `${sizeBytes} B`;
    }

    if (
      sizeBytes <
      1024 * 1024
    ) {
      return `${(
        sizeBytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      sizeBytes /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">
          Settings
        </h2>

        <p className="text-muted mb-0">
          Application maintenance and
          database backup.
        </p>
      </div>

      {message && (
        <div className="alert alert-success">
          {message}
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      <div className="card mb-4" style={{ maxWidth: "900px" }}>
        <div className="card-body">
          <h5>Change Password</h5>
          <p className="text-muted">Use a strong password before using the ERP with real business data.</p>
          <div className="row">
            <div className="col-md-4 mb-3">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-control" name="currentPassword" value={passwordForm.currentPassword} onChange={handlePasswordChange} />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">New Password</label>
              <input type="password" className="form-control" name="newPassword" value={passwordForm.newPassword} onChange={handlePasswordChange} />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-control" name="confirmPassword" value={passwordForm.confirmPassword} onChange={handlePasswordChange} />
            </div>
          </div>
          <button type="button" className="btn btn-outline-primary" onClick={savePassword} disabled={changingPassword}>
            {changingPassword ? "Changing..." : "Change Password"}
          </button>
        </div>
      </div>

      <div
        className="card mb-4"
        style={{
          maxWidth: "900px",
        }}
      >
        <div className="card-body">
          <h5>
            Database Backup
          </h5>

          <p className="text-muted">
            Create a backup of the
            Riseora ERP database.
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={
              handleBackup
            }
            disabled={
              backingUp
            }
          >
            {backingUp
              ? "Creating Backup..."
              : "Backup Now"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h5 className="mb-3">
            Backup History
          </h5>

          {loading ? (
            <p>
              Loading backups...
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered align-middle">
                <thead className="table-light">
                  <tr>
                    <th>
                      Backup File
                    </th>

                    <th>
                      Created
                    </th>

                    <th>
                      Size
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {backups.map(
                    (backup) => (
                      <tr
                        key={
                          backup.fileName
                        }
                      >
                        <td>
                          {
                            backup.fileName
                          }
                        </td>

                        <td>
                          {new Date(
                            backup.modifiedAt
                          ).toLocaleString()}
                        </td>

                        <td>
                          {formatSize(
                            backup.sizeBytes
                          )}
                        </td>
                      </tr>
                    )
                  )}

                  {backups.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="text-center text-muted"
                      >
                        No backups
                        created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;