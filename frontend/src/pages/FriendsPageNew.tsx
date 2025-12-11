import React, { useCallback, useEffect, useState } from "react";
import { TopBar } from "../components/layout/TopBar";
import { Search, Pencil } from "lucide-react";
import { MobileFrame } from "../components/layout/MobileFrame";
import { useAuth } from "../contexts/AuthContext";
import { callFriend, Friend, getFriends } from "../services/friends";
import { useNavigate } from "react-router-dom";

export default function FriendsPageNew() {
  const { user, isAuthorizing } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callingFriendId, setCallingFriendId] = useState<number | null>(null);

  useEffect(() => {
    const loadFriends = async () => {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      try {
        const friendsList = await getFriends({ limit: 100 });
        const validFriends = friendsList.filter((friend) => friend && friend.id);
        setFriends(validFriends);
        setFilteredFriends(validFriends);
      } catch (err) {
        console.error("Failed to load friends", err);
        setError("Не удалось загрузить список друзей");
      } finally {
        setIsLoading(false);
      }
    };

    loadFriends();
  }, [user, isAuthorizing]);

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
    if (!user || callingFriendId) return;

    setCallingFriendId(friend.id);
    setError(null);

    try {
      const response = await callFriend(friend.id);
      navigate(`/call/${response.call_id}`);
    } catch (err) {
      console.error("Failed to create call", err);
      setError("Не удалось создать звонок");
    } finally {
      setCallingFriendId(null);
    }
  };

  const getDisplayName = (friend: Friend): string => {
    if (!friend) return "Безымянный";
    if (friend.display_name?.trim()) return friend.display_name.trim();
    if (friend.username?.trim()) return friend.username.trim();
    if (friend.telegram_user_id) return `User ${friend.telegram_user_id}`;
    return "Безымянный";
  };

  return (
    <MobileFrame>
      <div className="h-full w-full bg-gradient-to-b from-[#0f111a] to-black text-white font-sans flex flex-col">
        <TopBar showBack={true} backTo="/" />
        <div className="flex-1 px-4 pt-8 max-w-md mx-auto w-full flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-white">Друзья</h1>
            <button className="text-[#8B78E6] active:opacity-70">
                <Pencil className="w-8 h-8 rounded-full border border-[#8B78E6]/30 p-1.5" />
            </button>
          </div>
          {/* Search Bar */}
          <div className="w-full relative mb-8">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Search className="w-5 h-5" />
              </div>
              <input
                  type="text"
                  placeholder="Поиск по имени или никнейму"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  disabled={isLoading}
                  className="w-full h-12 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#7C66DC]/50 transition-colors"
              />
          </div>
          {/* Error State Button */}
          {error && (
            <button className="w-full bg-[#FFF0E0] text-[#FF8A65] py-4 px-6 rounded-3xl font-medium text-center mb-12">
                {error}
            </button>
          )}
          {/* Empty State / Loading */}
          {isLoading ? (
            <div className="text-zinc-500 text-center">
                Загрузка...
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="text-zinc-500 text-center">
                {searchQuery ? "Ничего не найдено" : "У вас пока нет друзей"}
            </div>
          ) : (
            <div className="w-full space-y-3">
              {filteredFriends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => handleFriendClick(friend)}
                  disabled={callingFriendId !== null}
                  className="w-full bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 flex items-center gap-4 hover:bg-zinc-800/60 transition-colors disabled:opacity-50 text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-white font-semibold">
                    {getDisplayName(friend).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{getDisplayName(friend)}</div>
                    {friend.username?.trim() && (
                      <div className="text-zinc-500 text-sm">@{friend.username.trim()}</div>
                    )}
                  </div>
                  {callingFriendId === friend.id && (
                    <div className="text-[#7C66DC] text-sm">Звоним...</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileFrame>
  );
}
