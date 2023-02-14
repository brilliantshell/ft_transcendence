export interface RefreshTokenWrapper {
  token: string;
  isRevoked: boolean;
}

export interface JwtPayload {
  userId: string;
}
