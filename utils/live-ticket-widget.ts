import { Platform } from "react-native";
import { API } from "../constants/backend";

type WidgetPayload = {
  ticketId: number;
  ticket?: string | null;
  office?: string | null;
  window?: string | null;
  status?: string | null;
  nowServing?: string | null;
  peopleAhead?: number | null;
  estimatedWait?: number | null;
};

function nativeWidget(): any | null {
  if (Platform.OS !== "android") return null;
  try {
    // Lazy require keeps web/iOS bundles from trying to resolve an Android module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../modules/uniqueue-widget").default;
  } catch {
    return null;
  }
}

export async function updateLiveTicketWidget(
  data: WidgetPayload,
): Promise<void> {
  const widget = nativeWidget();
  if (!widget || !data.ticketId) return;
  try {
    await widget.update({
      ...data,
      endpoint: API.getLiveTicketSnapshot,
      peopleAhead: data.peopleAhead ?? -1,
      estimatedWait: data.estimatedWait ?? -1,
    });
  } catch (error) {
    console.warn("Live ticket widget update failed:", error);
  }
}

export async function refreshLiveTicketWidget(): Promise<void> {
  try {
    await nativeWidget()?.refresh();
  } catch {
    // Widget is optional (Expo Go and iOS do not include the native module).
  }
}

export async function vibrateBackgroundAlarm(): Promise<void> {
  try {
    await nativeWidget()?.vibrateAlarm();
  } catch {
    // The notification channel remains the primary vibration path.
  }
}

export async function clearLiveTicketWidget(): Promise<void> {
  try {
    await nativeWidget()?.clear();
  } catch {
    // best effort
  }
}
