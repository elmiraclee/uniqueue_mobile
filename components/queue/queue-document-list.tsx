import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { COLORS, ICON_SIZES, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

interface DocumentItem {
  name: string;
  quantity: number;
}

interface Props {
  documents: DocumentItem[];
  eventStepTitle?: string | null;
  eventName?: string | null;
}

export default function QueueDocumentsList({ documents, eventStepTitle, eventName }: Props) {
  // Event-queue tickets can have a step with no documents attached at
  // all. In that case, show the event step's title instead — as its
  // own thing, not a fake "document" with a quantity — so there's
  // still something meaningful to see.
  const isStepFallback = documents.length === 0 && !!eventStepTitle;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isStepFallback ? 'Event Queue' : 'Documents Requested'}</Text>

      {isStepFallback ? (
        <View style={styles.card}>
          {!!eventName && (
            <View style={styles.item}>
              <Text style={styles.label}>Event Name</Text>
              <Text style={styles.value}>{eventName}</Text>
            </View>
          )}
          <View style={[styles.item, !!eventName && styles.itemAlt]}>
            <View style={styles.nameRow}>
              <Ionicons name="flag-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
              <Text style={styles.name}>{eventStepTitle}</Text>
            </View>
          </View>
        </View>
      ) : documents.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="document-outline" size={ICON_SIZES.lg} color={COLORS.gray} />
          <Text style={styles.empty}>No documents found.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {documents.map((doc, index) => (
            <View key={index} style={[styles.item, index % 2 === 1 && styles.itemAlt]}>
              <View style={styles.nameRow}>
                <Ionicons name="document-text-outline" size={ICON_SIZES.sm} color={COLORS.primary} />
                <Text style={styles.name}>{doc.name}</Text>
              </View>
              <View style={styles.qtyBadge}>
                <Text style={styles.qty}>x{doc.quantity}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.title,
    marginBottom: SPACING.xs + 2,
    color: COLORS.secondary,
  },
  card: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.sm,
    minHeight: 36,
  },
  itemAlt: {
    backgroundColor: COLORS.creamDark,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    flex: 1,
    marginRight: SPACING.sm,
  },
  name: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.text,
  },
  label: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray,
    textTransform: 'none',
    letterSpacing: 0,
  },
  value: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  qtyBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  qty: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  empty: {
    color: COLORS.gray,
    fontStyle: 'italic',
    fontSize: 13,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
});