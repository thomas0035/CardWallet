import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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

/** Card height (180) plus its bottom margin (16). One row's worth of travel. */
const CARD_HEIGHT = 180;
const CARD_GAP = 16;
const ITEM_PITCH = CARD_HEIGHT + CARD_GAP;

/**
 * Movement below this is treated as a long-press-and-release rather than a
 * drag, so a slightly shaky finger still opens selection mode.
 */
const DRAG_SLOP = 12;

/** How long the finger must be held before a card lifts for dragging. */
const LONG_PRESS_MS = 300;

/** Movement before the long-press fires that means "you are scrolling". */
const SCROLL_SLOP = 8;

/**
 * Callbacks a card needs from the screen. Passed through a ref so each card's
 * PanResponder can be created once and still see current state.
 */
interface CardGestureHandlers {
  onArm: (id: string, index: number) => void;
  onDragMove: (dy: number) => void;
  onDragRelease: (moved: boolean) => void;
  onCancel: () => void;
  onTap: (id: string) => void;
  isArmed: () => boolean;
}

/**
 * One card tile, owning its own gesture.
 *
 * The whole gesture is handled by a PanResponder with a hand-rolled long-press
 * timer rather than a Pressable. Pressable fires onPressOut the moment its
 * subtree re-renders with a new zIndex — which is exactly what lifting a card
 * does — so a drag was being reported as a release before the finger moved,
 * and every long-press fell through to selection.
 */
function DraggableCard({
  card,
  index,
  isDragging,
  isSelected,
  selectionMode,
  shift,
  dragY,
  handlers,
}: {
  card: Card;
  index: number;
  isDragging: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  shift: number;
  dragY: Animated.Value;
  handlers: React.RefObject<CardGestureHandlers>;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedRef = useRef(false);
  const movedRef = useRef(false);

  // Neighbours ease into their new places instead of teleporting a full row
  // the instant the drag target changes.
  const shiftAnim = useRef(new Animated.Value(0)).current;
  // Drives the lift: shadow and inset, animated so picking a card up and
  // putting it down both read as movement rather than a state flip.
  const liftAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(shiftAnim, {
      toValue: shift,
      useNativeDriver: true,
      friction: 12,
      tension: 90,
    }).start();
  }, [shift, shiftAnim]);

  React.useEffect(() => {
    Animated.timing(liftAnim, {
      toValue: isDragging ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [isDragging, liftAnim]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim the touch immediately. The ScrollView can still take it back
        // on movement via onPanResponderTerminationRequest below, which is how
        // scrolling continues to work while a finger starts on a card.
        onStartShouldSetPanResponder: () => true,

        // Refuse to hand the touch to the ScrollView once a card is lifted,
        // otherwise the list would scroll out from under the drag.
        onPanResponderTerminationRequest: () => !armedRef.current,

        onPanResponderGrant: () => {
          armedRef.current = false;
          movedRef.current = false;
          clearTimer();
          timerRef.current = setTimeout(() => {
            armedRef.current = true;
            handlers.current?.onArm(card.id, index);
          }, LONG_PRESS_MS);
        },

        onPanResponderMove: (_event, gesture) => {
          if (!armedRef.current) {
            // Moving before the long-press fires means a scroll, not a drag.
            if (
              Math.abs(gesture.dy) > SCROLL_SLOP ||
              Math.abs(gesture.dx) > SCROLL_SLOP
            ) {
              clearTimer();
            }
            return;
          }

          if (Math.abs(gesture.dy) > DRAG_SLOP) movedRef.current = true;
          handlers.current?.onDragMove(gesture.dy);
        },

        onPanResponderRelease: (_event, gesture) => {
          clearTimer();

          if (!armedRef.current) {
            // Released before the long-press fired, and never moved: a tap.
            if (
              Math.abs(gesture.dy) <= SCROLL_SLOP &&
              Math.abs(gesture.dx) <= SCROLL_SLOP
            ) {
              handlers.current?.onTap(card.id);
            }
            return;
          }

          armedRef.current = false;
          handlers.current?.onDragRelease(movedRef.current);
        },

        onPanResponderTerminate: () => {
          clearTimer();
          if (armedRef.current) {
            armedRef.current = false;
            handlers.current?.onCancel();
          }
        },
      }),
    [card.id, index, handlers]
  );

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        isDragging
          ? {
              // Deliberately no scale. Growing the card pushed it past the
              // screen's 24px side padding, so it appeared to burst out of
              // the app's edges. The lift is conveyed by shadow instead.
              transform: [{ translateY: dragY }],
              zIndex: 10,
              elevation: 12,
              shadowColor: '#000',
              shadowOpacity: 0.55,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
            }
          : { transform: [{ translateY: shiftAnim }] },
      ]}
      {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: card.card_color || FALLBACK_CARD_COLOR },
          isSelected && styles.cardSelected,
          {
            // A slight inset while lifted reads as depth without changing the
            // card's footprint, so nothing can overflow sideways.
            transform: [
              {
                scale: liftAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.97],
                }),
              },
            ],
          },
        ]}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardType}>{card.card_type}</Text>
          {selectionMode && (
            <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
              {isSelected && <MaterialIcons name="check" size={16} color="#fff" />}
            </View>
          )}
        </View>
        <Text style={styles.cardNumber}>{cardSubtitle(card)}</Text>
        <View style={styles.cardBottom}>
          <Text style={styles.cardHolder}>{card.card_holder_name}</Text>
          <Text style={styles.cardName}>{card.card_name}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** The subtitle line on a card tile, which differs per card type. */
