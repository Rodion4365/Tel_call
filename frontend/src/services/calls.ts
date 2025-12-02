import { apiClient } from "./apiClient";

export interface JoinCallResponse {
  call_id: string;
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
