const form = document.getElementById("setup-form");
const errorBox = document.getElementById("error");
const saveButton = document.getElementById("save-button");

function showError(message) {
  errorBox.textContent = message || "Unable to save setup.";
  errorBox.classList.add("show");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.classList.remove("show");
  errorBox.textContent = "";

  const adminPassword =
    document.getElementById("admin-password").value;
  const confirmPassword =
    document.getElementById("confirm-password").value;

  if (adminPassword !== confirmPassword) {
    showError("Administrator passwords do not match.");
    return;
  }

  const payload = {
    adminPassword,
    confirmPassword,
    smtpUser: document.getElementById("smtp-user").value,
    smtpPass: document.getElementById("smtp-pass").value,
    smtpFrom: document.getElementById("smtp-from").value,
    smtpHost: document.getElementById("smtp-host").value,
    smtpPort: document.getElementById("smtp-port").value,
    smtpSecure: document.getElementById("smtp-secure").checked,
  };

  saveButton.disabled = true;
  saveButton.textContent = "Creating workspace...";

  try {
    const result =
      await window.riseoraDesktopSetup.save(payload);

    if (!result?.success) {
      showError(result?.message || "Unable to save setup.");
      saveButton.disabled = false;
      saveButton.textContent = "Create Riseora Workspace";
      return;
    }

    saveButton.textContent = "Starting Riseora ERP...";
  } catch (error) {
    showError(error?.message || String(error));
    saveButton.disabled = false;
    saveButton.textContent = "Create Riseora Workspace";
  }
});
