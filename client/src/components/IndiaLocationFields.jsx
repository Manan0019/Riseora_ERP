import { useEffect, useId, useMemo, useState } from "react";
import api from "../api/api";

function IndiaLocationFields({ form, setForm, disabled = false }) {
  const id = useId().replace(/:/g, "");
  const stateListId = `india-state-${id}`;
  const cityListId = `india-city-${id}`;

  const [stateSuggestions, setStateSuggestions] = useState([]);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinMessage, setPinMessage] = useState("");
  const [pinError, setPinError] = useState("");

  const stateQuery = String(form.state || "").trim();
  const cityQuery = String(form.city || "").trim();
  const pincode = String(form.pincode || "").replace(/\D/g, "").slice(0, 6);

  useEffect(() => {
    if (disabled) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get("/locations/states", {
          params: { q: stateQuery, limit: 40 },
        });
        if (!cancelled) setStateSuggestions(response.data.states || []);
      } catch {
        if (!cancelled) setStateSuggestions([]);
      }
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [disabled, stateQuery]);

  useEffect(() => {
    if (disabled || cityQuery.length < 1) {
      setCitySuggestions([]);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get("/locations/cities", {
          params: { q: cityQuery, state: stateQuery, limit: 30 },
        });
        if (!cancelled) setCitySuggestions(response.data.cities || []);
      } catch {
        if (!cancelled) setCitySuggestions([]);
      }
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [disabled, cityQuery, stateQuery]);

  useEffect(() => {
    if (disabled || pincode.length !== 6) {
      setPinLoading(false);
      setPinMessage("");
      setPinError("");
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setPinLoading(true);
        setPinMessage("");
        setPinError("");

        const response = await api.get(`/locations/pincode/${pincode}`);
        const location = response.data.location;
        if (cancelled || !location) return;

        setForm((current) => ({
          ...current,
          pincode,
          city: location.city || current.city,
          state: location.state || current.state,
        }));

        setPinMessage(`PIN matched: ${location.city}, ${location.state}.`);
      } catch (error) {
        if (!cancelled) {
          setPinError(
            error.response?.data?.message ||
              "PIN lookup is unavailable. Select City and State manually.",
          );
        }
      } finally {
        if (!cancelled) setPinLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [disabled, pincode, setForm]);

  const exactCity = useMemo(() => {
    const value = cityQuery.toLowerCase();
    if (!value) return null;
    const matches = citySuggestions.filter(
      (city) => String(city.name || "").toLowerCase() === value,
    );
    return matches.length === 1 ? matches[0] : null;
  }, [cityQuery, citySuggestions]);

  const handlePinChange = (event) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 6);
    setPinMessage("");
    setPinError("");
    setForm((current) => ({ ...current, pincode: value }));
  };

  const handleCityChange = (event) => {
    const value = event.target.value;
    const exact = citySuggestions.find(
      (city) => String(city.name || "").toLowerCase() === value.trim().toLowerCase(),
    );
    setForm((current) => ({
      ...current,
      city: value,
      state: exact?.state || current.state,
    }));
  };

  const handleCityBlur = () => {
    if (!exactCity) return;
    setForm((current) => ({
      ...current,
      city: exactCity.name,
      state: exactCity.state,
    }));
  };

  const handleStateChange = (event) => {
    const value = event.target.value;
    const exact = stateSuggestions.find(
      (state) => String(state.name || "").toLowerCase() === value.trim().toLowerCase(),
    );
    setForm((current) => ({
      ...current,
      state: exact?.name || value,
    }));
  };

  return (
    <>
      <div className="col-md-4 mb-3">
        <label className="form-label">PIN Code</label>
        <input
          className="form-control"
          name="pincode"
          value={pincode}
          onChange={handlePinChange}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="6-digit PIN"
          autoComplete="postal-code"
        />
        {!disabled && pinLoading && (
          <div className="form-text">Looking up PIN...</div>
        )}
        {!disabled && !pinLoading && pinMessage && (
          <div className="form-text text-success">{pinMessage}</div>
        )}
        {!disabled && !pinLoading && pinError && (
          <div className="form-text text-danger">{pinError}</div>
        )}
      </div>

      <div className="col-md-4 mb-3">
        <label className="form-label">City</label>
        <input
          className="form-control"
          name="city"
          value={form.city || ""}
          onChange={handleCityChange}
          onBlur={handleCityBlur}
          disabled={disabled}
          list={disabled ? undefined : cityListId}
          autoComplete="address-level2"
          placeholder="Start typing city..."
        />
        {!disabled && (
          <datalist id={cityListId}>
            {citySuggestions.map((city) => (
              <option
                key={`${city.name}-${city.stateCode}`}
                value={city.name}
                label={city.state}
              />
            ))}
          </datalist>
        )}
      </div>

      <div className="col-md-4 mb-3">
        <label className="form-label">State</label>
        <input
          className="form-control"
          name="state"
          value={form.state || ""}
          onChange={handleStateChange}
          disabled={disabled}
          list={disabled ? undefined : stateListId}
          autoComplete="address-level1"
          placeholder="Start typing state..."
        />
        {!disabled && (
          <datalist id={stateListId}>
            {stateSuggestions.map((state) => (
              <option key={state.code} value={state.name} />
            ))}
          </datalist>
        )}
      </div>
    </>
  );
}

export default IndiaLocationFields;
