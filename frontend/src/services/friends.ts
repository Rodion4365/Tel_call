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

  return apiClient.get<Friend[]>(path);
};

export const callFriend = async (friendId: number): Promise<CallFriendResponse> => {
  return apiClient.post<CallFriendResponse>("/api/calls/friend", { friend_id: friendId });
};
