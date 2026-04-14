import express from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { users, accessTokens, roles, memberships, projects } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { generateId } from '../lib/uuid.js';
import { authMiddleware, signJwt, encryptAes, sha256 } from '../middleware/auth.js';

const router = express.Router();

const CALLBACK_BASE = process.env.AUTH_CALLBACK_BASE || 'http://localhost:5173/apis/auth/callback';
//const APP_BASE = process.env.CLIENT_BASE_URL || 'http://localhost:5173';

const PROVIDERS_CONFIG = {
  gitlab: {
    authorizeUrl: process.env.GITLAB_AUTHORIZE_URL || 'https://gitlab.com/oauth/authorize',
    tokenUrl: process.env.GITLAB_TOKEN_URL || 'https://gitlab.com/oauth/token',
    userUrl: process.env.GITLAB_USER_URL || 'https://gitlab.com/api/v4/user',
    clientId: process.env.GITLAB_CLIENT_ID,
    clientSecret: process.env.GITLAB_CLIENT_SECRET,
    scope: process.env.GITLAB_OAUTH_SCOPE || 'api read_api read_user openid email profile read_repository write_repository',
  },
  github: {
    authorizeUrl: process.env.GITHUB_AUTHORIZE_URL || 'https://github.com/login/oauth/authorize',
    tokenUrl: process.env.GITHUB_TOKEN_URL || 'https://github.com/login/oauth/access_token',
    userUrl: process.env.GITHUB_USER_URL || 'https://api.github.com/user',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    scope: process.env.GITHUB_OAUTH_SCOPE || 'read:user user:email repo',
  },
  google: {
    authorizeUrl: process.env.GOOGLE_AUTHORIZE_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
    userUrl: process.env.GOOGLE_USER_URL || 'https://www.googleapis.com/oauth2/v2/userinfo',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    scope: process.env.GOOGLE_OAUTH_SCOPE || 'openid email profile',
  },
};

