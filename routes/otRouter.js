const express = require("express");
const router = express.Router();
const {
  assignOrBookAppointmentByEmail,
  getAllOTAppointments,
  getDoctorAppointmentsByEmail,
  updateOTAppointment,
  getPatientAppointmentsByEmail,
  uploadReportForOT,
  getPatientOTReports,
  getDoctorPatientDetails,
  bookDoctorAppointment,
  getAllAppointments,
  updateAppointmentStatusByEmail,
  getAppointmentsByPatientEmail,
  getDoctorPatientAppointments,
  getAppointmentsByDoctorEmail
} = require("../controller/otController");

router.post("/assign/:email", assignOrBookAppointmentByEmail);


router.get("/all", getAllOTAppointments);
router.get("/doctor/:email", getDoctorAppointmentsByEmail);
router.get("/patient/:email", getPatientAppointmentsByEmail);
router.put("/update/:id", updateOTAppointment);
router.post("/report/:doctorEmail/:patientEmail", uploadReportForOT);
router.get("/patients/:email", getPatientOTReports);
router.get("/report/:doctorEmail/:patientEmail", getDoctorPatientDetails);


router.post("/appointments/doctor", bookDoctorAppointment);
router.patch("/appointments/status/:email", updateAppointmentStatusByEmail);
router.get("/appointments", getAllAppointments);

router.get("/appointments/patient/:patientEmail", getAppointmentsByPatientEmail);
router.get("/appointments/doctor/:doctorEmail", getAppointmentsByDoctorEmail);

router.get("/appointments/:doctorEmail/:patientEmail", getDoctorPatientAppointments);




module.exports = router;
