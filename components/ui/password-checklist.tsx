import { StyleSheet, Text, View } from 'react-native';
import { passwordChecks } from '@/utils/password';

/** Live checklist under a password field (same rule as the web). */
export default function PasswordChecklist({ password, confirm }: { password: string; confirm?: string }) {
  if (!password) return null;
  const checks = passwordChecks(password);
  return (
    <View style={styles.wrap}>
      {checks.map((c) => (
        <Text key={c.label} style={[styles.item, { color: c.ok ? '#16a34a' : '#9ca3af' }]}>
          {c.ok ? '✓' : '•'} {c.label}
        </Text>
      ))}
      {confirm !== undefined && confirm.length > 0 && (
        <Text style={[styles.item, { color: confirm === password ? '#16a34a' : '#dc2626' }]}>
          {confirm === password ? '✓ Passwords match' : '✗ Passwords do not match'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: -6, marginBottom: 12 },
  item: { fontSize: 12, marginBottom: 2 },
});
