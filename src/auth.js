import express from 'express';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
const LIFETIME=8*60*60*1000;
export function createAuth(config,csrf){
 const router=express.Router(),sessions=new Map(),attempts=new Map();
 const salt=randomBytes(16);const hash=scryptSync(config.password||'1234',salt,32);
 const token=req=>req.get('cookie')?.match(/(?:^|;\s*)iqi_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 const authenticated=req=>{const id=token(req);return !!id&&(sessions.get(id)||0)>Date.now();};
 router.use((req,res,next)=>{const now=Date.now();for(const [id,expires]of sessions)if(expires<=now)sessions.delete(id);for(const [ip,attempt]of attempts)if(attempt.until<=now)attempts.delete(ip);next();});
 router.get('/auth/session',(req,res)=>res.json({authenticated:authenticated(req),csrf}));
 router.post('/auth/login',(req,res)=>{
  const ip=req.ip;const attempt=attempts.get(ip);
  if(attempt?.count>=5){res.set('Retry-After',String(Math.ceil((attempt.until-Date.now())/1000)));return res.status(429).json({error:'กรอกรหัสผิดหลายครั้ง กรุณารอ 1 นาทีแล้วลองใหม่'});}
  const password=req.body?.password;
  const valid=typeof password==='string'&&password.length<=256&&timingSafeEqual(hash,scryptSync(password,salt,32));
  if(!valid){if(attempt){attempt.count++;if(attempt.count>=5)attempt.until=Date.now()+60000;}else{if(attempts.size>=2000)attempts.delete(attempts.keys().next().value);attempts.set(ip,{count:1,until:Date.now()+60000});}return res.status(401).json({error:'รหัสผ่านไม่ถูกต้อง'});}
  attempts.delete(ip);sessions.delete(token(req));if(sessions.size>=2000)sessions.delete(sessions.keys().next().value);
  const id=randomBytes(32).toString('hex');sessions.set(id,Date.now()+LIFETIME);
  res.cookie('iqi_session',id,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:LIFETIME,path:'/'});res.json({authenticated:true});
 });
 router.post('/auth/logout',(req,res)=>{sessions.delete(token(req));res.clearCookie('iqi_session',{httpOnly:true,sameSite:'strict',secure:req.secure,path:'/'});res.json({authenticated:false});});
 router.use((req,res,next)=>{if(!authenticated(req))return res.status(401).json({error:'กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน'});next();});
 return router;
}
