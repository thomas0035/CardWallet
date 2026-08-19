import { Router } from 'express';
import {
  getCards,
  createCard,
  updateCard,
  deleteCard,
  getCardById,
} from '../controllers/cardController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// All card routes are protected
router.use(authenticate);

router.get('/', getCards);
router.get('/:id', getCardById);
router.post('/', createCard);
router.put('/:id', updateCard);
router.delete('/:id', deleteCard);

export default router;
