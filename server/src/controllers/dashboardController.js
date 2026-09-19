import {
  getDashboardSummary,
} from "../services/dashboardService.js";

export function dashboardSummary(
  req,
  res
) {
  try {
    const summary =
      getDashboardSummary();

    return res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error(
      "Dashboard error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load dashboard.",
    });
  }
}