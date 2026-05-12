import { prisma } from "../../../config/db";
import { getRedis } from "../../../config/redis";
// import { getRedisClient } from "../../../config/redis";

export const getFollowers = async (userId: string) => {
  const redisClient = (await getRedis()).getClient();
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
  const redisClient = (await getRedis()).getClient();
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
  const redisClient = (await getRedis()).getClient();

  if (followerId === followingId) {
    throw new Error("You cannot follow yourself");
  }
  // followerId : current User
  // followingId : the person i am going to follow

  await prisma.follow.create({
    data: {
      followerId: followerId as string,
      followingId: followingId as string,
    },
  });

  await redisClient.sAdd(`followers:${followingId}`, followerId as string);
  await redisClient.sAdd(`following:${followerId}`, followingId as string);

  return { success: true };
};
export const unfollowUser = async (followerId: String, followingId: String) => {
  const redisClient = (await getRedis()).getClient();
  await prisma.follow.delete({
    where: {
      followerId_followingId: {
        followerId: followerId as string,
        followingId: followingId as string,
      },
    },
  });

  // Redis sync
  await redisClient.sRem(`followers:${followingId}`, followerId);
  await redisClient.sRem(`following:${followerId}`, followingId);

  return { success: true };
};
