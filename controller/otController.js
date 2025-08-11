const { db } = require("../firebaseAdmin");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const streamifier = require("streamifier");
const { v4: uuidv4 } = require("uuid");
const storage = multer.memoryStorage();
const upload = multer({ storage });


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const occupiedSlots = new Set();
const OT_TIMINGS = ["7Am-10Am", "11Am-2Pm", "3Pm-6Pm", "7Pm-10Pm"];
const NURSE_COOLDOWN_HOURS = 6;

async function assignMedicalStaff(caseType, nurseCount = 4) {
  // Assign doctor
  const doctorSnap = await db.collection("users")
    .where("role", "==", "doctor")
    .where("department", "==", caseType)
    .limit(1)
    .get();

  const doctor = doctorSnap.empty ? null : { id: doctorSnap.docs[0].id, ...doctorSnap.docs[0].data() };

  // Assign assistant doctor (role == assistantDoctor, department == caseType, not same as doctor)
  let assistantDoctor = null;

  if (doctor) {
    const assistantSnap = await db.collection("users")
      .where("role", "==", "assistantDoctor")
      .where("department", "==", caseType)
      .get();

    for (let doc of assistantSnap.docs) {
      const data = doc.data();
      if (data.email !== doctor.email) {
        assistantDoctor = { id: doc.id, ...data };
        break;
      }
    }
  }

  // Assign nurses ensuring 6-hour cooldown
  const nursesSnap = await db.collection("users")
    .where("role", "==", "nurse")
    .get();

  const now = new Date();
  const nurses = [];

  for (let doc of nursesSnap.docs) {
    const nurse = { id: doc.id, ...doc.data() };
    const lastAssigned = nurse.lastAssignedTime ? new Date(nurse.lastAssignedTime) : null;

    if (!lastAssigned || (now - lastAssigned) / 36e5 >= NURSE_COOLDOWN_HOURS) {
      nurses.push(nurse);
      if (nurses.length === nurseCount) break;
    }
  }

  return { doctor, assistantDoctor, nurses };
}

async function updateNurseAssignmentTimes(nurses) {
  const now = new Date().toISOString();
  const batch = db.batch();

  for (let nurse of nurses) {
    const nurseRef = db.collection("users").doc(nurse.id);
    batch.update(nurseRef, { lastAssignedTime: now });
  }
  await batch.commit();
}

async function sendOTEmail(emails, subject, content) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: emails.join(", "),
    subject,
    html: content,
  };
  await transporter.sendMail(mailOptions);
}

const assignOrBookAppointmentByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    const { date, slot, otNumber } = req.body;

    if (!email || !date || !slot || !otNumber) {
      return res.status(400).json({ success: false, message: "Email, date, slot, and OT number are required." });
    }

    const slotKey = `${otNumber}-${date}-${slot}`;
    if (occupiedSlots.has(slotKey)) {
      return res.status(409).json({ success: false, message: "Selected slot is already occupied." });
    }

    const existingSnap = await db.collection("appointments")
      .where("patientEmail", "==", email)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return res.status(400).json({ success: false, message: "Patient already has an appointment." });
    }

    const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (userSnap.empty) {
      return res.status(404).json({ success: false, message: "Patient not found." });
    }

    const user = userSnap.docs[0].data();
    const { username: patientName, caseType } = user;

    const { doctor, assistantDoctor, nurses } = await assignMedicalStaff(caseType);
    if (!doctor || !assistantDoctor || nurses.length < 3) {
      return res.status(500).json({ success: false, message: "Not enough medical staff available." });
    }

    const appointment = {
      patientEmail: email,
      patientName,
      caseType,
      date,
      slot,
      otNumber,
      doctor: doctor.username,
      doctorEmail: doctor.email,
      assistantDoctor: assistantDoctor.username,
      assistantDoctorEmail: assistantDoctor.email,
      nurses: nurses.map(n => n.username),
      nurseIds: nurses.map(n => n.id),
      status: "assigned",
      createdAt: new Date().toISOString()
    };

    occupiedSlots.add(slotKey);
    const docRef = await db.collection("appointments").add(appointment);
    await updateNurseAssignmentTimes(nurses);

    await sendOTEmail(
      [email],
      "Your OT Appointment is Confirmed",
      `<h1>Hello <strong>${patientName}</strong>,</h1>
       <p>Your OT appointment has been successfully scheduled.</p>
       <p><strong>Case:</strong> ${caseType}</p>
       <p><strong>Date:</strong> ${date}</p>
       <p><strong>Time Slot:</strong> ${slot}</p>
       <h1><strong>Operation Theatre:</strong> ${otNumber}</h1>
       <ul>
         <li><strong>Doctor Assigned:</strong> ${doctor.username}</li>
         <li><strong>Assistant Doctor Assigned:</strong> ${assistantDoctor.username}</li>
         <li><strong>Nurses Assigned:</strong> ${nurses.map(n => n.username).join(", ")}</li>
       </ul>
       <p>Thank you for choosing our hospital.</p>`
    );

    return res.status(201).json({
      success: true,
      message: "Appointment booked and email sent to patient.",
      appointment: { id: docRef.id, ...appointment }
    });
  } catch (err) {
    next(err);
  }
};

async function findAvailableSlot() {
  const today = new Date();
  const date = today.toISOString().split("T")[0];
  for (let slot of OT_TIMINGS) {
    for (let otNumber of ["OT1", "OT2"]) {
      const slotKey = `${otNumber}-${date}-${slot}`;
      if (!occupiedSlots.has(slotKey)) {
        return { date, slot, otNumber };
      }
    }
  }
  return null;
}

