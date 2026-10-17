import { usePathname } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../constants/theme';
import NotificationModal from '../notification/notification-modal';
import { useNotifications } from '../notification/use-notification';

interface HeaderProps {
  title?: string;
  onNotificationPress?: () => void;
  onBackPress?: () => void;
  /** Accepted for screens that pass it; the header has no back button. */
  showBack?: boolean;
}

export default function AppHeader({
  title,
  onNotificationPress,
  onBackPress,
}: HeaderProps) {
  const pathname = usePathname();

  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const { unreadCount } = useNotifications();

  const handleNotificationPress = () => {
    setNotificationsVisible(true);
    onNotificationPress?.();
  };

  const getHeaderTitle = () => {
    if (title) {
      return title;
    }

    if (pathname.includes('/home')) {
      return 'Queue Dashboard';
    }

    if (pathname.includes('/queue')) {
      return 'Queue Transactions';
    }

    if (pathname.includes('/profile')) {
      return 'Student Profile';
    }

    return 'UniQueue';
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
        />

        <View>
          <Text style={styles.title}>
            {getHeaderTitle()}
          </Text>
        </View>
      </View>

      <View style={styles.rightContainer}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleNotificationPress}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={COLORS.primary}
          />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <NotificationModal
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 35,
    paddingBottom: 15,

    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    elevation: 4,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },

  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    marginRight: 10,
    padding: 4,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logo: {
    width: 45,
    height: 45,
    resizeMode: 'contain',
    marginRight: 12,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },

  userName: {
    fontSize: 13,
    color: COLORS.gray,
  },

  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconButton: {
    marginLeft: 15,
    padding: 2,
  },

  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },

  badgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '700',
  },
});