export const newPostTemplate = ({ username, postId }) => {
  return {
    subject: "New Post from someone you follow 🚀",
    html: `
      <h2>${username} just posted</h2>
      <p>Check it out!</p>
      <a href="http://localhost:3000/posts/${postId}">
        View Post
      </a>
    `,
  };
};
