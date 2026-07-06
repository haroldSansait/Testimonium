export const getProfile = (req, res) => {
  // req.user is populated by authenticateFirebaseToken middleware
  return res.status(200).json({
    success: true,
    data: req.user,
  });
};
