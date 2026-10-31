import { Stack } from "expo-router";
import { PortalProvider } from "./context";
import { Role } from "./domain";
import AlertGate from "./alert-gate";
/** Details are real stack routes, never disabled/hidden tab destinations. */
export default function PortalStack({ role }: { role: Role }) {
  return (
    <PortalProvider role={role}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <AlertGate />
    </PortalProvider>
  );
}
