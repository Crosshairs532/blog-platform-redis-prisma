export const RedisKeys = {
  userSessions: (userId: string) => `user:${userId}:sessions`,
  session: (sessionId: string) => `session:${sessionId}`,
  blacklist: (token: string) => `blacklist:${token}`,
  followers: (userId: string) => `followers:${userId}`,
  following: (userId: string) => `following:${userId}`,
  userProfile: (userId: string) => `user:${userId}:profile`,
  userPosts: (userId: string, page: number) => `user:${userId}:posts:${page}`,
  userPostCount: (userId: string) => `user:${userId}:post:count`,
  post: (postId: string) => `post:${postId}`,
  feed: (userId: string) => `feed:${userId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  usersPage: (page: number, limit: number) =>
    `users:page:${page}:limit:${limit}`,
} as const;
