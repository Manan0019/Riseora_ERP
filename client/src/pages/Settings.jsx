import {
  useEffect,
  useState,
  useRef,
} from "react";

import api from "../api/api";

function Settings() {
  const restoreFileRef = useRef(null);
  const [restoring, setRestoring] = useState(false);
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

  const handleDownload = async (fileName) => {
    try {
      setError("");
      const response = await api.get(`/backups/${encodeURIComponent(fileName)}/download`, {responseType: "blob"});
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to download backup.");
    }
  };

  const handleRestoreFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".db")) { setError("Select a Riseora ERP .db backup."); return; }
    if (file.size > 250 * 1024 * 1024) { setError("Backup must be 250 MB or smaller."); return; }
    const accepted = window.confirm(
      `Restore the database from ${file.name}?\n\nThis REPLACES the CURRENT laptop's business records after restarting Riseora ERP. A safety backup will be saved. Existing transactions on this laptop will NOT be merged. Continue?`
    );
    if (!accepted) return;
    try {
      setRestoring(true); setMessage(""); setError("");
      const buffer = await file.arrayBuffer();
      const result = await api.post("/backups/restore", buffer, {
        headers: { "Content-Type": "application/octet-stream" },
        timeout: 120000,
      });
      setMessage(`${result.data.message} Safety backup: ${result.data.safetyBackup}. Imported database contains ${result.data.summary.itemCount} items, ${result.data.summary.purchaseCount} purchases, and ${result.data.summary.salesCount} sales.`);
      await loadBackups();
    } catch (err) {
      let detail = err.response?.data?.message;
      if (!detail && err.response?.data instanceof Blob) detail = null;
      setError(detail || "Backup validation or restore preparation failed. Existing data has not been changed.");
    } finally { setRestoring(false); }
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
          <hr />
          <h5>Restore a backup from this PC or another PC</h5>
          <p className="text-muted">Download a .db backup from the old PC, copy it to this PC and select it here. The backup is checked before restore. Your current database is preserved in Backup History.</p>
          <input ref={restoreFileRef} type="file" accept=".db,application/vnd.sqlite3,application/octet-stream" className="visually-hidden" aria-label="Choose Riseora ERP database backup" onChange={handleRestoreFile} />
          <button type="button" className="btn btn-outline-danger" onClick={() => restoreFileRef.current?.click()} disabled={restoring}>
            {restoring ? "Checking backup..." : "Restore Backup (.db)"}
          </button>
          <p className="small mt-2 mb-0">Restore is applied only after closing and reopening the application. It replaces rather than merges the current laptop's database; keep both backups until checked.</p>
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

                    <th>Size</th>
                    <th>Transfer</th>
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
                        <td><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleDownload(backup.fileName)}>Download .db</button></td>
                      </tr>
                    )
                  )}

                  {backups.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={4}
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