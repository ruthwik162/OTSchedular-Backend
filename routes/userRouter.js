const express = require("express");
const {
  registerUser,
  loginUser,
  getAllUsers,
  getUserByEmail,
  getUsersByRole,
  updateUser,
  deleteUser,
  isAuth,
  logout,
  sendResetPasswordEmail,
} = require("../controller/userController");
const { assignDoctorNursesToPatient } = require("../controller/assignDoctorNursesToPatient");
const { default: authUser } = require("../middleware/authUser");

const router = express.Router();

// Register User(s)
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/is-auth",authUser, isAuth);
router.get("/logout",authUser, logout);
router.get("/all", getAllUsers);
router.get("/email/:email", getUserByEmail);
router.get("/role/:role", getUsersByRole);
router.put("/update/:email", updateUser);
router.delete("/delete/:email", deleteUser);
router.post("/forgot-password", sendResetPasswordEmail);





router.post("/assign/:email", assignDoctorNursesToPatient);

module.exports = router;
