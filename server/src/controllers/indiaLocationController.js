import {
  getIndiaLocationStats,
  lookupIndiaPincode,
  searchIndiaCities,
  searchIndiaStates,
} from "../services/indiaLocationService.js";

export function listIndiaStates(req, res) {
  try {
    const states = searchIndiaStates(req.query.q, req.query.limit);
    return res.json({ success: true, states });
  } catch (error) {
    console.error("Unable to search Indian states:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load state suggestions.",
    });
  }
}

export function listIndiaCities(req, res) {
  try {
    const cities = searchIndiaCities({
      query: req.query.q,
      state: req.query.state,
      limit: req.query.limit,
    });
    return res.json({ success: true, cities });
  } catch (error) {
    console.error("Unable to search Indian cities:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load city suggestions.",
    });
  }
}

export async function getIndiaPincode(req, res) {
  try {
    const pincode = String(req.params.pincode || "").trim();

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: "PIN code must contain exactly 6 digits.",
      });
    }

    const location = await lookupIndiaPincode(pincode);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "No Indian postal location was found for this PIN code.",
      });
    }

    return res.json({ success: true, location });
  } catch (error) {
    console.error("Unable to look up Indian PIN code:", error);

    if (error?.code === "PIN_LOOKUP_UNAVAILABLE") {
      return res.status(503).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to look up this PIN code.",
    });
  }
}

export function getIndiaLocationInfo(req, res) {
  return res.json({
    success: true,
    country: "India",
    ...getIndiaLocationStats(),
  });
}
