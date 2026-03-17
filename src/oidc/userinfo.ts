import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { AppContext } from "../index";

export function createUserInfoHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }

    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, ctx.keys.publicKey, {
        algorithms: ["RS256"],
      }) as Record<string, unknown>;

      const sub = decoded.sub as string;
      const user = ctx.userPoolStore.getUser(ctx.config.userPoolId, sub);
      if (!user) {
        res.status(404).json({ error: "user_not_found" });
        return;
      }

      const claims: Record<string, unknown> = {
        sub: user.username,
        email: user.email,
        email_verified: user.attributes.email_verified === "true",
        name: user.attributes.name,
        nickname: user.attributes.nickname,
        given_name: user.attributes.given_name,
        family_name: user.attributes.family_name,
        "cognito:username": user.username,
        "cognito:groups": user.groups,
      };

      // Add any additional profile attributes
      const profileAttrs = [
        "phone_number",
        "picture",
        "locale",
        "address",
        "birthdate",
        "gender",
        "middle_name",
        "preferred_username",
        "profile",
        "website",
        "zoneinfo",
      ];

      for (const attr of profileAttrs) {
        if (user.attributes[attr]) {
          claims[attr] = user.attributes[attr];
        }
      }

      // Remove undefined values
      const filtered = Object.fromEntries(
        Object.entries(claims).filter(([, v]) => v !== undefined)
      );

      res.json(filtered);
    } catch {
      res.status(401).json({ error: "invalid_token" });
    }
  };
}
