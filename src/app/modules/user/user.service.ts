import { prisma } from "../../../config/db";
import { getRedis } from "../../../config/redis";
// import { getRedisClient } from "../../../config/redis";
import { AppError } from "../../../utils/ AppError";
import { RedisKeys } from "../../../utils/redisKeys";

const getAllUsers = async (
  id: string,
  limit: number = 10,
  page: number = 2,
) => {
  const redisClient = (await getRedis()).getClient();
  const cacheKey = `users:page:${page}:limit:${limit}`;

  try {
    // cache read
    console.time("redisGet");
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      console.timeEnd("redisGet");
      return JSON.parse(cached);
    }

    // db fallback
    console.time("db");
    const users = await prisma.user.findMany({
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
      where: { id: { not: id } },
      select: {
        id: true,
        username: true,
        email: true,
        bio: true,
        createdAt: true,
        _count: { select: { followers: true, following: true, posts: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    console.timeEnd("db");

    // cache write
    console.time("stringify");
    const stringUsers = JSON.stringify(users);
    console.timeEnd("stringify");
    console.time("redisSet");
    await redisClient.set(cacheKey, stringUsers, {
      EX: 60 * 5,
    });
    console.timeEnd("redisSet");

    return { data: users, page };
  } catch (error) {
    console.error(error);
    throw new AppError("Something went wrong while fetching users!", 500);
  }
};

const getUserProfile = async (
  targetUserId: string,
  loggedInUserId?: string,
) => {
  const redisClient = (await getRedis()).getClient();
  const cacheKey = RedisKeys.userProfile(targetUserId);

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [user, followerCount, followingCount, postCount, isFollowed] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: targetUserId },
          select: {
            id: true,
            username: true,
            bio: true,
            createdAt: true,
            email: true,
            posts: {
              select: { id: true, content: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take: 3,
            },
          },
        }),
        prisma.follow.count({ where: { followingId: targetUserId } }),
        prisma.follow.count({ where: { followerId: targetUserId } }),
        prisma.post.count({ where: { userId: targetUserId } }),
        loggedInUserId
          ? prisma.follow.count({
              where: { followerId: loggedInUserId, followingId: targetUserId },
            })
          : 0,
      ]);

    if (!user) throw new AppError("User not found", 404);

    const profile = {
      user: {
        id: user.id,
        username: user.username,
        bio: user.bio,
        createdAt: user.createdAt,
        email: user.email,
        followerCount,
        followingCount,
        postCount,
        isFollowedByLoggedInUser: isFollowed > 0,
        posts: user.posts,
      },
    };

    await redisClient.set(cacheKey, JSON.stringify(profile), { EX: 300 });

    return profile;
  } catch (error) {
    throw new AppError("Something went wrong while getting user profile!", 500);
  }
};
export const getUserPosts = async (
  targetUserId: string,
  loggedInUserId: string,
  page: number = 0,
  limit: number = 10,
) => {
  const redisClient = (await getRedis()).getClient();
  const cacheKey = RedisKeys.userPosts(targetUserId, page);
  const offset = page * limit;

  try {
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
    get target user posts
    targetUser details 
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
    // skip: offset,
    // take: limit,
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

  const repostedSet = new Set(repostedPosts.map((r) => r.postId)); // unique  reposted posts

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
  const redisClient = (await getRedis()).getClient();

  const pipeline = redisClient.multi();
  pipeline.del(RedisKeys.userProfile(userId));

  const stream = redisClient.scanIterator({
    MATCH: `user:${userId}:posts:*`,
    COUNT: 100,
  });
  for await (const key of stream) {
    pipeline.del(key);
  }
  const userListStream = redisClient.scanIterator({
    MATCH: "users:page:*",
    COUNT: 100,
  });
  for await (const key of userListStream) {
    pipeline.del(key);
  }

  await pipeline.exec();
};

export const userService = {
  getAllUsers,
  getUserProfile,
  getUserPosts,
  updateUserService,
};
