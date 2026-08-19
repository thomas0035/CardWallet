export interface Card {
  id: string;
  user_id: string;
  card_name: string;
  card_type: string;
  card_color: string;
  card_image_url: string;
  last_four_digits: string;
  card_holder_name: string;
  card_number_encrypted: string;
  cvv_encrypted: string;
  expiry_date: string;
  institution: string;
  id_number: string;
  club_name: string;
  notes: string;
  designation: string;
  phone: string;
  business_email: string;
  created_at: string;
}

export interface CreateCardInput {
  card_name: string;
  card_type: string;
  card_color?: string;
  card_image_url?: string;
  last_four_digits?: string;
  card_holder_name?: string;
  card_number_encrypted?: string;
  cvv_encrypted?: string;
  expiry_date?: string;
  institution?: string;
  id_number?: string;
  club_name?: string;
  notes?: string;
  designation?: string;
  phone?: string;
  business_email?: string;
}
