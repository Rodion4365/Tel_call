import { apiClient } from "./apiClient";

export interface JoinCallResponse {
  call_id: string;
  join_url: string;
}

export interface GetCallResponse {
  call_id: string;
  join_url: string;
}

export interface CreateCallResponse {
  call_id: string;
  join_url: string;
}

export interface CreateCallRequest {
  title?: string | null;
  is_video_enabled?: boolean;
}

export const joinCallByCode = async (callCode: string): Promise<JoinCallResponse> => {
  return apiClient.post<JoinCallResponse>("/api/calls/join_by_code", { call_code: callCode });
};

export const createCall = async (payload: CreateCallRequest): Promise<CreateCallResponse> => {
  return apiClient.post<CreateCallResponse>("/api/calls/", payload);
};

export const getCallById = async (callId: string): Promise<GetCallResponse> => {
  return apiClient.get<GetCallResponse>(`/api/calls/${callId}`);
};
