import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const isProd = process.env.NODE_ENV === "production"

const authOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  session: { strategy: "jwt" as const },
  useSecureCookies: isProd,

  cookies: {
    state: {
      name: isProd ? "__Secure-next-auth.state" : "next-auth.state",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: isProd,
      },
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
