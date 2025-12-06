import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { callFriend, Friend, getFriends } from "../services/friends";
import defaultAvatar from "../assets/default-avatar.svg";

const FriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthorizing } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callingFriendId, setCallingFriendId] = useState<number | null>(null);

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
        setError("Не удалось загрузить список друзей");
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
    if (!user) {
      setError("Необходима авторизация");
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
          ? `Не удалось начать звонок: ${err.message}`
          : "Не удалось начать звонок. Попробуйте ещё раз.";

      setError(message);
    } finally {
      setCallingFriendId(null);
    }
  };

  const getDisplayName = (friend: Friend): string => {
    return friend.display_name || friend.username || "Без имени";
  };

  const getAvatarUrl = (friend: Friend): string => {
    return friend.photo_url || defaultAvatar;
  };

  return (
    <div className="app-container">
      <div className="friends-page">
        <header className="friends-header">
          <h1 className="friends-title">Друзья</h1>
        </header>

        <div className="friends-search">
          <input
            type="text"
            className="friends-search-input"
            placeholder="Поиск по имени или никнейму"
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
            Загрузка...
          </p>
        ) : filteredFriends.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", margin: "2rem 0" }}>
            {searchQuery ? "Ничего не найдено" : "У вас пока нет друзей"}
          </p>
        ) : (
          <div className="friends-list">
            {filteredFriends.map((friend) => (
              <button
                key={friend.id}
                className="friend-item"
                onClick={() => handleFriendClick(friend)}
                disabled={callingFriendId !== null}
              >
                <div className="friend-avatar">
                  <img src={getAvatarUrl(friend)} alt={getDisplayName(friend)} />
                </div>
                <div className="friend-info">
                  <div className="friend-name">{getDisplayName(friend)}</div>
                  {friend.username ? <div className="friend-username">@{friend.username}</div> : null}
                </div>
                {callingFriendId === friend.id ? (
                  <div className="friend-calling">Звоним...</div>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPage;
