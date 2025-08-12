const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Routes
const userRouter = require('./routes/userRouter.js');
const otRouter = require('./routes/otRouter.js');

const app = express();
const port = process.env.PORT || 8087;

// ---------- Middlewares ----------
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://operartion-theatre-schedular.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json()); // Global JSON parser
app.use(express.urlencoded({ extended: true })); // Support form data
app.use(cookieParser());

// ---------- Routes ----------
app.use('/user', userRouter);
app.use('/ot', otRouter);

app.get('/', (req, res) => {
  res.status(200).send('API is working 🚀');
});

// ---------- Start Server ----------
app.listen(port, () => {
  console.log(`Server is running at: http://localhost:${port}`);
});
