import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { getSessionToken } from "@/utils/client-fetch";
import { request } from "./api";
import { Actor, Child, Role, positiveId } from "./domain";
type Portal = {
  role: Role;
  user: any;
  children: Child[];
  child: Child | null;
  actor: Actor;
  childrenError: string;
  childrenLoading: boolean;
  chooseChild: (id: number) => void;
  reloadChildren: () => Promise<void>;
  updateUser: (user: any) => Promise<void>;
};
const Context = createContext<Portal | null>(null);
export const usePortal = () => {
  const v = useContext(Context);
  if (!v) throw new Error("PortalProvider is required");
  return v;
};
export function PortalProvider({
  role,
  children: content,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<any>(undefined),
    [actualRole, setActualRole] = useState(""),
    [children, setChildren] = useState<Child[]>([]),
    [selected, setSelected] = useState(0),
    [childrenError, setChildrenError] = useState(""),
    [childrenLoading, setChildrenLoading] = useState(role === "parent");
  const mounted = useRef(true),
    childRequest = useRef(0);
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const [u, r, t] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("role"),
          getSessionToken(),
        ]);
        if (mounted.current) {
          setActualRole(r || "");
          setSession(t && u ? JSON.parse(u) : null);
        }
      } catch {
        if (mounted.current) setSession(null);
      }
    })();
    return () => {
      mounted.current = false;
      childRequest.current++;
    };
  }, []);
  const reloadChildren = useCallback(async () => {
    if (role !== "parent" || !session?.id) return;
    const n = ++childRequest.current;
    try {
      const data = await request(
        `get_parent_children.php?parent_id=${session.id}`,
      );
      if (mounted.current && n === childRequest.current) {
        const list = data.children || [];
        setChildren(list);
        setChildrenError("");
        setSelected((id) =>
          list.some((c: Child) => Number(c.id) === id) ? id : 0,
        );
      }
    } catch (e) {
      if (mounted.current && n === childRequest.current) {
        setChildrenError(
          e instanceof Error ? e.message : "Children unavailable.",
        );
        setChildren([]);
        setSelected(0);
      }
    } finally {
      if (mounted.current && n === childRequest.current)
        setChildrenLoading(false);
    }
  }, [role, session]);
  useEffect(() => {
    if (actualRole === role) void reloadChildren();
  }, [reloadChildren, actualRole, role]);
  const updateUser = async (next: any) => {
    await AsyncStorage.setItem("user", JSON.stringify(next));
    if (mounted.current) setSession(next);
  };
  if (session === undefined)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color="#660810" />
      </View>
    );
  if (!session || !["student", "parent"].includes(actualRole))
    return <Redirect href="/login" />;
  if (actualRole !== role)
    return (
      <Redirect
        href={actualRole === "parent" ? "/parent/home" : "/student/home"}
      />
    );
  const child = children.find((c) => Number(c.id) === selected) || null;
  return (
    <Context.Provider
      value={{
        role,
        user: session,
        children,
        child,
        actor: {
          role,
          id: positiveId(session.id),
          studentId:
            role === "student" ? positiveId(session.id) : positiveId(child?.id),
        },
        childrenLoading,
        childrenError,
        chooseChild: (id) =>
          setSelected(children.some((c) => Number(c.id) === id) ? id : 0),
        reloadChildren,
        updateUser,
      }}
    >
      {content}
    </Context.Provider>
  );
}
