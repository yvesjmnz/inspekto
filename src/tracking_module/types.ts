// Tracking Module - Types
export type TrackingStatus = string;

export interface TrackingSummary {
  trackingId: string;
  status: TrackingStatus;
}
