const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const userRouter = require('./routes/userRouter.js');
const otRouter = require('./routes/otRouter.js');

const app = express();
const port = process.env.PORT || 8087;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://operartion-theatre-schedular.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(cookieParser());

app.use('/user', express.json(), express.urlencoded({ extended: true }), userRouter);

app.use('/ot', otRouter);

app.get('/', (req, res) => {
  res.send('API is working');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
