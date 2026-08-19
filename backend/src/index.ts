import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import cardRoutes from './routes/cardRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({origin: '*'}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);

// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'CardWallet API is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;