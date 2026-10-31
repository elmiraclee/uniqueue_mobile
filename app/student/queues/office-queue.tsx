import { Redirect, useLocalSearchParams } from "expo-router";
/** Preserve old bookmarked/deep-linked queue URLs without a second workflow. */
export default function LegacyQueue() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: "/student/office-queue", params }} />;
}
