import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Card, useCardStore } from '../store/cardStore';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/apiService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

const FALLBACK_CARD_COLOR = '#6c47ff';

export default function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const { cards, setCards } = useCardStore();
  const { clearAuth } = useAuthStore();

  const fetchCards = async () => {
    try {
      const data = await api.get('/api/cards');
      setCards(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleLogout = async () => {
    clearAuth();
    navigation.replace('Login');
  };

  const renderCard = ({ item }: { item: Card }) => {
    const cardColor = item.card_color || FALLBACK_CARD_COLOR;
    const isBusinessCard = item.card_type === 'Business';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardColor }]}
        onPress={() => navigation.navigate('CardDetail', { cardId: item.id })}>
        <Text style={styles.cardType}>{item.card_type}</Text>
        <Text style={styles.cardNumber}>
          {isBusinessCard
            ? item.phone || item.institution || item.designation || item.card_name
            : `**** **** **** ${item.last_four_digits}`}
        </Text>
        <View style={styles.cardBottom}>
          <Text style={styles.cardHolder}>{item.card_holder_name}</Text>
          <Text style={styles.cardName}>{item.card_name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Cards</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#6c47ff" size="large" />
      ) : cards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No cards yet</Text>
          <Text style={styles.emptySubtext}>Add your first card below</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddCard')}>
        <Text style={styles.addButtonText}>+ Add Card</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  logout: {
    color: '#888',
    fontSize: 14,
  },
  list: {
    paddingBottom: 100,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
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
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
  },
  addButton: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: '#6c47ff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
