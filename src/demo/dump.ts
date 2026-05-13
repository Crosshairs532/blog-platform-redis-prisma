// export const loginUser = async (req: any, { email, password }: any) => {
//   console.time("loginTime");
//   /*
//      1. Check if user exists
//      2. Get all the sessions
//      3. Check of same device login
//      4. Remove the old login infos and update the session
//      5. Check for Max login Exceed
//      6. generate a session ID
//   */

//   const redisClient: any = (await getRedis()).getClient();
//   const user = await prisma.user.findUnique({
//     where: { email },
//   });
//   if (!user) throw new Error("User not found");
//   //* Hash Password
//   const isValid = await bcrypt.compare(password, user.passwordHash);
//   if (!isValid) throw new Error("Invalid password");
//   //* generate session Id
//   const sessionId = `${user.id}-${Date.now()}`;
//   console.info(sessionId);
//   const JwtPayload = {
//     userId: user.id,
//     sessionId: sessionId,
//     email: user.email,
//   };

//   console.log({ JwtPayload });

//   //* maximum Session Exceed Logic
//   const sessionIds = await redisClient.sMembers(`user:${user?.id}:sessions`);

//   const ua = new UAParser(req.headers["user-agent"]).getResult();
//   const deviceName = `${ua.browser.name || "Unknown"} on ${ua.os.name || "Unknown"}`;

//   // check if logged in from same device and save browser
//   let existingSessionId = null;
//   for (const sid of sessionIds) {
//     const sessionData = await redisClient.hGetAll(`session:${sid}`);
//     if (
//       sessionData.deviceInfo === deviceName &&
//       sessionData.ipAddress === req.ip
//     ) {
//       existingSessionId = sid;
//       break;
//     }
//   }
//   if (existingSessionId) {
//     // Same device - remove old session, allow new one
//     await redisClient.del(`session:${existingSessionId}`);
//     await redisClient.sRem(`user:${user.id}:sessions`, existingSessionId);
//     // Remove from sessionIds array for limit check
//     const index = sessionIds.indexOf(existingSessionId);
//     if (index > -1) sessionIds.splice(index, 1);
//   }

//   //! check if user login session limit exceeded
//   if (sessionIds.length >= 2) {
//     throw new Error("Maximum login sessions exceeded");
//   }

//   const accessToken = generateToken(JwtPayload, "1h");
//   const refreshToken = generateToken(JwtPayload, "7d");

//   const sessionData = {
//     sessionId: sessionId,
//     userId: user.id,
//     email: user.email,
//     accessToken: accessToken,
//     refreshToken: refreshToken,
//     deviceInfo: deviceName,
//     ipAddress: req.ip,
//     createdAt: Date.now(),
//     lastActivity: Date.now(),
//     isActive: "true",
//   };
//   console.info("session Data: ", sessionData);

//   // user:userId:sessions: {} ---> key
//   // session:sessionId: {userId, email, deviceInfo, ipAddress, createdAt, lastActivity}

//   //! redis
//   const USER_SESSIONS_KEY = `user:${user.id}:sessions`;
//   const SESSION_KEY = `session:${sessionId}`;

//   await redisClient.sAdd(USER_SESSIONS_KEY, sessionId);
//   await redisClient.hSet(SESSION_KEY, sessionData);
//   await redisClient.expire(SESSION_KEY, 60 * 60 * 24 * 7);

//   console.timeEnd("loginTime");
//   return {
//     success: true,
//     accessToken,
//     refreshToken,
//     sessionId,
//     user: { id: user.id, email: user.email, username: user.username },
//   };
// };

// ######### Get Feed #############
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
