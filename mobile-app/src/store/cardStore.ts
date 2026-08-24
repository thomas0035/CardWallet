import { create } from 'zustand';

/** A row of the `cards` table. Mirrors supabase/schema.sql. */
export interface Card {
  id: string;
  user_id: string;
  card_name: string;
  card_type: 'Debit' | 'Credit' | 'ID' | 'Membership' | 'Business';
  card_color: string | null;

  // Debit / Credit
  last_four_digits: string | null;
  card_holder_name: string | null;
  /**
   * Ciphertext, not a card number. Held plaintext by earlier versions of this
   * app despite the name; encrypted on-device from Phase 5 onward.
   */
  card_number_encrypted: string | null;
  expiry_date: string | null;

  // ID / Membership
  institution: string | null;
  id_number: string | null;
  club_name: string | null;

  // Business
  designation: string | null;
  phone: string | null;
  business_email: string | null;

  notes: string | null;
  /** Manual display order, ascending. See supabase/003_add_sort_order.sql. */
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CardState {
  cards: Card[];
  setCards: (cards: Card[]) => void;
  addCard: (card: Card) => void;
  updateCard: (card: Card) => void;
  deleteCard: (id: string) => void;
  deleteCards: (ids: string[]) => void;
}

export const useCardStore = create<CardState>((set) => ({
  cards: [],
  setCards: (cards) => set({ cards }),
  // Prepend, to match the created_at DESC ordering the list is fetched with.
  addCard: (card) => set((state) => ({ cards: [card, ...state.cards] })),
  updateCard: (card) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === card.id ? card : c)),
    })),
  deleteCard: (id) =>
    set((state) => ({ cards: state.cards.filter((c) => c.id !== id) })),
  deleteCards: (ids) =>
    set((state) => {
      const removing = new Set(ids);
      return { cards: state.cards.filter((c) => !removing.has(c.id)) };
    }),
}));
