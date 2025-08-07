require('dotenv').config();
const admin = require("firebase-admin");

// Parse escaped JSON string from environment
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)});

const db = admin.firestore();

module.exports = { db };
