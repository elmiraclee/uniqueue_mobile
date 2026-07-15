import { usePathname } from 'expo-router';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../constants/theme';

interface HeaderProps {
  title?: string;
  onNotificationPress?: () => void;
  onBackPress?: () => void;
}

export default function AppHeader({
  title,
  onNotificationPress,
  onBackPress,
}: HeaderProps) {

  const pathname = usePathname();

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
          onPress={onNotificationPress}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={COLORS.primary}
          />
        </TouchableOpacity>

      </View>

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
  },

  iconButton: {
    marginLeft: 15,
  },

});