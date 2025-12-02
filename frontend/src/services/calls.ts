import { apiClient } from "./apiClient";

export interface JoinCallResponse {
  call_id: string;
  join_url: string;
}

export interface CreateCallResponse {
  call_id: string;
  join_url: string;
}

export const joinCallByCode = async (
  callCode: string,
  token: string,
): Promise<JoinCallResponse> => {
  return apiClient.post<JoinCallResponse>(
    "/api/calls/join_by_code",
    { call_code: callCode },
    { token },
  );
};

export const createCall = async (token: string): Promise<CreateCallResponse> => {
  return apiClient.post<CreateCallResponse>("/api/calls", {}, { token });
};
