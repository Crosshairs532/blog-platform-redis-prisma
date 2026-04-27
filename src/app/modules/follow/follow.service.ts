import { prisma } from "../../../config/db";
import { getRedisClient } from "../../../config/redis";

export const getFollowers = async (userId: string) => {
  const redisClient = getRedisClient();
  let followers = await redisClient.sMembers(`followers:${userId}`);

  console.log("Followers: ", followers);
  if (followers.length === 0) {
    const data = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    });

    followers = data.map((f) => f.followerId);

    if (followers.length > 0) {
      await redisClient.sAdd(`followers:${userId}`, followers);
      await redisClient.expire(`followers:${userId}`, 3600);
    }
  }
  return followers;
};
export const getFollowing = async (userId: string) => {
  const redisClient = getRedisClient();
  let following = await redisClient.sMembers(`following:${userId}`);
  if (following.length === 0) {
    const data = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    following = data.map((f) => f.followingId);

    if (following.length > 0) {
      await redisClient.sAdd(`following:${userId}`, following);
    }
  }
  return following;
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