function cardSubtitle(card: Card): string {
  switch (card.card_type) {
    case 'Debit':
    case 'Credit':
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
  const { cards, setCards, deleteCards } = useCardStore();

  // Selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Drag-to-reorder
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const dragY = useRef(new Animated.Value(0)).current;

  // Refs mirror the drag state because the PanResponder is created once and
  // would otherwise close over stale values.
  const dragRef = useRef<{ id: string; index: number } | null>(null);
  const movedRef = useRef(false);
  const targetRef = useRef(0);
  const cardsRef = useRef<Card[]>(cards);
  cardsRef.current = cards;

  const fetchCards = useCallback(async () => {
    try {
      // RLS restricts this to the signed-in user's rows. created_at is the
      // tiebreaker so ordering stays stable if two rows share a sort_order.
      const { data, error: queryError } = await supabase
        .from('cards')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      setCards(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(dataErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setCards]);

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
    setCards([]);
    await supabase.auth.signOut();
  };

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Leaving selection mode when the last card is deselected keeps the
      // header from sitting in "0 selected" with nothing to act on.
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const handleCardPress = useCallback(
    (card: Card) => {
      if (selectionMode) {
        toggleSelected(card.id);
      } else {
        navigation.navigate('CardDetail', { cardId: card.id });
      }
    },
    [selectionMode, toggleSelected, navigation]
  );

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    Alert.alert(
      ids.length === 1 ? 'Delete card' : `Delete ${ids.length} cards`,
      ids.length === 1
        ? 'This cannot be undone.'
        : `These ${ids.length} cards will be deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error: deleteError } = await supabase
                .from('cards')
                .delete()
                .in('id', ids);

              if (deleteError) throw deleteError;

              deleteCards(ids);
              exitSelection();
            } catch (err) {
              Alert.alert('Failed to delete', dataErrorMessage(err));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------------------
  // Reordering
  // -------------------------------------------------------------------------

  /**
   * Write the new positions back.
   *
   * The whole list is renumbered 0..n-1 rather than patching the moved card
   * alone, which keeps the values dense and avoids ties accumulating over
   * time. The list is personal-sized, so the write count is not a concern.
   */
  const persistOrder = useCallback(
    async (ordered: Card[]) => {
      const changed = ordered
        .map((card, index) => ({ card, index }))
        .filter(({ card, index }) => card.sort_order !== index);

      if (changed.length === 0) return;

      try {
        await Promise.all(
          changed.map(({ card, index }) =>
            supabase.from('cards').update({ sort_order: index }).eq('id', card.id)
          )
        );
      } catch (err) {
        Alert.alert('Could not save the new order', dataErrorMessage(err));
        // Pull the authoritative order back so the screen cannot drift from
        // what is actually stored.
        fetchCards();
      }
    },
    [fetchCards]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    movedRef.current = false;
    dragY.setValue(0);
    setDraggingId(null);
  }, [dragY]);

  const commitDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) {
      endDrag();
      return;
    }

    const from = drag.index;
    const to = targetRef.current;

    if (from !== to) {
      const next = [...cardsRef.current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      // Update local sort_order immediately so the list does not flicker back
      // to the old order while the writes are in flight.
      const renumbered = next.map((card, index) => ({ ...card, sort_order: index }));
      setCards(renumbered);
      persistOrder(renumbered);
    }

    endDrag();
  }, [setCards, persistOrder, endDrag]);

  const beginDrag = useCallback(
    (id: string, index: number) => {
      dragRef.current = { id, index };
      movedRef.current = false;
      targetRef.current = index;
      setTargetIndex(index);
      dragY.setValue(0);
      setDraggingId(id);
    },
    [dragY]
  );

  const selectOne = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds((previous) => new Set(previous).add(id));
  }, []);

  /**
   * Held in a ref so each card's PanResponder is built once and still calls
   * the current versions of these, rather than closing over stale state.
   */
  const handlersRef = useRef<CardGestureHandlers>(null as never);
  handlersRef.current = {
    isArmed: () => dragRef.current !== null,

    onArm: beginDrag,

    onDragMove: (dy) => {
      const drag = dragRef.current;
      if (!drag) return;

      dragY.setValue(dy);

      const total = cardsRef.current.length;
      const offset = Math.round(dy / ITEM_PITCH);
      const next = Math.min(Math.max(drag.index + offset, 0), total - 1);

      if (next !== targetRef.current) {
        targetRef.current = next;
        setTargetIndex(next);
      }
    },

    onDragRelease: (moved) => {
      const drag = dragRef.current;

      // Held long enough to lift the card but never moved: that is the
      // long-press-and-release gesture, so select it instead of reordering.
      if (!moved) {
        if (drag) selectOne(drag.id);
        endDrag();
        return;
      }

      if (!drag) {
        commitDrag();
        return;
      }

      // Glide the lifted card into the slot it will occupy before rewriting
      // the list. Committing straight away would teleport it there, since the
      // reorder resets the drag offset to zero in one frame.
      const resting = (targetRef.current - drag.index) * ITEM_PITCH;

      Animated.spring(dragY, {
        toValue: resting,
        useNativeDriver: true,
        friction: 14,
        tension: 100,
      }).start(() => commitDrag());
    },

    onCancel: endDrag,

    onTap: (id) => {
      const card = cardsRef.current.find((c) => c.id === id);
      if (card) handleCardPress(card);
    },
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const renderCard = (card: Card, index: number) => {
    const isDragging = draggingId === card.id;

    // While one card is lifted, the others slide to open a gap at the target.
    let shift = 0;
    if (draggingId && !isDragging) {
      const from = dragRef.current?.index ?? index;
      if (from < targetIndex && index > from && index <= targetIndex) {
        shift = -ITEM_PITCH;
      } else if (from > targetIndex && index >= targetIndex && index < from) {
        shift = ITEM_PITCH;
      }
    }

    return (
      <DraggableCard
        key={card.id}
        card={card}
        index={index}
        isDragging={isDragging}
        isSelected={selectedIds.has(card.id)}
        selectionMode={selectionMode}
        shift={shift}
        dragY={dragY}
        handlers={handlersRef}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {selectionMode ? (
          <>
            <TouchableOpacity onPress={exitSelection} hitSlop={12}>
              <MaterialIcons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>{selectedIds.size} selected</Text>
            <TouchableOpacity
              onPress={handleDeleteSelected}
              disabled={deleting}
              hitSlop={12}>
              {deleting ? (
                <ActivityIndicator color="#ff6b6b" />
              ) : (
                <MaterialIcons name="delete-outline" size={26} color="#ff6b6b" />
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>My Cards</Text>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.logout}>Logout</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#6c47ff" size="large" />
      ) : error ? (
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
        <ScrollView
          // A plain ScrollView rather than a FlatList: the list is personal-
          // sized, and virtualisation recycling rows fights the drag transforms.
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!draggingId}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              enabled={!draggingId}
              tintColor="#6c47ff"
              colors={['#6c47ff']}
            />
          }>
          {cards.map(renderCard)}
        </ScrollView>
      )}

      {!selectionMode && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddCard')}>
          <Text style={styles.addButtonText}>+ Add Card</Text>
        </TouchableOpacity>
      )}

      {draggingId && (
        <View style={styles.dragHint} pointerEvents="none">
          <Text style={styles.dragHintText}>Drag to reorder · release to select</Text>
        </View>
      )}
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
  cardWrapper: {
    marginBottom: CARD_GAP,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    height: CARD_HEIGHT,
    justifyContent: 'space-between',
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderColor: '#fff',
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
  dragHint: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  dragHintText: {
    color: '#888',
    fontSize: 13,
  },
});
