import React, { useEffect, useRef, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  PanResponder,
  Keyboard,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../config/supabase';
import { useCardStore } from '../store/cardStore';
import { useWalletStore } from '../store/walletStore';
import { decryptField, encryptField } from '../services/crypto';
import { formatExpiryDate } from '../utils/expiryDate';
import { dataErrorMessage } from '../utils/errorMessages';
import {
  isBlank,
  isValidCardNumber,
  isValidExpiryDate,
  normalizeCardNumber,
} from '../utils/validation';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddCard'>;
  route: RouteProp<RootStackParamList, 'AddCard'>;
};

const DEFAULT_CARD_HUE = 254;
const HUE_SEGMENT_COUNT = 96;

const hueToHex = (hue: number) => {
  const saturation = 100;
  const lightness = 58;
  const chroma = (1 - Math.abs((2 * lightness) / 100 - 1)) * (saturation / 100);
  const hueSegment = hue / 60;
  const x = chroma * (1 - Math.abs((hueSegment % 2) - 1));
  const match = lightness / 100 - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSegment >= 0 && hueSegment < 1) {
    red = chroma;
    green = x;
  } else if (hueSegment >= 1 && hueSegment < 2) {
    red = x;
    green = chroma;
  } else if (hueSegment >= 2 && hueSegment < 3) {
    green = chroma;
    blue = x;
  } else if (hueSegment >= 3 && hueSegment < 4) {
    green = x;
    blue = chroma;
  } else if (hueSegment >= 4 && hueSegment < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const toHex = (value: number) =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const HUE_BAR_COLORS = Array.from({ length: HUE_SEGMENT_COUNT }, (_, index) =>
  hueToHex((index / (HUE_SEGMENT_COUNT - 1)) * 360)
);

const hexToHue = (hex: string | null | undefined) => {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return DEFAULT_CARD_HUE;

  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  if (delta === 0) return DEFAULT_CARD_HUE;
  if (max === red) return Math.round(60 * (((green - blue) / delta) % 6));
  if (max === green) return Math.round(60 * ((blue - red) / delta + 2));
  return Math.round(60 * ((red - green) / delta + 4));
};

export default function AddCardScreen({ navigation, route }: Props) {
  const editingCardId = route.params?.cardId;
  const [cardType, setCardType] = useState('Debit');
  const [cardLabel, setCardLabel] = useState('');
  const [selectedHue, setSelectedHue] = useState(DEFAULT_CARD_HUE);
  const [selectedColor, setSelectedColor] = useState(hueToHex(DEFAULT_CARD_HUE));
  const [colorBarWidth, setColorBarWidth] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const { cards, addCard, updateCard } = useCardStore();
  const editingCard = cards.find((card) => card.id === editingCardId);
  const isEditing = !!editingCard;
  const walletKey = useWalletStore((state) => state.key);

  // Debit/Credit fields
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // ID fields
  const [idName, setIdName] = useState('');
  const [idInstitution, setIdInstitution] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idNotes, setIdNotes] = useState('');

  // Membership fields
  const [memberName, setMemberName] = useState('');
  const [clubName, setClubName] = useState('');
  const [membershipId, setMembershipId] = useState('');
  const [membershipNotes, setMembershipNotes] = useState('');

  // Business fields
  const [businessName, setBusinessName] = useState('');
  const [businessInstitution, setBusinessInstitution] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');

  const cardTypes = ['Debit', 'Credit', 'ID', 'Membership', 'Business'];

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!editingCard) return;

    const nextHue = hexToHue(editingCard.card_color);
    setCardType(editingCard.card_type);
    setCardLabel(editingCard.card_name);
    setSelectedHue(nextHue < 0 ? nextHue + 360 : nextHue);
    setSelectedColor(editingCard.card_color || hueToHex(DEFAULT_CARD_HUE));

    // Only populate the field set belonging to this card's own type.
    //
    // Previously all four sets were filled from the same columns regardless of
    // type — every name from card_holder_name, both ID and Membership numbers
    // from id_number. Switching type mid-edit then carried those values across
    // and wrote them into the wrong columns on save.
    switch (editingCard.card_type) {
      case 'Debit':
      case 'Credit':
        setCardHolderName(editingCard.card_holder_name || '');
        setExpiryDate(editingCard.expiry_date || '');

        if (editingCard.card_number_encrypted && walletKey) {
          try {
            setCardNumber(decryptField(editingCard.card_number_encrypted, walletKey));
          } catch {
            // Wrong key, or the row was written by a different wallet. Leave
            // the field empty rather than filling it with unusable ciphertext,
            // which would otherwise be saved back over the real number.
            setCardNumber('');
          }
        } else {
          setCardNumber('');
        }
        break;
      case 'ID':
        setIdName(editingCard.card_holder_name || '');
        setIdInstitution(editingCard.institution || '');
        setIdNumber(editingCard.id_number || '');
        setIdNotes(editingCard.notes || '');
        break;
      case 'Membership':
        setMemberName(editingCard.card_holder_name || '');
        setClubName(editingCard.club_name || '');
        setMembershipId(editingCard.id_number || '');
        setMembershipNotes(editingCard.notes || '');
        break;
      case 'Business':
        setBusinessName(editingCard.card_holder_name || '');
        setBusinessInstitution(editingCard.institution || '');
        setDesignation(editingCard.designation || '');
        setPhone(editingCard.phone || '');
        setBusinessEmail(editingCard.business_email || '');
        break;
    }
  }, [editingCard, walletKey]);

  const handleExpiryDateChange = (value: string) => {
    setExpiryDate(formatExpiryDate(value));
  };

  const handleInputFocus = (target: unknown) => {
    if (!target) return;
    const nativeTarget = target as number;

    setTimeout(() => {
      scrollViewRef.current
        ?.getScrollResponder()
        ?.scrollResponderScrollNativeHandleToKeyboard(nativeTarget, 28, true);
    }, Platform.OS === 'ios' ? 160 : 220);
  };

  const updateSelectedColor = (locationX: number) => {
    const width = Math.max(colorBarWidth, 1);
    const nextHue = Math.round((Math.min(Math.max(locationX, 0), width) / width) * 360);
    setSelectedHue(nextHue);
    setSelectedColor(hueToHex(nextHue));
  };

  const colorPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      updateSelectedColor(event.nativeEvent.locationX);
    },
    onPanResponderMove: (event) => {
      updateSelectedColor(event.nativeEvent.locationX);
    },
  });

  const handleAddCard = async () => {
    // All required-field checks below use isBlank rather than a falsy test, so
    // a field containing only spaces no longer counts as filled in.
    if (isBlank(cardLabel)) {
      Alert.alert('Error', 'Please enter a Card Label');
      return;
    }

    let payload: Record<string, unknown> = {
      card_type: cardType,
      card_name: cardLabel.trim(),
      card_color: selectedColor,
    };

    if (cardType === 'Debit' || cardType === 'Credit') {
      if (isBlank(cardHolderName) || isBlank(cardNumber)) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }
      if (!isValidCardNumber(cardNumber)) {
        Alert.alert(
          'Error',
          'That card number is not valid. Check the digits and try again.'
        );
        return;
      }
      if (!isBlank(expiryDate) && !isValidExpiryDate(expiryDate)) {
        Alert.alert('Error', 'Enter the expiry as MM/YY, and not in the past.');
        return;
      }

      const digits = normalizeCardNumber(cardNumber);

      if (!walletKey) {
        Alert.alert('Wallet locked', 'Unlock your wallet before saving a card.');
        return;
      }

      payload = {
        ...payload,
        card_holder_name: cardHolderName.trim(),
        // Kept in the clear on purpose: it is what the card list shows, and
        // four digits identify nothing on their own.
        last_four_digits: digits.slice(-4),
        // Encrypted here, on the device. Supabase only ever receives ciphertext.
        card_number_encrypted: encryptField(digits, walletKey),
        expiry_date: expiryDate.trim() || null,
      };
    } else if (cardType === 'ID') {
      if (isBlank(idName) || isBlank(idInstitution)) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }
      payload = {
        ...payload,
        card_holder_name: idName.trim(),
        institution: idInstitution.trim(),
        id_number: idNumber.trim() || null,
        notes: idNotes.trim() || null,
      };
    } else if (cardType === 'Membership') {
      if (isBlank(memberName) || isBlank(clubName)) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }
      payload = {
        ...payload,
        card_holder_name: memberName.trim(),
        club_name: clubName.trim(),
        id_number: membershipId.trim() || null,
        notes: membershipNotes.trim() || null,
      };
    } else if (cardType === 'Business') {
      if (isBlank(businessName) || isBlank(businessInstitution)) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }
      payload = {
        ...payload,
        card_holder_name: businessName.trim(),
        institution: businessInstitution.trim(),
        designation: designation.trim() || null,
        phone: phone.trim() || null,
        business_email: businessEmail.trim() || null,
      };
    }

    setLoading(true);
    try {
      // user_id is not sent: the column defaults to auth.uid() and the RLS
      // policies reject anything else, so ownership is set by Postgres.
      const { data, error } = isEditing
        ? await supabase
            .from('cards')
            .update(payload)
            .eq('id', editingCardId!)
            .select()
            .single()
        : await supabase.from('cards').insert(payload).select().single();

      if (error) throw error;

      if (isEditing) {
        updateCard(data);
      } else {
        addCard(data);
      }

      Alert.alert('Success', `Card ${isEditing ? 'updated' : 'added'} successfully!`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(
        `Failed to ${isEditing ? 'update' : 'add'} card`,
        dataErrorMessage(error)
      );
    } finally {
      setLoading(false);
    }
  };

  const renderDebitCreditFields = () => (
  <>
    <Text style={styles.label}>Card Holder Name *</Text>
    <TextInput
      style={styles.input}
      placeholderTextColor="#888"
      placeholder=""
      value={cardHolderName}
      onChangeText={setCardHolderName}
      onFocus={(event) => handleInputFocus(event.target)}
      autoCapitalize="words"
    />
    <Text style={styles.label}>Card Number *</Text>
    <TextInput
      style={styles.input}
      placeholderTextColor="#888"
      placeholder=""
      value={cardNumber}
      onChangeText={setCardNumber}
      onFocus={(event) => handleInputFocus(event.target)}
      keyboardType="numeric"
      maxLength={19}
    />
    <Text style={styles.label}>Expiry Date</Text>
    <TextInput
      style={styles.input}
      placeholderTextColor="#888"
      placeholder="MM/YY"
      value={expiryDate}
      onChangeText={handleExpiryDateChange}
      onFocus={(event) => handleInputFocus(event.target)}
      keyboardType="numeric"
      maxLength={5}
    />
    {/*
      The CVV input was removed deliberately. PCI-DSS prohibits storing the
      CVV after authorization, and it was being written to the database in
      plaintext. It also gains nothing here: a stored CVV only helps someone
      who already has the card number.
    */}
  </>
);

  const renderIDFields = () => (
    <>
      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={idName}
        onChangeText={setIdName}
        onFocus={(event) => handleInputFocus(event.target)}
        autoCapitalize="words"
      />
      <Text style={styles.label}>Institution *</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={idInstitution}
        onChangeText={setIdInstitution}
        onFocus={(event) => handleInputFocus(event.target)}
      />
      <Text style={styles.label}>ID Number</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={idNumber}
        onChangeText={setIdNumber}
        onFocus={(event) => handleInputFocus(event.target)}
      />
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholderTextColor="#888"
        placeholder=""
        value={idNotes}
        onChangeText={setIdNotes}
        onFocus={(event) => handleInputFocus(event.target)}
        multiline
        numberOfLines={3}
      />
    </>
  );

  const renderMembershipFields = () => (
    <>
      <Text style={styles.label}>Member Name *</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={memberName}
        onChangeText={setMemberName}
        onFocus={(event) => handleInputFocus(event.target)}
        autoCapitalize="words"
      />
      <Text style={styles.label}>Club / Organization Name *</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={clubName}
        onChangeText={setClubName}
        onFocus={(event) => handleInputFocus(event.target)}
      />
      <Text style={styles.label}>Membership ID</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={membershipId}
        onChangeText={setMembershipId}
        onFocus={(event) => handleInputFocus(event.target)}
      />
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholderTextColor="#888"
        placeholder=""
        value={membershipNotes}
        onChangeText={setMembershipNotes}
        onFocus={(event) => handleInputFocus(event.target)}
        multiline
        numberOfLines={3}
      />
    </>
  );

  const renderBusinessFields = () => (
    <>
      <Text style={styles.label}>Owner Name *</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={businessName}
        onChangeText={setBusinessName}
        onFocus={(event) => handleInputFocus(event.target)}
        autoCapitalize="words"
      />
      <Text style={styles.label}>Company / Institution *</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={businessInstitution}
        onChangeText={setBusinessInstitution}
        onFocus={(event) => handleInputFocus(event.target)}
      />
      <Text style={styles.label}>Designation</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={designation}
        onChangeText={setDesignation}
        onFocus={(event) => handleInputFocus(event.target)}
      />
      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={phone}
        onChangeText={setPhone}
        onFocus={(event) => handleInputFocus(event.target)}
        keyboardType="phone-pad"
      />
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#888"
        placeholder=""
        value={businessEmail}
        onChangeText={setBusinessEmail}
        onFocus={(event) => handleInputFocus(event.target)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
    </>
  );

  return (
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardHeight ? keyboardHeight + 56 : 48 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}>
            <MaterialIcons name="arrow-back-ios" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Edit Card' : 'Add Card'}</Text>
        </View>

        <Text style={styles.label}>Card Type *</Text>
        <View style={styles.typeContainer}>
          {cardTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeButton,
                cardType === type && styles.typeButtonActive,
              ]}
              onPress={() => setCardType(type)}>
              <Text
                style={[
                  styles.typeButtonText,
                  cardType === type && styles.typeButtonTextActive,
                ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Card Label *</Text>
        <TextInput
          style={styles.input}
          placeholderTextColor="#888"
          placeholder=""
          value={cardLabel}
          onChangeText={setCardLabel}
          onFocus={(event) => handleInputFocus(event.target)}
        />

        <Text style={styles.label}>Card Color *</Text>
        <View style={styles.colorPicker}>
          <View style={styles.colorPreviewRow}>
            <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
            <Text style={styles.colorValue}>{selectedColor.toUpperCase()}</Text>
          </View>
          <View
            style={styles.colorBarWrapper}
            onLayout={(event) => setColorBarWidth(event.nativeEvent.layout.width)}
          >
            <View style={styles.colorBarTrack} pointerEvents="none">
              {HUE_BAR_COLORS.map((color, index) => (
                <View
                  key={`${color}-${index}`}
                  style={[styles.hueSegment, { backgroundColor: color }]}
                />
              ))}
            </View>
            <View style={styles.colorTouchArea} {...colorPanResponder.panHandlers} />
            <View
              pointerEvents="none"
              style={[
                styles.colorThumb,
                {
                  left: colorBarWidth
                    ? (selectedHue / 360) * colorBarWidth
                    : 0,
                },
              ]}
            />
          </View>
        </View>

        {(cardType === 'Debit' || cardType === 'Credit') && renderDebitCreditFields()}
        {cardType === 'ID' && renderIDFields()}
        {cardType === 'Membership' && renderMembershipFields()}
        {cardType === 'Business' && renderBusinessFields()}

        <TouchableOpacity
          style={styles.button}
          onPress={handleAddCard}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isEditing ? 'Save Changes' : 'Add Card'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
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
  label: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  typeButtonActive: {
    backgroundColor: '#6c47ff',
    borderColor: '#6c47ff',
  },
  typeButtonText: {
    color: '#888',
    fontSize: 14,
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  colorPicker: {
    marginBottom: 16,
  },
  colorPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  colorPreview: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fff',
  },
  colorValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  colorBarWrapper: {
    height: 34,
    position: 'relative',
    justifyContent: 'center',
  },
  colorBarTrack: {
    height: 34,
    borderRadius: 17,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  colorTouchArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  hueSegment: {
    flex: 1,
  },
  colorThumb: {
    position: 'absolute',
    top: -3,
    width: 12,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fff',
    zIndex: 3,
    transform: [{ translateX: -6 }],
  },
  button: {
    width: '100%',
    backgroundColor: '#6c47ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 48,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backBtn: {
    padding: 8,
  },
});
