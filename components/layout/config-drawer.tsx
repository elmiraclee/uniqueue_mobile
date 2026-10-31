import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../constants/theme';

interface ConfigDrawerProps {
  visible: boolean;
  activeScreen: string;

  onClose: () => void;
  onServiceItemPress: () => void;
  onWindowPress: () => void;
  onStaffPress: () => void;
  onCapacityPress: () => void;
  onLogoutPress: () => void;
}

export default function ConfigDrawer({
  visible,
  activeScreen,

  onClose,
  onServiceItemPress,
  onWindowPress,
  onStaffPress,
  onCapacityPress,
  onLogoutPress,
}: ConfigDrawerProps) {

  if (!visible) return null;

  return (
    <View style={styles.container}>

      <View style={styles.drawer}>

        {/* Header */}
        <View style={styles.header}>
          
          
        </View>

        {/* Nav section label */}
        <Text style={styles.sectionLabel}>General</Text>

        {/* Nav items */}
        <View style={styles.navItems}>

          {/* Service Item */}
          <Pressable
            style={[
              styles.item,
              activeScreen === 'service-item' && styles.activeItem,
            ]}
            onPress={onServiceItemPress}
          >
            <View style={[
              styles.iconWrap,
              activeScreen === 'service-item' && styles.activeIconWrap,
            ]}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={
                  activeScreen === 'service-item'
                    ? COLORS.white
                    : COLORS.primary
                }
              />
            </View>

            <Text
              style={[
                styles.text,
                activeScreen === 'service-item' && styles.activeText,
              ]}
            >
              Service Item
            </Text>
          </Pressable>

          {/* Window */}
          <Pressable
            style={[
              styles.item,
              activeScreen === 'window' && styles.activeItem,
            ]}
            onPress={onWindowPress}
          >
            <View style={[
              styles.iconWrap,
              activeScreen === 'window' && styles.activeIconWrap,
            ]}>
              <Ionicons
                name="browsers-outline"
                size={18}
                color={
                  activeScreen === 'window'
                    ? COLORS.white
                    : COLORS.primary
                }
              />
            </View>

            <Text
              style={[
                styles.text,
                activeScreen === 'window' && styles.activeText,
              ]}
            >
              Window
            </Text>
          </Pressable>

          {/* Staff */}
          <Pressable
            style={[
              styles.item,
              activeScreen === 'staff' && styles.activeItem,
            ]}
            onPress={onStaffPress}
          >
            <View style={[
              styles.iconWrap,
              activeScreen === 'staff' && styles.activeIconWrap,
            ]}>
              <Ionicons
                name="id-card-outline"
                size={18}
                color={
                  activeScreen === 'staff'
                    ? COLORS.white
                    : COLORS.primary
                }
              />
            </View>

            <Text
              style={[
                styles.text,
                activeScreen === 'staff' && styles.activeText,
              ]}
            >
              Staff
            </Text>
          </Pressable>

          {/* Capacity */}
          <Pressable
            style={[
              styles.item,
              activeScreen === 'capacity' && styles.activeItem,
            ]}
            onPress={onCapacityPress}
          >
            <View style={[
              styles.iconWrap,
              activeScreen === 'capacity' && styles.activeIconWrap,
            ]}>
              <Ionicons
                name="people-outline"
                size={18}
                color={
                  activeScreen === 'capacity'
                    ? COLORS.white
                    : COLORS.primary
                }
              />
            </View>

            <Text
              style={[
                styles.text,
                activeScreen === 'capacity' && styles.activeText,
              ]}
            >
              Capacity
            </Text>
          </Pressable>

        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Sign Out — pinned to bottom */}
        <View style={styles.signOutArea}>
          <Pressable
            style={styles.item}
            onPress={onLogoutPress}
          >
            <View style={styles.signOutIconWrap}>
              <Ionicons
                name="log-out-outline"
                size={18}
                color="red"
              />
            </View>

            <Text style={styles.signOutText}>
              Logout
            </Text>
          </Pressable>
        </View>

      </View>

      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      />

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    position: 'absolute',
    top: 115,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 999,
  },

  drawer: {
    width: 220,
    height: '100%',
    backgroundColor: COLORS.white,
    flexDirection: 'column',

    elevation: 16,

    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: {
      width: 4,
      height: 0,
    },
  },

  backdrop: {
    flex: 1,
  },

  // Header
  header: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    marginBottom: 8,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: 0.2,
  },

  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(102, 8, 16, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(102, 8, 16, 0.45)',
    paddingHorizontal: 20,
    paddingBottom: 6,
    paddingTop: 4,
  },

  navItems: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 2,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
    gap: 10,
  },

  activeItem: {
    backgroundColor: 'rgba(102, 8, 16, 0.08)',
  },

  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: 'rgba(102, 8, 16, 0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(102, 8, 16, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeIconWrap: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },

  activeText: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Divider before logout
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 10,
    marginBottom: 2,
  },

  // Logout pinned at bottom
  signOutArea: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 4,
  },

  signOutIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 0, 0, 0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 0, 0, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  signOutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: 'red',
  },

});