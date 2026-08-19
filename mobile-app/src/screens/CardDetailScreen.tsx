import React, { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useCardStore } from '../store/cardStore';
import { api } from '../services/apiService';
import * as LocalAuthentication from 'expo-local-authentication';
import { formatExpiryDate } from '../utils/expiryDate';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CardDetail'>;
  route: RouteProp<RootStackParamList, 'CardDetail'>;
};

const FALLBACK_CARD_COLOR = '#6c47ff';

export default function CardDetailScreen({ navigation, route }: Props) {
  const { cardId } = route.params;
  const { cards, deleteCard } = useCardStore();
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const card = cards.find((c) => c.id === cardId);

  if (!card) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Card not found</Text>
      </View>
    );
  }

  const getCardColor = () => card.card_color || FALLBACK_CARD_COLOR;

  const handleReveal = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to reveal card details',
        fallbackLabel: 'Use passcode',
      });
      if (result.success) {
        setRevealed(true);
      } else {
        Alert.alert('Authentication failed', 'Could not verify your identity');
      }
    } catch (error) {
      Alert.alert('Error', 'Biometric authentication not available');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this card?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await api.delete(`/api/cards/${cardId}`);
              deleteCard(cardId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete card');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Dynamic card preview based on card type
  const renderCardPreview = () => {
    const color = getCardColor();

    if (card.card_type === 'Debit' || card.card_type === 'Credit') {
      return (
        <View style={[styles.card, { backgroundColor: color }]}>
          <Text style={styles.cardType}>{card.card_type}</Text>
          <Text style={styles.cardNumber}>
            {revealed && card.card_number_encrypted
              ? card.card_number_encrypted
              : `**** **** **** ${card.last_four_digits}`}
          </Text>
          <View style={styles.cardBottom}>
            <Text style={styles.cardHolder}>{card.card_holder_name}</Text>
            <Text style={styles.cardName}>{card.card_name}</Text>
          </View>
        </View>
      );
    }

    if (card.card_type === 'ID') {
      return (
        <View style={[styles.card, { backgroundColor: color }]}>
          <Text style={styles.cardType}>ID Card</Text>
          <Text style={styles.cardHolder}>{card.card_holder_name}</Text>
          <View style={styles.cardBottom}>
            <Text style={styles.cardName}>{card.institution}</Text>
            <Text style={styles.cardName}>{card.card_name}</Text>
          </View>
        </View>
      );
    }

    if (card.card_type === 'Membership') {
      return (
        <View style={[styles.card, { backgroundColor: color }]}>
          <Text style={styles.cardType}>Membership</Text>
          <Text style={styles.cardHolder}>{card.card_holder_name}</Text>
          <View style={styles.cardBottom}>
            <Text style={styles.cardName}>{card.club_name}</Text>
            <Text style={styles.cardName}>{card.card_name}</Text>
          </View>
        </View>
      );
    }

    if (card.card_type === 'Business') {
      return (
        <View style={[styles.card, { backgroundColor: color }]}>
          <Text style={styles.cardType}>Business</Text>
          <Text style={styles.cardHolder}>{card.card_holder_name}</Text>
          <View style={styles.cardBottom}>
            <Text style={styles.cardName}>{card.institution}</Text>
            <Text style={styles.cardName}>{card.designation}</Text>
          </View>
        </View>
      );
    }

    return null;
  };

  // Dynamic info rows based on card type
  const renderInfoRows = () => {
    if (card.card_type === 'Debit' || card.card_type === 'Credit') {
      return (
        <>
          <InfoRow label="Card Label" value={card.card_name} />
          <InfoRow label="Card Type" value={card.card_type} />
          <InfoRow label="Card Holder" value={card.card_holder_name} />
          {card.expiry_date && (
            <InfoRow
              label="Expiry Date"
              value={formatExpiryDate(card.expiry_date)}
            />
          )}
          {card.card_number_encrypted && (
            <InfoRow
              label="Card Number"
              value={revealed ? card.card_number_encrypted : '**** **** **** ****'}
            />
          )}
          {card.cvv_encrypted && (
            <InfoRow
              label="CVV"
              value={revealed ? card.cvv_encrypted : '***'}
            />
          )}
        </>
      );
    }

    if (card.card_type === 'ID') {
      return (
        <>
          <InfoRow label="Card Label" value={card.card_name} />
          <InfoRow label="Name" value={card.card_holder_name} />
          <InfoRow label="Institution" value={card.institution} />
          {card.id_number && (
            <InfoRow
              label="ID Number"
              value={revealed ? card.id_number : '••••••'}
            />
          )}
          {card.notes && (
            <InfoRow label="Notes" value={card.notes} />
          )}
        </>
      );
    }

    if (card.card_type === 'Membership') {
      return (
        <>
          <InfoRow label="Card Label" value={card.card_name} />
          <InfoRow label="Member Name" value={card.card_holder_name} />
          <InfoRow label="Club / Organization" value={card.club_name} />
          {card.id_number && (
            <InfoRow
              label="Membership ID"
              value={revealed ? card.id_number : '••••••'}
            />
          )}
          {card.notes && (
            <InfoRow label="Notes" value={card.notes} />
          )}
        </>
      );
    }

    if (card.card_type === 'Business') {
      return (
        <>
          <InfoRow label="Card Label" value={card.card_name} />
          <InfoRow label="Owner Name" value={card.card_holder_name} />
          <InfoRow label="Company" value={card.institution} />
          {card.designation && (
            <InfoRow label="Designation" value={card.designation} />
          )}
          {card.phone && (
            <InfoRow label="Phone" value={card.phone} />
          )}
          {card.business_email && (
            <InfoRow label="Email" value={card.business_email} />
          )}
        </>
      );
    }

    return null;
  };

  // Check if this card type has sensitive info to reveal
  const hasSensitiveInfo = () => {
    if (card.card_type === 'Debit' || card.card_type === 'Credit') {
      return !!(card.card_number_encrypted || card.cvv_encrypted);
    }
    if (card.card_type === 'ID' || card.card_type === 'Membership') {
      return !!card.id_number;
    }
    return false;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Card Details</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddCard', { cardId })}
          style={styles.editBtn}>
          <MaterialIcons name="edit" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {renderCardPreview()}

      <View style={styles.infoContainer}>
        {renderInfoRows()}
      </View>

      {hasSensitiveInfo() && !revealed && (
        <TouchableOpacity
          style={styles.revealButton}
          onPress={handleReveal}>
          <Text style={styles.revealButtonText}>🔒 Reveal Sensitive Details</Text>
        </TouchableOpacity>
      )}

      {revealed && (
        <View style={styles.revealedBadge}>
          <Text style={styles.revealedText}>🔓 Details Revealed</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.deleteButtonText}>Delete Card</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// Reusable info row component
const InfoRow = ({ label, value }: { label: string; value: string | null }) => {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  card: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    height: 180,
    justifyContent: 'space-between',
  },
  cardType: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  cardNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardHolder: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  cardName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  infoContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  infoLabel: {
    color: '#888',
    fontSize: 14,
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  revealButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6c47ff',
  },
  revealButtonText: {
    color: '#6c47ff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  revealedBadge: {
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#47ff9f',
  },
  revealedText: {
    color: '#47ff9f',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 48,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  backBtn: {
    padding: 8,
  },
  editBtn: {
    marginLeft: 'auto',
    padding: 8,
  },
});
