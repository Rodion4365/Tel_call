import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface NavigationContextValue {
  /**
   * Логически перейти назад по стеку навигации
   * Возвращает true если переход выполнен, false если уже на главном экране
   */
  navigateBack: () => boolean;

  /**
   * Добавить текущий путь в стек навигации
   */
  registerCurrentPath: () => void;

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

/**
 * Определяет логический предыдущий экран для данного пути
 */
const getLogicalPreviousPath = (currentPath: string, callId?: string): string | null => {
  // Главный экран - нет предыдущего
  if (currentPath === "/") {
    return null;
  }

  // Страница активного звонка -> страница "Звонок создан"
  if (currentPath.startsWith("/call/") && callId) {
    return `/call-created/${callId}`;
  }

  // Все остальные экраны ведут на главный
  // /friends -> /
  // /join-call -> /
  // /call-created/:id -> /
  // /settings -> /
  return "/";
};

/**
 * Извлекает call_id из пути /call/:id или /call-created/:id
 */
const extractCallIdFromPath = (path: string): string | undefined => {
  const callMatch = path.match(/^\/call\/([^/?]+)/);
  if (callMatch) {
    return callMatch[1];
  }

  const createdMatch = path.match(/^\/call-created\/([^/?]+)/);
  if (createdMatch) {
    return createdMatch[1];
  }

  return undefined;
};

export const NavigationProvider: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Логический стек путей (не включая текущий)
  const [navigationStack, setNavigationStack] = useState<string[]>([]);

  // Флаг что мы пришли по deep link (без предварительной навигации)
  const isDeepLinkRef = useRef(true);

  // Отслеживаем предыдущий путь для определения направления навигации
  const previousPathRef = useRef<string>(location.pathname);

  const currentPath = location.pathname;
  const isMainPage = currentPath === "/";

  // Восстановление логического стека при входе по deep link
  useEffect(() => {
    if (!isDeepLinkRef.current) {
      return;
    }

    // Если мы не на главной странице и стек пуст, значит пришли по deep link
    if (currentPath !== "/" && navigationStack.length === 0) {
      const callId = extractCallIdFromPath(currentPath);
      const restoredStack: string[] = [];

      // Всегда добавляем главную страницу в основание стека
      restoredStack.push("/");

      // Для страницы звонка добавляем промежуточную страницу "Звонок создан"
      if (currentPath.startsWith("/call/") && callId) {
        restoredStack.push(`/call-created/${callId}`);
      }

      if (restoredStack.length > 0) {
        // eslint-disable-next-line no-console
        console.log("[Navigation] Restored logical stack for deep link:", {
          currentPath,
          restoredStack,
        });
        setNavigationStack(restoredStack);
      }
    }

    isDeepLinkRef.current = false;
  }, [currentPath, navigationStack.length]);

  // Регистрация текущего пути при обычной навигации
  const registerCurrentPath = useCallback(() => {
    const previousPath = previousPathRef.current;

    // Не регистрируем если это движение назад или возврат на тот же путь
    if (currentPath === previousPath) {
      return;
    }

    // Проверяем является ли это движением вперед
    const isForwardNavigation = !navigationStack.includes(previousPath);

    if (isForwardNavigation && previousPath !== currentPath) {
      setNavigationStack((prev) => {
        // Не добавляем дубликаты
        if (prev[prev.length - 1] === previousPath) {
          return prev;
        }

        // eslint-disable-next-line no-console
        console.log("[Navigation] Registering path in stack:", previousPath);
        return [...prev, previousPath];
      });
    }

    previousPathRef.current = currentPath;
  }, [currentPath, navigationStack]);

  // Логический переход назад
  const navigateBack = useCallback((): boolean => {
    // eslint-disable-next-line no-console
    console.log("[Navigation] Back button pressed", {
      currentPath,
      stack: navigationStack,
      isMainPage,
    });

    // Если на главной странице - не обрабатываем (Telegram закроет mini app)
    if (isMainPage) {
      return false;
    }

    // Если есть сохраненная история - используем её
    if (navigationStack.length > 0) {
      const previousPath = navigationStack[navigationStack.length - 1];

      // eslint-disable-next-line no-console
      console.log("[Navigation] Navigating to previous path from stack:", previousPath);

      // Убираем последний элемент из стека
      setNavigationStack((prev) => prev.slice(0, -1));

      // Переходим на предыдущий путь
      navigate(previousPath, { replace: true });
      return true;
    }

    // Если стека нет, используем логический предыдущий экран
    const callId = extractCallIdFromPath(currentPath);
    const logicalPrevious = getLogicalPreviousPath(currentPath, callId);

    if (logicalPrevious) {
      // eslint-disable-next-line no-console
      console.log("[Navigation] Navigating to logical previous path:", logicalPrevious);
      navigate(logicalPrevious, { replace: true });
      return true;
    }

    // Нет предыдущего экрана - не обрабатываем
    return false;
  }, [currentPath, isMainPage, navigationStack, navigate]);

  const value = useMemo(
    () => ({
      navigateBack,
      registerCurrentPath,
      isMainPage,
    }),
    [navigateBack, registerCurrentPath, isMainPage]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};
