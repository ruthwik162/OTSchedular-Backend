const express = require('express');
const cors = require('cors');
const userRouter = require('./routes/userRouter.js');
const otRouter = require('./routes/otRouter.js');
const cookieParser = require('cookie-parser');

require('dotenv').config();


const app = express();
const port = process.env.PORT || 8087;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173','https://operartion-theatre-schedular.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],  // Added PATCH
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/user', userRouter);
app.use('/ot',otRouter);

// Health check
app.get('/', (req, res) => {
  res.send('API is working');
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
