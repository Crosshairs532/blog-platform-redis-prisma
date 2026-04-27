import { prisma } from "../../../config/db";
import { getRedisClient } from "../../../config/redis";

export const createPost = async (userId: string, content: string) => {
  const redisClient = await getRedisClient();
  const post = await prisma.post.create({
    data: { userId, content },
  });

  // post:abjgajrbg#
  const postKey = `post:${post.id}`;
  const timestamp = Date.now();

  await redisClient.set(postKey, JSON.stringify(post), {
    EX: 60,
  });

  const followers = await redisClient.sMembers(`followers:${userId}`);

  followers.push(String(userId));
  console.log(" followers: ", followers);
  const pipeline = redisClient.multi();

  for (const followerId of followers) {
    pipeline.zAdd(`feed:${followerId}`, {
      score: timestamp,
      value: `post:${post.id}`,
    });
  }
  await pipeline.exec();

  return post;
};

export const getFeed = async (userId: string, page = 0, limit = 10) => {
  const redisClient = await getRedisClient();
  const start = page * limit;
  const end = start + limit - 1;

  // items = ["post:12", "post:9", ...]
  const items = await redisClient.zRange(`feed:${userId}`, start, end, {
    REV: true,
  });

  if (!items || items.length === 0) {
    return [];
  }
  console.log("items", userId, items);
  const cachedPosts = await redisClient.mGet(items);
  const posts: any[] = [];
  const missingPostIds: number[] = [];
  const missingIndices: number[] = [];

  console.log("cachedPosts", cachedPosts);
  console.log("missingPostIds", missingPostIds);
  cachedPosts.forEach((data, index) => {
    if (data) {
      posts[index] = JSON.parse(data);
    } else {
      // if you have the key but no value ,
      // it means the post was created but not cached yet, so we need to fetch it from the database
      const id = items[index].split(":")[1];
      missingPostIds.push(id);
      missingIndices.push(index);
    }
  });
  if (missingPostIds.length > 0) {
    const dbPosts = await prisma.post.findMany({
      where: { id: { in: missingPostIds } },
    });

    for (const dbPost of dbPosts) {
      const key = `post:${dbPost.id}`;
      await redisClient.set(key, JSON.stringify(dbPost), { EX: 60 });

      const originalIndex = missingPostIds.indexOf(dbPost?.id);
      const targetIndex = missingIndices[originalIndex];
      posts[targetIndex] = dbPost;
    }
  }

  return posts.filter((post) => post !== undefined);
};

export const createRepost = async (userId: string, postId: string) => {
  const redisClient = await getRedisClient();
  const repost = await prisma.repost.create({
    data: { userId, postId },
  });

  const timestamp = Date.now();

  const followers = await redisClient.sMembers(`followers:${userId}`);
  followers.push(String(userId));

  const pipeline = redisClient.multi();

  for (const followerId of followers) {
    pipeline.zAdd(`feed:${followerId}`, {
      score: timestamp,
      value: `repost:${repost.id}`,
    });
  }

  await pipeline.exec();

  return repost;
};
