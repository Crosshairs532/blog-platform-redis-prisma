import { newPostTemplate } from "../app/modules/notification/emailTemplate";
import { sendEmail } from "../app/modules/notification/queue.service";
import { prisma } from "../config/db";
// import { getRedisClient } from "../config/redis";
import pLimit from "p-limit";
import { AppError } from "../utils/ AppError";
import { getRedis } from "../config/redis";

const limit = pLimit(5);
let isShuttingDown = false;
const inFlight = new Set<Promise<any>>();

const processEmailJob = async (job: any) => {
  const { toUserId, type, postId, actorId } = job;
  const user = await prisma.user.findUnique({
    where: { id: toUserId },
  });

  if (!user) return;
  let emailData;
  let actor;
  if (type === "NEW_POST") {
    actor = actorId
      ? await prisma.user.findUnique({ where: { id: actorId } })
      : null;

    emailData = newPostTemplate({
      username: actor?.username || actor?.email || "Someone you follow",
      postId,
    });
  }
  await sendEmail({
    name: actor?.username,
    to: user.email,
    subject: emailData?.subject,
    html: emailData?.html,
    text: emailData?.text,
  });
};

export const startEmailWorker = async () => {
  console.log("Email worker running....");
  const redis = (await getRedis()).getClient();
  try {
    while (true) {
      if (isShuttingDown) break;
      try {
        const job = await redis.brPop("queue:email", 5);
        if (!job) continue;

        const parsed = JSON.parse(job?.element);

        console.log("parsed from startWorker: ", parsed);

        // tracking how many times Email sending have been retired
        parsed.attempts = (parsed.attempts || 0) + 1;

        // retry failed mails
        const task = limit(() => processEmailJob(parsed)).catch(async (err) => {
          console.error("Email job failed:", err);
          if (parsed.attempts < 3) {
            await redis.lPush("queue:email", JSON.stringify(parsed));
          } else {
            await redis.lPush("queue:email:dead", JSON.stringify(parsed));
          }
        });

        inFlight.add(task);
        task.finally(() => inFlight.delete(task));
      } catch (error: any) {
        console.error("Worker poll error:", error);
        await new Promise((r) => setTimeout(error, 1000));
      }
    }
  } catch (error: any) {
    console.error(error);
    console.log("New Dev-1-2");
    await new Promise((r) => setTimeout(r, 1000));
    console.error("main Branch: ", error);
    throw new AppError(error?.message, 500);
  }
};

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  isShuttingDown = true;
  await Promise.allSettled(inFlight);
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
