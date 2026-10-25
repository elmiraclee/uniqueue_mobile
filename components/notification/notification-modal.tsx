import { TourTarget, TutorialStage, TutorialCoach, useTutorial } from '@/components/tutorial/tutorial';
import { Ionicons } from '@expo/vector-icons';
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import {
    COLORS,
    RADIUS,
    SPACING,
    STATUS_BG,
    STATUS_COLORS,
    TYPOGRAPHY,
} from '../../constants/theme';
import { QueueNotification, useNotifications } from './use-notification';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

// Maps a notification `type` to an icon + the status-color pair it
// should borrow from theme.ts (STATUS_COLORS / STATUS_BG).
const TYPE_META: Record<
  QueueNotification['type'],
  { icon: keyof typeof Ionicons.glyphMap; statusKey: keyof typeof STATUS_COLORS }
> = {
  relationship_unlinked: { icon: 'unlink-outline', statusKey: 'cancelled' },
  position_update: { icon: 'people-outline', statusKey: 'waiting' },
  next_in_line: { icon: 'walk-outline', statusKey: 'waiting' },
  called: { icon: 'megaphone-outline', statusKey: 'called' },
  in_progress: { icon: 'sync-outline', statusKey: 'in_progress' },
  completed: { icon: 'checkmark-circle-outline', statusKey: 'completed' },
  cancelled: { icon: 'close-circle-outline', statusKey: 'cancelled' },
};

function timeAgo(dateString: string) {
  const diffMs = Date.now() - new Date(dateString.replace(' ', 'T')).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationModal({ visible, onClose }: NotificationModalProps) {
  const guide=useTutorial();
  const { notifications, unreadCount, loading, refresh, markAsRead, markAllAsRead } =
    useNotifications();

  const renderItem = ({ item }: { item: QueueNotification }) => {
    // Fallback keeps this from crashing if the backend ever sends a
    // `type` value that isn't in TYPE_META (old rows, new type added
    // server-side before the app is updated, etc).
    const meta = TYPE_META[item.type] ?? {
      icon: 'notifications-outline' as const,
      statusKey: 'waiting' as const,
    };
    const color = STATUS_COLORS[meta.statusKey] ?? COLORS.primary;
    const bg = STATUS_BG[meta.statusKey] ?? COLORS.primarySoft;

    return (
      <TouchableOpacity
        style={[styles.item, !item.is_read && styles.itemUnread]}
        activeOpacity={0.7}
        onPress={() => !item.is_read && markAsRead(item.id)}
      >
        <View style={[styles.iconWrap, { backgroundColor: bg }]}>
          <Ionicons name={meta.icon} size={20} color={color} />
        </View>

        <View style={styles.itemBody}>
          <View style={styles.itemHeaderRow}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>

          <Text style={styles.itemMessage}>{item.message}</Text>

          <Text style={styles.itemMeta}>
            {item.queue_number}
            {item.office_name ? ` · ${item.office_name}` : ''}
            {item.window_name ? ` · ${item.window_name}` : ''}
          </Text>

          <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={{flex:1}}><TutorialStage modal><Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet,guide.notificationStep&&{maxHeight:"100%"}]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              Notifications
              {unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Text>

            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
          </View>

          <TourTarget id="notice-list"><Text style={{fontSize:14,lineHeight:20,color:COLORS.gray,padding:16}}>Queue updates and account notices. Tap an unread notice to mark it read, or use Mark all read.</Text></TourTarget>
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={36} color={COLORS.gray} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              onRefresh={refresh}
              refreshing={loading}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Pressable>
      </Pressable></TutorialStage><TutorialCoach modal/></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },

  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '75%',
    paddingBottom: SPACING.xl,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.primary,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  markAllBtn: {
    marginRight: SPACING.md,
  },

  markAllText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
  },

  closeBtn: {
    padding: SPACING.xs,
  },

  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },

  item: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },

  itemUnread: {
    backgroundColor: COLORS.primarySoft,
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },

  itemBody: {
    flex: 1,
  },

  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  itemTitle: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.text,
    flexShrink: 1,
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.xs,
  },

  itemMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginTop: 2,
  },

  itemMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray,
    marginTop: 4,
    textTransform: 'none',
  },

  itemTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray,
    marginTop: 2,
    textTransform: 'none',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },

  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray,
    marginTop: SPACING.sm,
  },
});