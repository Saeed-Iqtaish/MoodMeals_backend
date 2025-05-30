import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-client';

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  requestHeaders: {},
  timeout: 30000,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5
});

const getKey = (header) => {
  return new Promise((resolve, reject) => {
    if (!header || !header.kid) {
      return reject(new Error('JWT header missing kid'));
    }

    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        console.error('Error getting signing key:', err);
        return reject(err);
      }
      
      const signingKey = key.publicKey || key.rsaPublicKey;
      
      if (!signingKey) {
        return reject(new Error('Unable to find appropriate signing key'));
      }
      
      resolve(signingKey);
    });
  });
};

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  if (req.query && req.query.token) {
    return req.query.token;
  }
  
  return null;
};

export const checkJwt = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded || !decoded.header) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token could not be decoded'
      });
    }

    const signingKey = await getKey(decoded.header);

    const verified = jwt.verify(token, signingKey, {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256']
    });

    req.user = verified;
    req.auth = verified;
    
    console.log('JWT verified successfully for user:', verified.sub);
    next();

  } catch (error) {
    console.error('JWT verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please log in again'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token verification failed'
      });
    }
    
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Unable to verify token'
    });
  }
};

export const extractUser = (req, res, next) => {
  if (req.user) {
    console.log('Authenticated user:', {
      sub: req.user.sub,
      email: req.user.email,
      name: req.user.name
    });
  }
  next();
};