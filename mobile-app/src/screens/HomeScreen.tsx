import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Card, useCardStore } from '../store/cardStore';
import { supabase } from '../config/supabase';
import { dataErrorMessage } from '../utils/errorMessages';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

const FALLBACK_CARD_COLOR = '#6c47ff';

/** The subtitle line on a card tile, which differs per card type. */
function cardSubtitle(card: Card): string {
  switch (card.card_type) {
    case 'Debit':
    case 'Credit':
      // Previously every type rendered this, so ID and Membership cards showed
      // the literal text "**** **** **** null".
      return card.last_four_digits
        ? `**** **** **** ${card.last_four_digits}`
        : '•••• •••• •••• ••••';
    case 'Business':
      return card.phone || card.institution || card.designation || card.card_name;
    case 'ID':
      return card.id_number || card.institution || card.card_name;
    case 'Membership':
      return card.id_number || card.club_name || card.card_name;
    default:
      return card.card_name;
  }
}

export default function HomeScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { cards, setCards } = useCardStore();

  const fetchCards = useCallback(async () => {
    try {
      // No user_id filter needed — the RLS policies in supabase/schema.sql
      // restrict this to the signed-in user's rows, enforced by Postgres.
      const { data, error: queryError } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      // Guard the type rather than trusting the response. The old apiService
      // never checked response.ok, so an error body could be handed to
      // setCards as if it were a list.
      setCards(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(dataErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setCards]);

  // Refetch whenever the screen regains focus, so edits made elsewhere (or on
  // another device) show up without restarting the app.
  useFocusEffect(
    useCallback(() => {
      fetchCards();
    }, [fetchCards])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCards();
  }, [fetchCards]);

  const handleLogout = async () => {
    // Clear the cards first: signOut swaps the navigator, and stale rows from
    // the previous session must not be visible to whoever signs in next.
    setCards([]);
    await supabase.auth.signOut();
  };

  const renderCard = ({ item }: { item: Card }) => {
    const cardColor = item.card_color || FALLBACK_CARD_COLOR;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardColor }]}
        onPress={() => navigation.navigate('CardDetail', { cardId: item.id })}>
        <Text style={styles.cardType}>{item.card_type}</Text>
        <Text style={styles.cardNumber}>{cardSubtitle(item)}</Text>
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
      ) : error ? (
        // A failed fetch used to fall through to the empty state, telling the
        // user they had no cards when the request had simply failed.
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#6c47ff"
              colors={['#6c47ff']}
            />
          }
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
  errorText: {
    color: '#ff6b6b',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 24,
    lineHeight: 21,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: '#6c47ff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#6c47ff',
    fontSize: 15,
    fontWeight: '600',
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
