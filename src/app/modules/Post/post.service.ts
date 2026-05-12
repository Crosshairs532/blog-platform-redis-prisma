import { getRedis, RedisClient } from "./../../../config/redis";
import { prisma } from "../../../config/db";
// import { getRedisClient } from "../../../config/redis";
import { RedisKeys } from "../../../utils/redisKeys";
import { createNotification } from "../notification/notification.service";
import { follow } from "../follow/follow.controller";
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
    await redisClient.sAdd("high_profile_users", userId);
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
  //!  previous Code - before rabbitMQ
  /*

      // find user followers
      const followers = await redisClient.sMembers(`followers:${userId}`);

      // fan-out write to followers
      console.log(" followers: ", followers);

      // transaction started
      const pipeline = redisClient.multi();

      // notification creation + email queue push
      const notificationPromises = followers.map(async (followerId: string) => {
        try {
          await pipeline.lPush(
            "queue:email",
            JSON.stringify({
              toUserId: followerId,
              type: "NEW_POST",
              postId: post.id,
              actorId: userId,
            }),
          );

          // create notification on DB
          // push on redis queue
          // await createNotification({
          //   userId: followerId,
          //   type: "POST_CREATED",
          //   data: { actorId: userId, postId: post.id },
          // });
        } catch (err) {
          console.error(`Failed to notify follower ${followerId}:`, err);
        }
      });

      await Promise.allSettled(notificationPromises);

      // follower feed update
      // for (const followerId of followers) {
      //   pipeline.zAdd(`feed:${followerId}`, {
      //     score: timestamp,
      //     value: `post:${post.id}`,
      //   });
      // }
      await pipeline.exec();
  */

  return post;
};

// export const getFeed = async (userId: string, page = 0, limit = 10) => {
//   const redisClient = (await getRedis()).getClient();
//   const start = page * limit;
//   const end = start + limit - 1;

//   // items = ["post:12", "post:9", ...]
//   const items = await redisClient.zRange(`feed:${userId}`, start, end, {
//     REV: true,
//   });

//   if (!items || items.length === 0) {
//     return [];
//   }
//   console.log("items", userId, items);
//   const cachedPosts = await redisClient.mGet(items);
//   const posts: any[] = [];
//   const missingPostIds: number[] = [];
//   const missingIndices: number[] = [];

//   console.log("cachedPosts", cachedPosts);
//   console.log("missingPostIds", missingPostIds);
//   cachedPosts.forEach((data, index) => {
//     if (data) {
//       posts[index] = JSON.parse(data);
//     } else {
//       // if you have the key but no value ,
//       // it means the post was created but invalidated,
//       // so we need to fetch it from the database
//       const id = items[index].split(":")[1];
//       missingPostIds.push(id);
//       missingIndices.push(index);
//     }
//   });
//   if (missingPostIds.length > 0) {
//     const dbPosts = await prisma.post.findMany({
//       where: { id: { in: missingPostIds } },
//       include: {
//         user: true,
//         comments: true,
//       },
//     });

//     for (const dbPost of dbPosts) {
//       const key = `post:${dbPost.id}`;
//       await redisClient.set(key, JSON.stringify(dbPost), { EX: 60 });

//       const originalIndex = missingPostIds.indexOf(dbPost?.id);
//       const targetIndex = missingIndices[originalIndex];
//       posts[targetIndex] = dbPost;
//     }
//   }

//   return posts.filter((post) => post !== undefined);
// };

export const getFeed = async (userId: string, page = 0, limit = 20) => {
  const redis = (await getRedis()).getClient();
  const start = page * limit;
  const end = start + limit - 1;

  // 1. Get the "Regular" Feed (Pushed posts)
  const regularPostIds = await redis.zRange(`feed:${userId}`, start, end, {
    REV: true,
  });

  // 2. FIND CELEBRITIES: Intersection between [Who I follow] and [High Profile Users]
  // This is an O(N) operation in Redis, extremely fast.
  const myCelebrities = await redis.sInter([
    `following:${userId}`,
    "high_profile_users",
  ]);

  let celebrityPostIds: string[] = [];

  if (myCelebrities.length > 0) {
    // 3. Get the latest Post IDs from these celebrities
    // We assume celebrity posts are cached in their own sorted sets
    const pipeline = redis.multi();
    for (const celebId of myCelebrities) {
      // Get the last 20 posts from each celebrity
      pipeline.zRange(`user:${celebId}:posts`, 0, 20, { REV: true });
    }
    const results: any = await pipeline.exec();
    celebrityPostIds = results?.flat() as string[];
  }

  // 4. COMBINE & FETCH FULL OBJECTS
  // Combine IDs from regular feed + celebrity posts
  const allIds = Array.from(new Set([...regularPostIds, ...celebrityPostIds]));

  // 5. MGET from Redis to get the actual Post JSON
  const cachedPosts = await redis.mGet(allIds.map((id) => `post:${id}`));

  let posts = cachedPosts
    .filter((p) => p !== null)
    .map((p) => JSON.parse(p as string));

  // 6. RE-SORT (Because celebrity posts were injected out of order)
  // We sort by createdAt DESC
  posts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // 7. PAGINATE the merged results
  return posts.slice(0, limit);
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
