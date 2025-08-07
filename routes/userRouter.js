const express = require("express");
const {
  registerUser,
  loginUser,
  getAllUsers,
  getUserByEmail,
  getUsersByRole,
  updateUser,
  deleteUser,
} = require("../controller/userController");
const { assignDoctorNursesToPatient } = require("../controller/assignDoctorNursesToPatient");

const router = express.Router();

// Register User(s)
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/all", getAllUsers);
router.get("/email/:email", getUserByEmail);
router.get("/role/:role", getUsersByRole);
router.put("/update/:email", updateUser);
router.delete("/delete/:email", deleteUser);




router.post("/assign/:email", assignDoctorNursesToPatient);

module.exports = router;
