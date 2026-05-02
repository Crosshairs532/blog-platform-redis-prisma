export const RedisKeys = {
  userSessions: (userId: string) => `user:${userId}:sessions`,
  session: (sessionId: string) => `session:${sessionId}`,
  blacklist: (token: string) => `blacklist:${token}`,
  followers: (userId: string) => `followers:${userId}`,
  following: (userId: string) => `following:${userId}`,
  userProfile: (userId: string) => `profile:${userId}`,
  userPosts: (userId: string, page: number) => `user:${userId}:posts`,
  userPostCount: (userId: string) => `user:${userId}:post:count`,
  post: (postId: string) => `post:${postId}`,
  feed: (userId: string) => `feed:${userId}`,
  notifications: (userId: string) => `notifications:${userId}`,
} as const;
