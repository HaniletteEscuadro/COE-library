import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/students/:path*",
    "/academics/:path*",
    "/library/:path*",
    "/admin/:path*",
    "/chat/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/security/:path*",
  ],
};
