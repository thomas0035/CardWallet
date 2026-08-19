import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { RegisterInput, LoginInput } from '../models/userModel';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const JWT_SECRET = process.env.JWT_SECRET!;

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password }: RegisterInput = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ email, password_hash }])
      .select()
      .single();

    if (error) throw error;

    // Generate JWT
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: { id: newUser.id, email: newUser.email },
    });
  } catch (error) {
    console.log('Registration error:', JSON.stringify(error));
    return res.status(500).json({ error: JSON.stringify(error) });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginInput = req.body;

    // Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed' });
  }
};
