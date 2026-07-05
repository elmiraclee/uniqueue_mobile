import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { router } from 'expo-router';
import AppHeader from '../../components/layout/app-header';
import { COLORS } from '../../constants/theme';




interface Office {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export default function StudentHome() {
  const [studentName, setStudentName] = useState('');
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
    fetchOffices();
  }, []);

  const loadUser = async () => {
    try {
      const user = await AsyncStorage.getItem('user');

      if (user) {
        const parsedUser = JSON.parse(user);

        setStudentName(
          `${parsedUser.first_name} ${parsedUser.last_name}`
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  const fetchOffices = async () => {
    try {
      const response = await fetch(
       'http://192.168.1.26/uniqueue_api/get_offices.php'
      );

      const data = await response.json();

      if (data.success) {
        setOffices(data.offices);
      }
    } catch (error) {
      console.log('Fetch Offices Error:', error);
    } finally {
      setLoading(false);
    }
  };

 const joinQueue = (office: Office) => {
  router.push(`/student/queues/office-queue?office=${office.slug}`);
};

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good Morning';
    }

    if (hour < 18) {
      return 'Good Afternoon';
    }

    return 'Good Evening';
  };

  const getOfficeIcon = (slug: string): keyof typeof Ionicons.glyphMap => {
    const map: Record<string, keyof typeof Ionicons.glyphMap> = {
      registrar: 'document-text-outline',
      scholarship: 'ribbon-outline',
      finance: 'cash-outline',
      cashier: 'cash-outline',
      library: 'library-outline',
      clinic: 'medkit-outline',
      guidance: 'heart-outline',
      it: 'desktop-outline',
      admission: 'person-add-outline',
      security: 'shield-checkmark-outline',
      osa: 'people-outline',
      'student-affairs': 'people-outline',
    };

    const key = Object.keys(map).find((k) => slug.toLowerCase().includes(k));
    return key ? map[key] : 'business-outline';
  };

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Greeting Card */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingLabel}>
            {getGreeting()} 👋
          </Text>

          <Text style={styles.studentName}>
            {studentName}
          </Text>

          <Text style={styles.subtitle}>
            UniQueue Student Portal
          </Text>
        </View>

        {/* Offices */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Available Offices
          </Text>

          {!loading && offices.length > 0 && (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>
                {offices.length} open
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: 30 }}
          />
        ) : offices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No offices available.
            </Text>
          </View>
        ) : (
          offices.map((office) => (
            <View
              key={office.id}
              style={styles.officeCard}
            >
              {/* Card Top */}
              <View style={styles.cardTop}>
                <View style={styles.officeIconAndName}>
                  <View style={styles.officeIconBox}>
                    <Ionicons
                      name={getOfficeIcon(office.slug)}
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>

                  <Text style={styles.officeName}>
                    {office.name}
                  </Text>
                </View>

                <View style={styles.activeBadge}>
                  <Text style={styles.activeText}>
                    OPEN
                  </Text>
                </View>
              </View>

              <Text style={styles.officeDescription}>
                {office.description}
              </Text>

              {/* Card Footer */}
              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.joinButton}
                  onPress={() => joinQueue(office)}
                >
                  <Text style={styles.joinButtonText}>
                    Join Queue
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 18,
    paddingBottom: 40,
    gap: 14,
  },

  // Greeting Card
  greetingCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 22,
  },

  greetingLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  studentName: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 32,
  },

  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 6,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  sectionBadge: {
    backgroundColor: '#e6dada',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },

  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Office Card
  officeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(102,8,16,0.08)',
  },

  activeBadge: {
    backgroundColor: '#DFF6DD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  activeText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 0,
  },

  officeIconAndName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },

  officeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f9f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  officeName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
  },

  officeDescription: {
    color: COLORS.gray,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },

  // Card Footer
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(102,8,16,0.07)',
    padding: 12,
    paddingHorizontal: 16,
  },

  joinButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },

  joinButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },

  // Empty state
  emptyCard: {
    backgroundColor: COLORS.white,
    padding: 30,
    borderRadius: 18,
    alignItems: 'center',
  },

  emptyText: {
    color: COLORS.gray,
    fontSize: 14,
  },
});