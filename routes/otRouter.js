const express = require("express");
const router = express.Router();
const {
  assignOrBookAppointmentByEmail,
  getAllOTAppointments,
  getDoctorAppointmentsByEmail,
  updateOTAppointment
} = require("../controller/otController");

router.post("/assign/:email", assignOrBookAppointmentByEmail);
router.get("/all", getAllOTAppointments);
router.get("/doctor/:email", getDoctorAppointmentsByEmail);
router.put("/update/:id", updateOTAppointment);

module.exports = router;
