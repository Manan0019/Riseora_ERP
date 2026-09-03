import {
  getCompany,
  saveCompany,
} from "../services/companyService.js";

export function getCompanyDetails(req, res) {
  try {
    const company = getCompany();

    return res.status(200).json({
      success: true,
      company: company || null,
    });
  } catch (error) {
    console.error("Get company error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load company details",
    });
  }
}

export function saveCompanyDetails(req, res) {
  try {
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    const company = saveCompany({
      ...req.body,
      name: name.trim(),
    });

    return res.status(200).json({
      success: true,
      message: "Company details saved successfully",
      company,
    });
  } catch (error) {
    console.error("Save company error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save company details",
    });
  }
}