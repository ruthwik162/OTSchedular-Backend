const express = require('express');
const cors = require('cors');

require('dotenv').config();


const app = express();
const port = process.env.PORT || 3500;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'https://teacher-student-appointment-a7hf.onrender.com','http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],  // Added PATCH
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.send('API is working');
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
