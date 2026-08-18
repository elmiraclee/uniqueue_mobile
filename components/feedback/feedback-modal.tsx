import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { API } from '../../constants/backend';
import {
    COLORS,
    OPACITY,
    RADIUS,
    SHADOWS,
    SPACING,
    TYPOGRAPHY,
} from '../../constants/theme';

// Matches the "transaction" object returned by get_pending_feedback.php
export interface PendingFeedbackTransaction {
  ticket_id: number;
  queue_number: string;
  type: string;
  office_name: string;
  done_at: string | null;
  created_at: string;
}

interface FeedbackModalProps {
  visible: boolean;
  transaction: PendingFeedbackTransaction | null;
  studentId: number;
  onClose: () => void;
  // Called after a successful submit so the parent can refresh its
  // "pending feedback" state and unblock joining a new queue.
  onSubmitted: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

export default function FeedbackModal({
  visible,
  transaction,
  studentId,
  onClose,
  onSubmitted,
}: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever a new transaction is presented, so a
  // previous rating doesn't linger into the next one.
  useEffect(() => {
    if (visible) {
      setRating(0);
      setComment('');
      setError(null);
    }
  }, [visible, transaction?.ticket_id]);

  const handleSubmit = async () => {
    if (!transaction || rating === 0) {
      setError('Please select a star rating.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(API.submitFeedback, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: transaction.ticket_id,
          student_id: studentId,
          rating,
          comment: comment.trim() || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        onSubmitted();
      } else {
        setError(data.message || 'Could not submit feedback. Please try again.');
      }
    } catch (e) {
      console.log('Submit Feedback Error:', e);
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.handle} />

          <View style={styles.iconCircle}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color={COLORS.primary} />
          </View>

          <Text style={styles.title}>Rate Your Experience</Text>
          <Text style={styles.subtitle}>
            Before joining a new queue, please rate your last completed transaction.
          </Text>

          {transaction && (
            <View style={styles.transactionCard}>
              <View style={styles.transactionRow}>
                <Text style={styles.transactionLabel}>Queue Number</Text>
                <Text style={styles.transactionValue}>{transaction.queue_number}</Text>
              </View>
              <View style={[styles.transactionRow, styles.transactionRowLast]}>
                <Text style={styles.transactionLabel}>Office</Text>
                <Text style={styles.transactionValue} numberOfLines={1}>
                  {transaction.office_name}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => {
                  setRating(star);
                  setError(null);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= rating ? COLORS.warning : COLORS.gray}
                  style={styles.star}
                />
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && (
            <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
          )}

          <Text style={styles.commentLabel}>Comment (optional)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Tell us more about your experience..."
            placeholderTextColor={COLORS.gray}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitButton, (rating === 0 || submitting) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={rating === 0 || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Feedback</Text>
            )}
          </TouchableOpacity>

          <Pressable onPress={onClose} disabled={submitting} style={styles.closeLink}>
            <Text style={styles.closeLinkText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
    ...SHADOWS.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.lightGray,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.secondary,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  transactionCard: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  transactionRowLast: {
    borderBottomWidth: 0,
  },
  transactionLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray,
    textTransform: 'none',
    letterSpacing: 0,
  },
  transactionValue: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.secondary,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: SPACING.md,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  star: {
    marginHorizontal: 2,
  },
  ratingLabel: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.warning,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  commentLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray,
    textTransform: 'none',
    letterSpacing: 0,
    marginBottom: SPACING.sm,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: 90,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    backgroundColor: COLORS.lightGray,
    marginBottom: SPACING.md,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  submitButtonDisabled: {
    opacity: OPACITY.disabled,
  },
  submitButtonText: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.white,
    fontSize: 15,
  },
  closeLink: {
    alignItems: 'center',
    marginTop: SPACING.md,
    padding: SPACING.xs,
  },
  closeLinkText: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '600',
  },
});