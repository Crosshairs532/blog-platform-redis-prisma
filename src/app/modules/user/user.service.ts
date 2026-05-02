import { prisma } from "../../../config/db";
import { getRedisClient } from "../../../config/redis";
import { AppError } from "../../../utils/ AppError";
import { RedisKeys } from "../../../utils/redisKeys";

const getUserProfile = async (
  targetUserId: string,
  loggedInUserId?: string,
) => {
  const redisClient = getRedisClient();
  const cacheKey = RedisKeys.userProfile(targetUserId);

  try {
    // Try cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    throw new AppError("Something went wrong while getting user profile!", 500);
  }

  // DB Read
  const TargetUserProfile = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      username: true,
      bio: true,
      createdAt: true,
      email: true,
    },
  });
  const TargetUserFollowingIds = await prisma.follow.count({
    where: { followingId: targetUserId },
  });
  const TargetUserFollowerIds = await prisma.follow.count({
    where: { followerId: targetUserId },
  });
  const TargetUserPosts = await prisma.post.count({
    where: { userId: targetUserId },
  });

  const isCurrentUserFollowTargetUserId =
    loggedInUserId &&
    (await prisma.follow.count({
      where: {
        followerId: loggedInUserId,
        followingId: targetUserId,
      },
    }));

  const [user, followerCount, followingCount, postCount, isFollowed] =
    await Promise.all([
      TargetUserProfile,
      TargetUserFollowingIds,
      TargetUserFollowerIds,
      TargetUserPosts,
      isCurrentUserFollowTargetUserId,
    ]);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const profile = {
    user: {
      id: user.id,
      username: user.username,
      bio: user.bio,
      createdAt: user.createdAt,
      followerCount,
      followingCount,
      postCount,
      isFollowedByLoggedInUser: (isFollowed as any) > 0,
    },
  };

  // cache the profile
  await redisClient.set(cacheKey, JSON.stringify(profile), {
    EX: 300,
  });
  return profile;
};

export const getUserPosts = async (
  targetUserId: string,
  loggedInUserId: string,
  page: number = 0,
  limit: number = 10,
) => {
  const redisClient = getRedisClient();
  const cacheKey = RedisKeys.userPosts(targetUserId, page);
  const offset = page * limit;

  try {
    // Try cache for paginated posts
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error("Redis get failed:", error);
  }

  // total post count of the target user
  const total = await prisma.post.count({
    where: { userId: targetUserId },
  });

  /*
    get user posts
    user details 
    comments -- comment user id
  */
  const posts = await prisma.post.findMany({
    where: { userId: targetUserId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          bio: true,
        },
      },
      comments: {
        take: 3,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      _count: {
        select: { comments: true, reposts: true },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
  });

  // get my reposts from the targeted users posts.

  const postIds = posts.map((p) => p.id);
  const repostedPosts = await prisma.repost.findMany({
    where: {
      userId: loggedInUserId,
      postId: { in: postIds },
    },
    select: { postId: true },
  });

  const repostedSet = new Set(repostedPosts.map((r) => r.postId));

  const postsWithStatus = posts.map((post) => ({
    ...post,
    isRepostedByCurrentUser: repostedSet.has(post.id),
  }));

  const result = {
    data: postsWithStatus,
  };

  await redisClient.set(cacheKey, JSON.stringify(result), {
    EX: 120,
  });

  return result;
};

export const updateUserService = async (userId: string, userData: any) => {
  const { username, bio } = userData;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(bio !== undefined && { bio }),
      ...(username !== undefined && { username }),
    },
    select: {
      id: true,
      username: true,
      bio: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Invalidate cache AFTER DB update
  await invalidateUserCache(userId);

  return updatedUser;
};
export const invalidateUserCache = async (userId: string) => {
  const redisClient = getRedisClient();
  const profileKey = RedisKeys.userProfile(userId);
  const pattern = RedisKeys.userPosts(userId, 0);

  await redisClient.del(profileKey);
  await redisClient.del(pattern);
};

export const userService = {
  getUserProfile,
  getUserPosts,
  updateUserService,
};