const getAllOTAppointments = async (req, res, next) => {
  try {
    const snapshot = await db.collection("appointments").get();
    const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
};

const getDoctorAppointmentsByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (userSnap.empty) return res.status(404).json({ success: false, message: "Doctor not found." });

    const doctor = userSnap.docs[0].data();
    const snapshot = await db.collection("appointments")
      .where("doctor", "==", doctor.username)
      .get();

    const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
};



const getPatientAppointmentsByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;

    // Find the patient by email
    const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (userSnap.empty) {
      return res.status(404).json({ success: false, message: "Patient not found." });
    }

    const patient = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };

    // Fetch appointments for the patient
    const snapshot = await db.collection("appointments")
      .where("patientEmail", "==", email)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        message: "No appointments found for this patient.",
        patient,
        appointments: [],
        reports: patient.reports || []
      });
    }

    // Map appointment data and include OT room info if available
    const appointments = await Promise.all(snapshot.docs.map(async doc => {
      const appointmentData = { id: doc.id, ...doc.data() };

      let otRoomDetails = null;
      if (appointmentData.otNumber) {
        const otSnap = await db.collection("operationTheatres")
          .doc(appointmentData.otNumber)
          .get();

        if (otSnap.exists) {
          otRoomDetails = { id: otSnap.id, ...otSnap.data() };
        }
      }

      return {
        ...appointmentData,
        otRoomDetails
      };
    }));

    res.status(200).json({
      success: true,
      patient,
      appointments,
      reports: patient.reports || []
    });

  } catch (err) {
    next(err);
  }
};




const updateOTAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const docRef = db.collection("appointments").doc(id);
    await docRef.update(data);
    res.status(200).json({ success: true, message: "OT appointment updated." });
  } catch (err) {
    next(err);
  }
};

// ====================== UPLOAD REPORT FOR OT APPOINTMENT ======================
const uploadReportForOT = [
  upload.single("report"), // must match frontend formData field name
  async (req, res) => {
    try {
      const { doctorEmail, patientEmail } = req.params;

      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      // --- Check Patient ---
      const patientQuery = await db.collection("users")
        .where("email", "==", patientEmail)
        .limit(1)
        .get();
      if (patientQuery.empty) {
        return res.status(404).json({ success: false, message: "Patient not found" });
      }
      const patientDoc = patientQuery.docs[0];
      const patientRef = patientDoc.ref;
      const patientData = patientDoc.data();

      // --- Check Doctor ---
      const doctorQuery = await db.collection("users")
        .where("email", "==", doctorEmail)
        .limit(1)
        .get();
      if (doctorQuery.empty) {
        return res.status(404).json({ success: false, message: "Doctor not found" });
      }

      // --- Find OT appointments ---
      const apptQuery = await db.collection("appointments")
        .where("doctorEmail", "==", doctorEmail)
        .where("patientEmail", "==", patientEmail)
        .get();
      if (apptQuery.empty) {
        return res.status(404).json({ success: false, message: "No matching OT appointments found" });
      }

      // --- Upload to Cloudinary ---
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "ot_reports", resource_type: "auto" },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return res.status(500).json({ success: false, message: "Upload to Cloudinary failed", error });
          }

          const reportData = {
            id: uuidv4(),
            fileUrl: result.secure_url,
            fileName: req.file.originalname,
            fileSize: req.file.size, // include file size
            uploadedBy: doctorEmail,
            uploadedAt: new Date().toISOString(),
            patientName: patientData.username || "",
            patientEmail: patientEmail
          };

          // Save in patient
          await patientRef.update({
            reports: admin.firestore.FieldValue.arrayUnion(reportData)
          });

          // Save in appointments
          const batch = db.batch();
          apptQuery.forEach(doc => {
            batch.update(doc.ref, {
              reports: admin.firestore.FieldValue.arrayUnion(reportData)
            });
          });
          await batch.commit();

          res.status(200).json({
            success: true,
            message: "Report uploaded successfully",
            patient: (await patientRef.get()).data(),
            report: reportData
          });
        }
      );

      // Pipe the file buffer
      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);

    } catch (error) {
      console.error("Upload report error:", error);
      res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
  }
];


// ====================== GET PATIENT OT REPORTS ======================
const getPatientOTReports = async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) return res.status(400).json({ message: "Patient email is required" });

    const patientSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (patientSnap.empty) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patient = patientSnap.docs[0].data();
    const reports = (patient.reports || []).filter(r => r.appointmentId);

    res.status(200).json({
      success: true,
      email,
      reports,
    });

  } catch (error) {
    console.error("Get OT Reports Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDoctorPatientDetails = async (req, res) => {
  try {
    const { doctorEmail, patientEmail } = req.params;

    // Get patient
    const patientSnap = await db.collection("users")
      .where("email", "==", patientEmail)
      .limit(1)
      .get();

    if (patientSnap.empty) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const patient = { id: patientSnap.docs[0].id, ...patientSnap.docs[0].data() };

    // Filter reports that match this doctor
    const reports = (patient.reports || []).filter(
      r => r.uploadedByDoctor === doctorEmail
    );

    // Get OT appointments for this doctor–patient pair
    const apptSnap = await db.collection("otAppointments")
      .where("doctorEmail", "==", doctorEmail)
      .where("patientEmail", "==", patientEmail)
      .get();

    const appointments = apptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.status(200).json({
      success: true,
      patient,
      reports,
      appointments
    });

  } catch (error) {
    console.error("getDoctorPatientDetails error:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};



module.exports = {
  assignOrBookAppointmentByEmail,
  getAllOTAppointments,
  getDoctorAppointmentsByEmail,
  updateOTAppointment,
  getPatientAppointmentsByEmail,
  uploadReportForOT ,
  getPatientOTReports,
  getDoctorPatientDetails
};
