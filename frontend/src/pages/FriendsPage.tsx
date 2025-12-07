import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { callFriend, deleteFriends, Friend, getFriends } from "../services/friends";
import defaultAvatar from "../assets/default-avatar.svg";

const FriendsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthorizing } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callingFriendId, setCallingFriendId] = useState<number | null>(null);

  // Режим редактирования
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Загрузка списка друзей
  useEffect(() => {
    const loadFriends = async () => {
      if (!user) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const friendsList = await getFriends({ limit: 100 });
        setFriends(friendsList);
        setFilteredFriends(friendsList);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[FriendsPage] Failed to load friends", err);
        setError(t("friendsPage.errorLoad"));
      } finally {
        setIsLoading(false);
      }
    };

    loadFriends();
  }, [user]);

  // Фильтрация друзей по поисковому запросу
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = friends.filter((friend) => {
      const displayName = friend.display_name?.toLowerCase() || "";
      const username = friend.username?.toLowerCase() || "";
      return displayName.includes(query) || username.includes(query);
    });

    setFilteredFriends(filtered);
  }, [searchQuery, friends]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleFriendClick = async (friend: Friend) => {
    // В режиме редактирования - только выбираем/снимаем выбор
    if (isEditMode) {
      toggleFriendSelection(friend.id);
      return;
    }

    // В обычном режиме - звоним
    if (!user) {
      setError(t("friendsPage.errorAuthRequired"));
      return;
    }

    setCallingFriendId(friend.id);
    setError(null);

    try {
      // eslint-disable-next-line no-console
      console.log("[FriendsPage] Calling friend", friend.id);

      const response = await callFriend(friend.id);

      // eslint-disable-next-line no-console
      console.log("[FriendsPage] Call created successfully", response);

      // Переходим на страницу звонка
      navigate(`/call/${response.call_id}`, {
        state: { join_url: response.join_url },
        replace: true,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[FriendsPage] Failed to create call", err);

      const message =
        err instanceof Error && err.message
          ? t("friendsPage.errorCallWithMessage", { message: err.message })
          : t("friendsPage.errorCall");

      setError(message);
    } finally {
      setCallingFriendId(null);
    }
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setSelectedFriends(new Set());
    setError(null);
  };

  const toggleFriendSelection = (friendId: number) => {
    setSelectedFriends((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const handleDeleteClick = () => {
    if (selectedFriends.size === 0) return;
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedFriends.size === 0) return;

    setIsDeleting(true);
    setError(null);

    try {
      const friendIds = Array.from(selectedFriends);
      await deleteFriends(friendIds);

      // Обновляем список друзей
      const updatedFriends = friends.filter((f) => !selectedFriends.has(f.id));
      setFriends(updatedFriends);
      setFilteredFriends(
        updatedFriends.filter((f) => {
          if (!searchQuery.trim()) return true;
          const query = searchQuery.toLowerCase();
          const displayName = f.display_name?.toLowerCase() || "";
          const username = f.username?.toLowerCase() || "";
          return displayName.includes(query) || username.includes(query);
        })
      );

      // Сбрасываем состояние
      setSelectedFriends(new Set());
      setIsEditMode(false);
      setShowDeleteModal(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[FriendsPage] Failed to delete friends", err);
      setError(t("friendsPage.errorDelete"));
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setIsEditMode(false);
    setSelectedFriends(new Set());
  };

  const getDisplayName = (friend: Friend): string => {
    return friend.display_name || friend.username || t("friendsPage.nameless");
  };

  const getAvatarUrl = (friend: Friend): string => {
    return friend.photo_url || defaultAvatar;
  };

  return (
    <div className="app-container">
      <div className="friends-page">
        <header className="friends-header">
          <h1 className="friends-title">{t("friendsPage.title")}</h1>
          <button
            className={`edit-button ${isEditMode ? "active" : ""}`}
            onClick={toggleEditMode}
            disabled={isLoading || isAuthorizing || friends.length === 0}
            aria-label={t("friendsPage.editMode")}
          >
            ✏️
          </button>
        </header>

        <div className="friends-search">
          <input
            type="text"
            className="friends-search-input"
            placeholder={t("friendsPage.searchPlaceholder")}
            value={searchQuery}
            onChange={handleSearchChange}
            disabled={isLoading || isAuthorizing}
          />
        </div>

        {error ? (
          <p className="status status-offline" role="alert" style={{ textAlign: "center", margin: "1rem" }}>
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p className="muted" style={{ textAlign: "center", margin: "2rem 0" }}>
            {t("common.loading")}
          </p>
        ) : filteredFriends.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", margin: "2rem 0" }}>
            {searchQuery ? t("friendsPage.nothingFound") : t("friendsPage.noFriends")}
          </p>
        ) : (
          <div className="friends-list">
            {filteredFriends.map((friend) => {
              const isSelected = selectedFriends.has(friend.id);
              return (
                <button
                  key={friend.id}
                  className={`friend-item ${isEditMode ? "edit-mode" : ""} ${isSelected ? "selected" : ""}`}
                  onClick={() => handleFriendClick(friend)}
                  disabled={callingFriendId !== null || isDeleting}
                >
                  {isEditMode ? (
                    <div className={`selection-circle ${isSelected ? "checked" : ""}`}>
                      {isSelected ? "✓" : ""}
                    </div>
                  ) : null}
                  <div className="friend-avatar">
                    <img src={getAvatarUrl(friend)} alt={getDisplayName(friend)} />
                  </div>
                  <div className="friend-info">
                    <div className="friend-name">{getDisplayName(friend)}</div>
                    {friend.username ? <div className="friend-username">@{friend.username}</div> : null}
                  </div>
                  {callingFriendId === friend.id ? (
                    <div className="friend-calling">{t("friendsPage.calling")}</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {/* Кнопка удаления (только в режиме редактирования) */}
        {isEditMode ? (
          <div className="delete-button-container">
            <button
              className="delete-button"
              onClick={handleDeleteClick}
              disabled={selectedFriends.size === 0 || isDeleting}
            >
              {t("common.delete")}
            </button>
          </div>
        ) : null}

        {/* Модальное окно подтверждения удаления */}
        {showDeleteModal ? (
          <div className="modal-overlay" onClick={handleDeleteCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">{t("friendsPage.deleteConfirmTitle")}</h2>
              <div className="modal-buttons">
                <button
                  className="modal-button modal-button-confirm"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                >
                  {isDeleting ? t("friendsPage.deleting") : t("common.yes")}
                </button>
                <button
                  className="modal-button modal-button-cancel"
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                >
                  {t("common.no")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default FriendsPage;
