const appUrl = process.env.APP_URL || "http://localhost:3000";

export const newPostTemplate = ({
  username,
  postId,
}: {
  username: string;
  postId: string | number;
}) => {
  const link = `${appUrl}/posts/${postId}`;

  return {
    subject: `${username} just posted 🚀`,
    text: `${username} just posted. Check it out at ${link}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${username} just posted</h2>
        <p>Check it out!</p>
        <a href="${link}" style="display:inline-block;padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:4px;">
          View Post
        </a>
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #888;">
          You received this because you follow ${username}.<br />
          <a href="${appUrl}/unsubscribe">Unsubscribe</a>
        </p>
      </div>
    `,
  };
};
