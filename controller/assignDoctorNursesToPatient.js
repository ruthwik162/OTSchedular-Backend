const { db } = require("../firebaseAdmin");

const assignDoctorNursesToPatient = async (req, res) => {
  try {
    const { email } = req.params;

    // 1. Get Patient
    const patientSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (patientSnap.empty) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patientDoc = patientSnap.docs[0];
    const patientData = patientDoc.data();

    const caseType = patientData.caseType?.toLowerCase();
    if (!caseType) {
      return res.status(400).json({ message: "Patient caseType is required for assignment" });
    }

    // 2. Find Doctor matching caseType with department
    const doctorSnap = await db
      .collection("users")
      .where("role", "==", "doctor")
      .where("department", "==", caseType)
      .limit(1)
      .get();

    if (doctorSnap.empty) {
      return res.status(404).json({ message: `No doctor found in department: ${caseType}` });
    }

    const doctor = doctorSnap.docs[0].data();

    // 3. Find 2 Nurses
    const nurseSnap = await db
      .collection("users")
      .where("role", "==", "nurse")
      .limit(2)
      .get();

    if (nurseSnap.empty || nurseSnap.size < 2) {
      return res.status(404).json({ message: "Not enough nurses found" });
    }

    const nurses = nurseSnap.docs.map(doc => doc.data());

    // 4. Create assignment record
    const assignmentData = {
      patientEmail: patientData.email,
      patientId: patientDoc.id,
      assignedDoctor: {
        name: doctor.username,
        email: doctor.email,
        department: doctor.department,
      },
      assignedNurses: nurses.map(nurse => ({
        name: nurse.username,
        email: nurse.email,
      })),
      assignedAt: new Date().toISOString(),
    };

    await db.collection("assignments").add(assignmentData);

    res.status(201).json({
      message: "Doctor and Nurses assigned successfully",
      data: assignmentData,
    });

  } catch (error) {
    console.error("Assignment Error:", error);
    res.status(500).json({ message: "Failed to assign medical staff", error: error.message });
  }
};

module.exports = {
  assignDoctorNursesToPatient,
};
