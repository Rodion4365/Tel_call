export interface WebRtcConfig {
  iceServers: RTCIceServer[];
}

export class WebRtcClient {
  private peer?: RTCPeerConnection;

  constructor(private readonly config: WebRtcConfig) {}

  createConnection(): void {
    this.peer = new RTCPeerConnection(this.config);
  }

  close(): void {
    this.peer?.close();
    this.peer = undefined;
  }
}
