import NextAuth from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';

if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
  console.error('错误：GitHub OAuth 环境变量未设置！请检查 .env.local 文件。');
}
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('错误：Google OAuth 环境变量未设置！请检查 .env.local 文件。');
}
if (!process.env.NEXTAUTH_SECRET) {
  console.error('错误：NEXTAUTH_SECRET 环境变量未设置！');
}

export const authOptions = {
  providers: [
    GithubProvider.default({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
    GoogleProvider.default({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.id = profile?.id || account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      if (session.user) {
        session.user.id = token.id;
      } else {
        session.user = { id: token.id };
      }
      return session;
    },
  },
};

const handler = NextAuth.default(authOptions);

export { handler as GET, handler as POST };
