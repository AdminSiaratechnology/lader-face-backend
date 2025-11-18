const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(401).json({ message: "Authorization missing" });

  const token = authHeader.split(" ")[1];
  try {
    const authSource = req?.headers["auth-source"];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    // ❌ If user logged-in from another device_
    if (authSource !== "Api") {
      if (
        user.currentToken !== token ||
        user.currentDeviceId !== decoded.deviceId
      ) {
        return res.status(401).json({
          message: "Logged out because you logged in on another device",
        });
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
module.exports = authMiddleware;
