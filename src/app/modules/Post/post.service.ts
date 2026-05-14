import { getRedis, RedisClient } from "./../../../config/redis";
import { prisma } from "../../../config/db";
import { RedisKeys } from "../../../utils/redisKeys";
import { rabbitMQ } from "../../../config/rabbitmq";

// post --> middleware --> post create
// use  --> single post, all post -- feed -- follow
//  post --> follower
// fan-out - write

/*
  create post --- high_prof:[logged in user ID, ]
*/

const CELEBRITY_THRESHOLD = 10000;
export const createPost = async (userId: string, content: string) => {
  // get redis client
  const redisClient = (await getRedis()).getClient();

  // create post in db
  const post = await prisma.post.create({
    data: { userId, content },
    include: { user: { select: { username: true } } },
  });

  // create post cache key
  const postKey = RedisKeys.post(post?.id);
  const timestamp = Date.now();

  await redisClient.set(postKey, JSON.stringify(post), {
    EX: 86400,
  });

  /*
    after post creation we will notify followers
  */

  // checkig celebrity or not
  const followerCount = await prisma.follow.count({
    where: { followingId: userId },
  });

  if (followerCount > CELEBRITY_THRESHOLD) {
    // users will high followers will not fan out
    // followers will pull the posts when they login
    await redisClient.sAdd(RedisKeys.highProfileUsers, userId);

    await redisClient.zAdd(RedisKeys.userPosts(userId, 10), {
      score: timestamp,
      value: post?.id,
    });
  } else {
    //* fanout to followers using rabbitMQ
    const channel = rabbitMQ.getChannel();
    const message = JSON.stringify({
      postId: post.id,
      authorId: userId,
      timestamp: post.createdAt.getTime(),
    });

    channel.sendToQueue("post_fanout_queue", Buffer.from(message), {
      persistent: true,
    });
    console.log(`post added to post_fanout_queue:  ${message}`);
  }
  return post;
};

export const getFeed = async (userId: string, page = 0, limit = 20) => {
  console.log("Feed called");
  const redis = (await getRedis()).getClient();
  const start = page * limit;
  const end = start + limit - 1;

  // Parallel Fetch: Regular Feed IDs + Celebrity IDs
  const [regularPostIds, myCelebrities] = await Promise.all([
    redis.zRange(RedisKeys.feed(userId), start, end, { REV: true }),
    redis.sInter([RedisKeys.following(userId), RedisKeys.highProfileUsers]),
  ]);

  let celebrityPostIds: string[] = [];
  if (myCelebrities.length > 0) {
    const pipeline = redis.multi();
    myCelebrities.forEach((celebId) => {
      // Pull only the most recent posts to merge
      pipeline.zRange(RedisKeys.userPosts(celebId, 10), 0, 20, { REV: true });
    });
    const results = await pipeline.exec();
    celebrityPostIds = (results as any).flat();
  }

  //  Combine and Fetch
  const allIds: any = Array.from(
    new Set([...regularPostIds, ...celebrityPostIds]),
  );

  if (allIds.length === 0) {
    console.log("Dhukse ==================");
    // db fallback
    // following user post id
    const currentUserFollowingIds = await redis.sMembers(
      RedisKeys.following(userId),
    );
    console.log({ currentUserFollowingIds });

    const dbFeed = await prisma.post.findMany({
      where: {
        userId: { in: currentUserFollowingIds },
      },
      orderBy: { createdAt: "desc" },
      skip: start,
      take: limit,
      include: { user: { select: { username: true } } },
    });

    // cache posts
    const pipe = redis.multi();
    dbFeed.forEach((p) =>
      pipe.set(`post:${p.id}`, JSON.stringify(p), { EX: 3600 }),
    );
    await pipe.exec();
    return dbFeed;
  }
  const cachedPosts = await redis.mGet(allIds.map((id: any) => `post:${id}`));
  const posts: any[] = [];
  const missingIds: string[] = [];

  cachedPosts.forEach((data, index) => {
    if (data) posts.push(JSON.parse(data));
    else missingIds.push(allIds[index]);
  });

  console.log(missingIds, "missingIds");

  //  Database Fallback (Batch Fetch)
  if (missingIds.length > 0) {
    const dbPosts = await prisma.post.findMany({
      where: { id: { in: missingIds } },
      include: { user: { select: { username: true } } },
    });
    posts.push(...dbPosts);
    const pipe = redis.multi();
    dbPosts.forEach((p) =>
      pipe.set(`post:${p.id}`, JSON.stringify(p), { EX: 3600 }),
    );
    await pipe.exec();
  }

  //  Sort by Date and Slice for Pagination
  return posts
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
};

export const createRepost = async (userId: string, postId: string) => {
  const redisClient = (await getRedis()).getClient();
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
