export type UserId = number;

export type ChannelId = number;
export type Relationship =
  | 'friend'
  | 'blocker'
  | 'blocked'
  | 'pendingSender'
  | 'pendingReceiver'
  | null;

export type RelationshipAction = 'friendRequest' | 'block';

export type IsBlocked = boolean;

export interface PeerInfo {
  relationship: Relationship;
  dmId: ChannelId | null;
}
