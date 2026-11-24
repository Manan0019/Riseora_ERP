import db from '../db/database.js';
import { withAuditActor } from '../utils/auditContext.js';
export function requireAuth(req,res,next) {
  const sessionUser=req.session?.user;
  const user=sessionUser && db.prepare('SELECT id,username,full_name,role FROM users WHERE id=? AND is_active=1').get(sessionUser.id);
  if(!user || user.username!==sessionUser.username){if(req.session) delete req.session.user;return res.status(401).json({success:false,message:'Authentication required'});}
  req.session.user={id:user.id,username:user.username,fullName:user.full_name,role:user.role};
  return withAuditActor(req.session.user,next);
}
export function requireAdmin(req,res,next) {
  if(!req.session?.user) return res.status(401).json({success:false,message:'Authentication required'});
  if(req.session.user.role!=='ADMIN') return res.status(403).json({success:false,message:'Administrator access required'});
  next();
}
