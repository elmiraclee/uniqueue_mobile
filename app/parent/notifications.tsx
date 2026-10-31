import { Redirect, useLocalSearchParams } from "expo-router";
export default function LegacyRoute() {
  const params = useLocalSearchParams();
  return (
    <Redirect href={{ pathname: "/parent/(tabs)/notifications", params }} />
  );
}
