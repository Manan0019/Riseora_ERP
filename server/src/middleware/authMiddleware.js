export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  next();
}

export function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.session.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Administrator access required",
    });
  }

  next();
}