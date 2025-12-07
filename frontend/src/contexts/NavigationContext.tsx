import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface NavigationContextValue {
  /**
   * Перейти назад на MainPage
   * Согласно ТЗ: все экраны (Friends, JoinCall, Settings, CallPage) ведут на MainPage
   */
  navigateBack: () => void;

  /**
   * Проверить, находимся ли мы на главном экране
   */
  isMainPage: boolean;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const useNavigation = (): NavigationContextValue => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
};

interface Props {
  children: React.ReactNode;
}

export const NavigationProvider: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isMainPage = location.pathname === "/";

  // ТЗ 1: Все экраны ведут на MainPage
  // FriendsPage → MainPage
  // JoinCallPage → MainPage
  // SettingsPage → MainPage
  // CallPage → MainPage
  const navigateBack = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      navigateBack,
      isMainPage,
    }),
    [navigateBack, isMainPage]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};
