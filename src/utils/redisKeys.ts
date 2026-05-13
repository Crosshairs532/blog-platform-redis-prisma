export const RedisKeys = {
  //* auth & session
  userSessions: (userId: string) => `user:${userId}:sessions`,
  session: (sessionId: string) => `session:${sessionId}`,
  blacklist: (token: string) => `blacklist:${token}`,
  sessionPrefix: "session:",

  //* social
  followers: (userId: string) => `followers:${userId}`,
  following: (userId: string) => `following:${userId}`,

  //* Profile & Posts
  userProfile: (userId: string) => `user:${userId}:profile`,
  userPosts: (userId: string, page: number) => `user:${userId}:posts`,
  post: (postId: string) => `post:${postId}`,
  highProfileUsers: `high_profile_users`,
  //* feed
  feed: (userId: string) => `feed:${userId}`,

  //* notification
  notifications: (userId: string) => `notifications:${userId}`,

  //*
  usersPage: (page: number, limit: number) =>
    `users:page:${page}:limit:${limit}`,
} as const;
