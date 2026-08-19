import { Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthRequest } from '../middleware/authMiddleware';
import { CreateCardInput } from '../models/cardModel';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export const getCards = async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch cards' });
  }
};

export const createCard = async (req: AuthRequest, res: Response) => {
  try {
    const cardInput: CreateCardInput = req.body;

    const { data, error } = await supabase
      .from('cards')
      .insert([{ ...cardInput, user_id: req.user!.id }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create card' });
  }
};

export const updateCard = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const cardInput: CreateCardInput = req.body;

    const { data, error } = await supabase
      .from('cards')
      .update(cardInput)
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update card' });
  }
};

export const deleteCard = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;

    return res.status(200).json({ message: 'Card deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete card' });
  }
};

export const getCardById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch card' });
  }
};
