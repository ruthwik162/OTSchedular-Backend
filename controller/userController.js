const { db } = require("../firebaseAdmin");
const bcrypt = require("bcrypt");
const cloudinary = require("../cloudinaryConfig");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendWelcomeEmail = async (toEmail, user) => {
  const { username, role } = user;

  let text = `Hi ${username || "User"},\n\nYour account has been successfully registered on the Operation Scheduler Platform.\n\n`;

  if (role === "patient") {
    text += `You can now view your assigned doctors, surgery schedule, and reports via the system.\n\nStay safe and we wish you a speedy recovery!\n`;
  } else if (role === "doctor") {
    text += `You can now view your assigned surgeries, patients, and OT schedules in your dashboard.\n`;
  } else if (role === "admin") {
    text += `As an admin, you now have full control over managing doctors, patients, and scheduling OTs.\n`;
  }

  text += `\nStart managing operations smartly!\n\nRegards,\nHospital Management Team`;

  await transporter.sendMail({
    from: `"Hospital Admin" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Welcome ${username || "User"} to OT Scheduler Platform`,
    text,
  });
};

// ====================== REGISTER ======================
const registerUser = [
  upload.single("profileImage"),
  async (req, res) => {
    try {
      let users = [];
      const body = req.body;

      if (Array.isArray(body)) {
        users = body;
      } else if (body.users) {
        users = typeof body.users === "string" ? JSON.parse(body.users) : body.users;
      } else if (body.user) {
        users = typeof body.user === "string" ? [JSON.parse(body.user)] : [body.user];
      } else if (body.email && body.password) {
        users = [body];
      } else {
        return res.status(400).json({ message: "Invalid request format" });
      }

      const results = [];

      for (let user of users) {
        const {
          email,
          password,
          username = "",
          mobile = "",
          gender = "",
          role = "patient",
          department = "",
          experience = "",
          designation = "",
          className = "",
          caseType = "",
          caseDescription = "",
          age = "",
          bloodGroup = "",
          allergies = "",
          emergencyContactName = "",
          emergencyContactNumber = ""
        } = user;

        if (!email || !password) {
          results.push({ email: email || "unknown", status: "failed", reason: "Email and password required" });
          continue;
        }

        const existing = await db.collection("users").where("email", "==", email).get();
        if (!existing.empty) {
          results.push({ email, status: "skipped", reason: "User already exists" });
          continue;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let profileImageUrl = null;
        if (req.file && users.length === 1) {
          const streamUpload = buffer =>
            new Promise((resolve, reject) => {
              cloudinary.uploader.upload_stream(
                { folder: "user_profiles" },
                (err, result) => {
                  if (err) return reject(err);
                  resolve(result.secure_url);
                }
              ).end(buffer);
            });
          profileImageUrl = await streamUpload(req.file.buffer);
        }

        const userData = {
          email,
          password: hashedPassword,
          username,
          mobile,
          gender,
          role,
          department,
          experience,
          designation,
          className,
          profileImageUrl,
          caseType,
          caseDescription,
          age,
          bloodGroup,
          allergies,
          emergencyContactName,
          emergencyContactNumber,
          createdAt: new Date().toISOString()
        };

        const newUserRef = db.collection("users").doc();
        await newUserRef.set(userData);

        try {
          await sendWelcomeEmail(email, { username, role });
        } catch (e) {
          console.warn("Email failed:", e.message);
        }

        results.push({ email, status: "created", id: newUserRef.id });
      }

      res.status(201).json({ message: "Registration complete", results });

    } catch (err) {
      console.error("Registration Error:", err);
      res.status(500).json({ message: "Registration failed", error: err.message });
    }
  }
];

// ====================== LOGIN ======================
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const snapshot = await db.collection("users").where("email", "==", email).limit(1).get();
    if (snapshot.empty)
      return res.status(404).json({ message: "User not found" });

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    res.status(200).json({
      id: userDoc.id,
      username: user.username,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      gender: user.gender,
      profileImageUrl: user.profileImageUrl || null,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// ====================== GET ALL USERS ======================
const getAllUsers = async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(users);
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ message: "Failed to retrieve users" });
  }
};

// ====================== GET USER BY EMAIL ======================
const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const snapshot = await db.collection("users").where("email", "==", email).limit(1).get();
    if (snapshot.empty)
      return res.status(404).json({ message: "User not found" });

    const user = snapshot.docs[0].data();
    res.status(200).json(user);
  } catch (error) {
    console.error("Get User Error:", error);
    res.status(500).json({ message: "Failed to get user", error: error.message });
  }
};

// ====================== GET USERS BY ROLE ======================
const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const snapshot = await db.collection("users").where("role", "==", role).get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(users);
  } catch (error) {
    console.error("Role Fetch Error:", error);
    res.status(500).json({ message: "Failed to retrieve users", error: error.message });
  }
};

// ====================== UPDATE USER ======================
const updateUser = [
  upload.single("image"),
  async (req, res) => {
    try {
      const { email } = req.params;

      const snapshot = await db.collection("users").where("email", "==", email).limit(1).get();
      if (snapshot.empty)
        return res.status(404).json({ message: "User not found" });

      const userDoc = snapshot.docs[0];
      const userRef = db.collection("users").doc(userDoc.id);
      const updateData = { ...req.body };

      if (updateData.mobile) updateData.mobile = String(updateData.mobile);

      if (req.file) {
        const streamUpload = buffer =>
          new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              { folder: "user_profiles" },
              (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
              }
            ).end(buffer);
          });
        const profileImageUrl = await streamUpload(req.file.buffer);
        updateData.profileImageUrl = profileImageUrl;
      }

      delete updateData.email;

      await userRef.update(updateData);
      const updated = await userRef.get();
      res.status(200).json({ id: userDoc.id, ...updated.data() });
    } catch (error) {
      console.error("Update Error:", error);
      res.status(500).json({ message: "Failed to update user", error: error.message });
    }
  }
];

// ====================== DELETE USER ======================
const deleteUser = async (req, res) => {
  try {
    const { email } = req.params;

    const snapshot = await db.collection("users").where("email", "==", email).limit(1).get();
    if (snapshot.empty)
      return res.status(404).json({ message: "User not found" });

    const userDoc = snapshot.docs[0];
    await db.collection("users").doc(userDoc.id).delete();

    res.status(200).json({ message: `User ${email} deleted successfully.` });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getAllUsers,
  getUserByEmail,
  getUsersByRole,
  updateUser,
  deleteUser
};
