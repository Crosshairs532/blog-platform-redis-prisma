import { prisma } from "../../../config/db";
import { getRedisClient } from "../../../config/redis";

export const getFollowers = async (userId) => {
  const redisClient = getRedisClient();
  const followers = await redisClient.sMembers(`followers:${userId}`);
  return followers;
};
export const getFollowing = async (userId) => {
  const redisClient = getRedisClient();
  return await redisClient.sMembers(`following:${userId}`);
};

export const followUser = async (followerId: String, followingId: String) => {
  const redisClient = getRedisClient();

  if (followerId === followingId) {
    throw new Error("You cannot follow yourself");
  }

  await prisma.follow.create({
    data: {
      followerId,
      followingId,
    },
  });

  await redisClient.sAdd(`followers:${followingId}`, followerId);
  await redisClient.sAdd(`following:${followerId}`, followingId);

  return { success: true };
};

export const unfollowUser = async (followerId: String, followingId: String) => {
  const redisClient = getRedisClient();
  await prisma.follow.delete({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });

  // Redis sync
  await redisClient.sRem(`followers:${followingId}`, followerId);
  await redisClient.sRem(`following:${followerId}`, followingId);

  return { success: true };
};
