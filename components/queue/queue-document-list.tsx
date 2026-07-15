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
}

export default function QueueDocumentsList({ documents }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Documents Requested</Text>

      {documents.length === 0 ? (
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
    marginTop: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.title,
    marginBottom: SPACING.sm,
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
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  itemAlt: {
    backgroundColor: COLORS.creamDark,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    marginRight: SPACING.sm,
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  qtyBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
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