function buildAuthUrl(provider: string, state: string) {
  const cfg = PROVIDERS_CONFIG[provider as keyof typeof PROVIDERS_CONFIG];
  if (!cfg) throw new Error('Unsupported provider');

  const params = new URLSearchParams({
    client_id: cfg.clientId || '',
    redirect_uri: `${CALLBACK_BASE}/${provider}`,
    response_type: 'code',
    scope: cfg.scope,
    state,
    prompt: 'consent',
  });
  if (provider === 'github') params.set('allow_signup', 'true');
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

router.get('/login/:provider', (req, res) => {

  console.log("Inside the auth provider redirection flow !");

  const provider = req.params.provider;
  if (!PROVIDERS_CONFIG[provider as keyof typeof PROVIDERS_CONFIG]) {
    return res.status(400).json({ error: 'Unknown provider' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const url = buildAuthUrl(provider, state);

  // We are not storing server-side state for brevity; in production store it.
  res.redirect(url);
});

async function fetchToken(provider: string, code: string) {
  const cfg = PROVIDERS_CONFIG[provider as keyof typeof PROVIDERS_CONFIG];
  if (!cfg) throw new Error('Unsupported provider');

  const body = new URLSearchParams({
    client_id: cfg.clientId || '',
    client_secret: cfg.clientSecret || '',
    code,
    grant_type: 'authorization_code',
    redirect_uri: `${CALLBACK_BASE}/${provider}`,
  });

  const response = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${provider}): ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

import { getGithubEmailsUrl } from '../lib/git-config.js';

async function fetchUser(provider: string, accessToken: string) {
  const cfg = PROVIDERS_CONFIG[provider as keyof typeof PROVIDERS_CONFIG];
  if (!cfg) throw new Error('Unsupported provider');

  const response = await fetch(cfg.userUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`User info fetch failed (${provider}): ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  // GitHub may return null email if the user has set it to private.
  // Fall back to the /user/emails endpoint to get the primary verified email.
  if (provider === 'github' && !data.email) {
    const emailsRes = await fetch(getGithubEmailsUrl(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (emailsRes.ok) {
      const emails: { email: string; primary: boolean; verified: boolean }[] = await emailsRes.json();
      const primary = emails.find(e => e.primary && e.verified) || emails.find(e => e.verified) || emails[0];
      if (primary) data.email = primary.email;
    }
  }

  console.debug("Logged in user info : ", data);
  return data;
}

function authErrorPage(res: any, message: string) {
  const escaped = message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authentication Error</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #09090b; color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 40px 36px; max-width: 480px; width: 100%; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 12px; color: #fafafa; }
    p { font-size: 14px; color: #a1a1aa; line-height: 1.6; margin-bottom: 28px; word-break: break-word; }
    a { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; transition: background 0.15s; }
    a:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Authentication Failed</h1>
    <p>${escaped}</p>
    <a href="/app/login">Back to Login</a>
  </div>
</body>
</html>`);
}

router.get('/callback/:provider', async (req, res) => {
  try {
    const provider = req.params.provider;
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      return authErrorPage(res, 'Missing authorization code. Please try logging in again.');
    }

    const tokenPayload = await fetchToken(provider, code);
    const accessToken = tokenPayload.access_token;
    if (!accessToken) {
      const detail = tokenPayload.error_description || tokenPayload.error || JSON.stringify(tokenPayload);
      return authErrorPage(res, `Failed to obtain access token: ${detail}`);
    }

    const profile = await fetchUser(provider, accessToken);
    const email = profile.email || profile.email_address;
    const name = profile.name || profile.username || profile.login;
    const avatarUrl = profile.avatar_url || profile.picture;

    if (!email) {
      return authErrorPage(res, 'The OAuth provider did not return an email address. Make sure your email is verified and the required scopes are granted.');
    }

    let [user] = await db.select().from(users).where(eq(users.email, email));

    const providerFields = {
      provider,
      providerId: profile.id?.toString() || null,
      providerUsername: (profile.username || profile.login || profile.email || null),
      providerToken: encryptAes(accessToken),
      providerTokenExpiresAt: tokenPayload.expires_in ? new Date(Date.now() + tokenPayload.expires_in * 1000) : null,
    };

    if (!user) {
      user = {
        id: generateId(),
        email,
        name,
        avatarUrl,
        ...providerFields,
        createdAt: new Date(),
      };
      console.debug("New user created : ", user.id + " - " + user.name);
      await db.insert(users).values(user);
    } else {
      console.debug("User already exists : ", user.id + " - " + user.name);
      await db.update(users).set(providerFields).where(eq(users.id, user.id));
    }

    console.debug("User logged in successfully, checking memberships : ", user.id + " - " + user.name);

    // If the user has any membership (super_admin, admin, user), we don't add a duplicate.
    const [existingMembership] = await db.select().from(memberships).where(eq(memberships.userId, user.id));
    
    console.debug("Existing membership for user : ", !!existingMembership);

    if (!existingMembership) {
      // Ensure the 'user' role exists and assign the user membership if needed.
      let [userRole] = await db.select().from(roles).where(eq(roles.name, 'user'));

      console.debug("User role for id : ", userRole?.id + " - " + userRole?.name);

      if (!userRole) {
        const roleId = "role_user_global";
        console.debug("Creating new user role : ", roleId + " - " + 'user');
        await db.insert(roles).values({ id: roleId, name: 'user', scope: 'global' });
        userRole = { id: roleId, name: 'user', scope: 'global' } as any;
      }

      console.debug("Assigning user role to the user : ", user.id + " - " + user.name + " - Role: " + userRole.id + " - " + userRole.name);
      console.debug("Inserting membership attempt with userId=", user.id, "roleId=", userRole.id, "projectId=null");
      await db.insert(memberships).values({ id: generateId(), userId: user.id, roleId: userRole.id, projectId: null, createdAt: new Date() });
    }

    const jwtToken = signJwt(user.id);

    res.redirect(`/app/projects?token=${jwtToken}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred during authentication.';
    return authErrorPage(res, message);
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = req.user;
  const membershipsList = await db.select({ projectId: memberships.projectId, roleId: memberships.roleId }).from(memberships).where(eq(memberships.userId, user.id));
  const rolesData = await Promise.all(membershipsList.map(async (m) => {
    const [r] = await db.select().from(roles).where(eq(roles.id, m.roleId));
    return { projectId: m.projectId, role: r?.name || 'user' };
  }));

  // Resolve global role (membership where projectId IS NULL)
  const globalMembership = rolesData.find(r => r.projectId === null);
  const globalRole = globalMembership?.role ?? 'user';

  res.json({
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    roles: rolesData,
    globalRole,
  });
});

router.post('/pats', authMiddleware, async (req, res) => {
  const requester = req.user;
  const { name, expiresInDays } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const rawToken = `pat_${crypto.randomBytes(24).toString('hex')}`;
  const tokenHash = sha256(rawToken);

  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

  await db.insert(accessTokens).values({
    id: generateId(),
    userId: requester.id,
    name,
    tokenHash,
    expiresAt,
    revoked: 0,
    createdAt: new Date(),
  });

  res.status(201).json({ token: rawToken, expiresAt });
});

router.get('/pats', authMiddleware, async (req, res) => {
  const requester = req.user;
  const tokens = await db.select({ id: accessTokens.id, name: accessTokens.name, expiresAt: accessTokens.expiresAt, revoked: accessTokens.revoked, createdAt: accessTokens.createdAt, lastUsedAt: accessTokens.lastUsedAt }).from(accessTokens).where(eq(accessTokens.userId, requester.id));
  res.json(tokens);
});

router.post('/pats/:id/revoke', authMiddleware, async (req, res) => {
  const requester = req.user;
  const { id } = req.params;
  const [token] = await db.select().from(accessTokens).where(and(eq(accessTokens.id, id), eq(accessTokens.userId, requester.id)));
  if (!token) return res.status(404).json({ error: 'PAT not found' });

  await db.update(accessTokens).set({ revoked: 1 }).where(eq(accessTokens.id, id));
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  // Stateless JWT/PAT logout: client should remove token locally.
  // This endpoint exists for convenience and possible future session revocation.
  return res.json({ success: true });
});

router.get('/config', (req, res) => {
  const providers = [];
  if (process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET) providers.push('gitlab');
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) providers.push('github');
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push('google');

  // localAuthEnabled: only when no OAuth providers are configured AND ALLOW_LOCAL_AUTH is not explicitly false
  const allowLocalAuth = process.env.ALLOW_LOCAL_AUTH !== 'false';
  const localAuthEnabled = allowLocalAuth && providers.length === 0;

  res.json({ providers, localAuthEnabled });
});

/**
 * POST /login/local
 * Passwordless superadmin login — only works when no OAuth providers are configured
 * and ALLOW_LOCAL_AUTH is not explicitly disabled.
 */
router.post('/login/local', async (req, res) => {
  const providers = [];
  if (process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET) providers.push('gitlab');
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) providers.push('github');
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push('google');

  const allowLocalAuth = process.env.ALLOW_LOCAL_AUTH !== 'false';

  if (!allowLocalAuth || providers.length > 0) {
    return res.status(403).json({ error: 'Local login is disabled when OAuth providers are configured' });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, 'superadmin@localhost'));
    if (!user) return res.status(404).json({ error: 'Superadmin user not found' });

    const token = signJwt(user.id);
    return res.json({ token });
  } catch (err) {
    console.error('Local login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
