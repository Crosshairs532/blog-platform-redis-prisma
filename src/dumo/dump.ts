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
