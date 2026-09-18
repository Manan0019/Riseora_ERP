import { useNavigate } from "react-router-dom";

function BackButton() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <button
      type="button"
      className="btn btn-outline-secondary btn-sm"
      onClick={handleBack}
    >
      ← Back
    </button>
  );
}

export default BackButton;