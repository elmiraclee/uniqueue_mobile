import { getSessionToken } from './session-storage';
import { Platform } from "react-native";
import { API } from "../constants/backend";
import type { UniqueueWidgetNativeModule } from "../modules/uniqueue-widget";

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

let cachedWidget: UniqueueWidgetNativeModule | null | undefined;

function nativeWidget(): UniqueueWidgetNativeModule | null {
  if (Platform.OS !== "android") return null;
  if (cachedWidget !== undefined) return cachedWidget;
  try {
    // Lazy require keeps web/iOS bundles from touching the Android module.
    // The module itself uses requireOptionalNativeModule, so it resolves to
    // null (instead of throwing) in Expo Go or builds without the widget.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedWidget = require("../modules/uniqueue-widget").default ?? null;
  } catch {
    cachedWidget = null;
  }
  return cachedWidget ?? null;
}

/** True when the native widget code is compiled into this build. */
export function isLiveTicketWidgetAvailable(): boolean {
  return nativeWidget() !== null;
}

export async function updateLiveTicketWidget(
  data: WidgetPayload,
): Promise<void> {
  const widget = nativeWidget();
  if (!widget || !data.ticketId) return;
  const token=await getSessionToken();
  if(!token)return;
  try {
    await widget.update({
      ...data,
      endpoint: API.getLiveTicketSnapshot,
      authorization: token,
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
