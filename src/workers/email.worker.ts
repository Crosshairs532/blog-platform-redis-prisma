import { newPostTemplate } from "../app/modules/notification/emailTemplate";
import { sendEmail } from "../app/modules/notification/queue.service";
import { prisma } from "../config/db";
import { getRedisClient } from "../config/redis";

const processEmailJob = async (job) => {
  const { toUserId, type, postId } = job;
  const user = await prisma.user.findUnique({
    where: { id: Number(toUserId) },
  });

  if (!user) return;
  let emailData;
  if (type === "NEW_POST") {
    emailData = newPostTemplate({
      username: "Someone you follow",
      postId,
    });
  }
  await sendEmail({
    to: user.email,
    subject: emailData?.subject,
    html: emailData?.html,
  });
};

const startWorker = async () => {
  const redis = getRedisClient();
  while (true) {
    const job = await redis.brPop("queue:email", 0);

    if (job) {
      const parsed = JSON.parse(job);
      await processEmailJob(parsed);
    } else {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
};

startWorker();
