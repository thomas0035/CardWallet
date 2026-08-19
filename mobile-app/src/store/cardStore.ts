import { create } from 'zustand';

export interface Card {
  id: string;
  user_id: string;
  card_name: string;
  card_type: string;
  card_color: string | null;
  card_image_url: string | null;
  last_four_digits: string | null;
  card_holder_name: string | null;
  card_number_encrypted: string | null;
  cvv_encrypted: string | null;
  expiry_date: string | null;
  institution: string | null;
  id_number: string | null;
  club_name: string | null;
  notes: string | null;
  designation: string | null;
  phone: string | null;
  business_email: string | null;
  created_at: string;
}

interface CardState {
  cards: Card[];
  selectedCard: Card | null;
  setCards: (cards: Card[]) => void;
  addCard: (card: Card) => void;
  updateCard: (card: Card) => void;
  deleteCard: (id: string) => void;
  setSelectedCard: (card: Card | null) => void;
}

export const useCardStore = create<CardState>((set) => ({
  cards: [],
  selectedCard: null,
  setCards: (cards) => set({ cards }),
  addCard: (card) => set((state) => ({ cards: [card, ...state.cards] })),
  updateCard: (card) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === card.id ? card : c)),
    })),
  deleteCard: (id) =>
    set((state) => ({ cards: state.cards.filter((c) => c.id !== id) })),
  setSelectedCard: (card) => set({ selectedCard: card }),
}));
