import { apiClient } from "./apiClient";

export interface Friend {
  id: number;
  telegram_user_id: number;
  display_name: string | null;
  username: string | null;
  photo_url: string | null;
  last_call_at: string | null;
}

export interface GetFriendsParams {
  query?: string;
  limit?: number;
  offset?: number;
}

export interface CallFriendResponse {
  call_id: string;
  join_url: string;
  title: string | null;
  is_video_enabled: boolean;
  status: string;
  created_at: string;
  expires_at: string | null;
}

export interface DeleteFriendsResponse {
  deleted_ids: number[];
  not_found_ids: number[];
}

export const getFriends = async (params?: GetFriendsParams): Promise<Friend[]> => {
  const queryParams = new URLSearchParams();

  if (params?.query) {
    queryParams.append("query", params.query);
  }
  if (params?.limit !== undefined) {
    queryParams.append("limit", params.limit.toString());
  }
  if (params?.offset !== undefined) {
    queryParams.append("offset", params.offset.toString());
  }

  const queryString = queryParams.toString();
  const path = `/api/friends${queryString ? `?${queryString}` : ""}`;

  // eslint-disable-next-line no-console
  console.log("[getFriends] Requesting friends list:", { path, params });

  try {
    const friends = await apiClient.get<Friend[]>(path);

    // eslint-disable-next-line no-console
    console.log("[getFriends] Received friends:", friends.length, "friends");

    // Валидация данных
    const validFriends = friends.filter((friend, idx) => {
      if (!friend || typeof friend !== 'object') {
        // eslint-disable-next-line no-console
        console.warn(`[getFriends] Friend at index ${idx} is not an object:`, friend);
        return false;
      }

      if (!friend.id) {
        // eslint-disable-next-line no-console
        console.warn(`[getFriends] Friend at index ${idx} has no id:`, friend);
        return false;
      }

      if (!friend.telegram_user_id) {
        // eslint-disable-next-line no-console
        console.warn(`[getFriends] Friend at index ${idx} has no telegram_user_id:`, friend);
        return false;
      }

      return true;
    });

    if (validFriends.length !== friends.length) {
      // eslint-disable-next-line no-console
      console.warn(`[getFriends] Filtered out ${friends.length - validFriends.length} invalid friends`);
    }

    return validFriends;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[getFriends] Error fetching friends:", error);
    throw error;
  }
};

export const callFriend = async (friendId: number): Promise<CallFriendResponse> => {
  return apiClient.post<CallFriendResponse>("/api/calls/friend", { friend_id: friendId });
};

export const deleteFriends = async (friendIds: number[]): Promise<DeleteFriendsResponse> => {
  return apiClient.post<DeleteFriendsResponse>("/api/friends/delete", { friend_ids: friendIds });
};
