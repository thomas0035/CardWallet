import { create } from 'zustand';
import { clearCachedKey } from '../services/crypto';

/**
 * Holds the wallet encryption key for the running session.
 *
 * The key lives in memory only. It is also cached in expo-secure-store so the
 * passphrase is not needed on every launch, but this store is what screens
 * read from — nothing reaches into SecureStore directly except the crypto
 * service.
 */
interface WalletState {
  key: Uint8Array | null;
  /** False until we have checked SecureStore for a cached key at startup. */
  checked: boolean;

  setKey: (key: Uint8Array) => void;
  setChecked: (checked: boolean) => void;
  /** Forget the key in memory and on the device. */
  lock: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  key: null,
  checked: false,

  setKey: (key) => set({ key, checked: true }),
  setChecked: (checked) => set({ checked }),

  lock: async () => {
    set({ key: null });
    await clearCachedKey();
  },
}));
