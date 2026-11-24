import express from "express";
import https from 'node:https';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import bcrypt from 'bcrypt';
import {validateSharedSettings,createWriterLease,originAllowed,createAuthThrottle} from './utils/sharedAccess.js';
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import fs from "node:fs";
import path from "node:path";
import db from "./db/database.js";
import { RESTORE_MARKER_FILE } from "./db/pendingRestore.js";

import authRoutes from "./routes/authRoutes.js";
import passwordResetRoutes from "./routes/passwordResetRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import unitRoutes from "./routes/unitRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import openingStockRoutes from "./routes/openingStockRoutes.js";
import stockAdjustmentRoutes from "./routes/stockAdjustmentRoutes.js";
import formulaRoutes from "./routes/formulaRoutes.js";
import productionRoutes from "./routes/productionRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import customerLedgerRoutes from "./routes/customerLedgerRoutes.js";
import supplierLedgerRoutes from "./routes/supplierLedgerRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import openingBalanceRoutes from "./routes/openingBalanceRoutes.js";
import indiaLocationRoutes from "./routes/indiaLocationRoutes.js";
import investmentRoutes from "./routes/investmentRoutes.js";
import upadRoutes from "./routes/upadRoutes.js";

import { requireAuth, requireAdmin } from "./middleware/authMiddleware.js";
import { runStartupBackup } from "./services/startupBackupService.js";
import { backupSchedule, setBackupSchedule, startBackupSchedule } from "./services/backupScheduleService.js";
import { recordHistory, databaseHealth, formulaPlan, monthlyActivity, recordedLots, batchTrace } from "./services/proWorkspaceService.js";
import { searchWorkspace } from "./services/workspaceSearchService.js";
import {createAmendmentOperations} from "./utils/recordAmendments.js";
import {inventoryOperations} from "./services/advancedInventoryService.js";
import * as management from "./services/managementService.js";
import { initDatabase } from "./db/initDatabase.js";

dotenv.config();

// Included in the desktop payload; no repository-root dependency at runtime.
const appVersion = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const app = express();
const PORT = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === "production";
const shared = isProduction && process.env.RISEORA_SHARED_MODE === '1';
const sharedConfig = shared ? validateSharedSettings(process.env,Object.values(os.networkInterfaces()).flat().filter(Boolean).map(x=>x.address)) : null;
const writer = createWriterLease();
const authThrottle = createAuthThrottle();
const sessionSecret = process.env.SESSION_SECRET ||
  (isProduction ? null : "riseora-development-secret-change-before-production");

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required when NODE_ENV=production.");
}

if(shared){
 app.disable('x-powered-by');
 app.use((req,res,next)=>{
   if(req.headers.host!==new URL(sharedConfig.origin).host)return res.status(400).json({message:'Unexpected host.'});
   res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');res.set('Content-Security-Policy',"frame-ancestors 'none'");
   if(req.path.startsWith('/api/'))res.set('Cache-Control','no-store');
   if(!originAllowed(req.method,req.headers.origin,sharedConfig.origin))return res.status(403).json({message:'Cross-origin writes are not allowed.'});
   next();
 });
}
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  credentials: true,
  exposedHeaders: ["Content-Disposition"],
}));

app.use(express.json({ limit: "1mb" }));

app.use(session({
  name: "riseora.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

await initDatabase();
if(shared){
 const admins=db.prepare("SELECT username,password_hash FROM users WHERE role='ADMIN' AND is_active=1").all();
 if(!admins.length)throw new Error('Create a strong administrator account before starting shared mode.');
 for(const admin of admins)if(await bcrypt.compare('1356',admin.password_hash)||await bcrypt.compare('admin',admin.password_hash))throw new Error('Change default administrator passwords locally before enabling shared access.');
}
if (isProduction) await runStartupBackup();

// Once a restore is scheduled, prevent any additional transactions on the
// old database; otherwise those transactions would disappear after restart.
const pendingRestorePath = path.join(path.dirname(db.name), RESTORE_MARKER_FILE);
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && fs.existsSync(pendingRestorePath)) {
    return res.status(423).json({
      success: false,
      message: 'Database restore is pending. Close and reopen Riseora ERP before posting or editing any records.',
    });
  }
  next();
});

if(shared){
 app.use('/api/auth',(req,res,next)=>{
   if(req.method==='POST'&&['/login','/password-reset/request','/password-reset/confirm'].includes(req.path)&&!authThrottle(req.ip))return res.status(429).json({message:'Too many authentication attempts. Try again later.'});
   if(req.method==='POST'&&req.path==='/logout')writer.release(req.sessionID);
   next();
 });
 app.use('/api',(req,res,next)=>{
   if(['GET','HEAD','OPTIONS'].includes(req.method)||req.path.startsWith('/auth/')||req.path==='/shared/writer/release')return next();
   if(req.path.startsWith('/backups/restore'))return res.status(403).json({message:'Restore is a local server maintenance operation. Shut down shared access before restoring.'});
   const user=req.session?.user;
   const admin=user&&db.prepare("SELECT 1 FROM users WHERE id=? AND username=? AND role='ADMIN' AND is_active=1").get(user.id,user.username);
   if(admin&&!writer.claim(req.sessionID))return res.status(409).json({message:'Another administrator session is writing. Ask it to release access or wait for its 15-minute idle lease. Reload your form before retrying.'});
   next();
 });
 app.get('/api/shared/writer',requireAuth,requireAdmin,(req,res)=>res.json(writer.status(req.sessionID)));
 app.post('/api/shared/writer/release',requireAuth,requireAdmin,(req,res)=>{writer.release(req.sessionID);res.json(writer.status(req.sessionID));});
}
app.get("/api/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Riseora ERP API is running", version: appVersion });
});

app.use("/api/auth", authRoutes);
app.use("/api/auth", passwordResetRoutes);

const adminOnly = [requireAuth, requireAdmin];
app.get("/api/shared/status", ...adminOnly, (_req,res)=>res.json({enabled:shared}));
// Employee access is intentionally read-only and limited to stock quantities.
app.get('/api/viewer/stock', requireAuth, (req,res)=>{
  if(!['VIEWER','ADMIN'].includes(req.session.user.role)) return res.status(403).json({message:'Access denied.'});
  res.json({rows:management.viewerStock()});
});
const manage = (fn) => async (req,res) => {try {res.json(await fn(req));}catch(e){res.status(400).json({message:e.code?.startsWith('SQLITE_CONSTRAINT')?'Duplicate or invalid linked record.':e.message});}};
const amendments=createAmendmentOperations(db);
app.get('/api/manage/amendments/:kind/:id',...adminOnly,manage(req=>({rows:amendments.list(req.params.kind,req.params.id)})));
app.put('/api/manage/amendments/:kind/:id',...adminOnly,manage(req=>amendments.amend(req.params.kind,req.params.id,req.body,req.session.user.id)));
app.get('/api/manage/warehouse',...adminOnly,manage(()=>({rows:inventoryOperations.warehouses(),drafts:inventoryOperations.drafts()})));
app.post('/api/manage/warehouse',...adminOnly,manage(req=>({id:inventoryOperations.createWarehouse(req.body)})));
app.get('/api/manage/inventory/:id',...adminOnly,manage(req=>inventoryOperations.inspect(req.params.id)));
app.post('/api/manage/inventory/:id/enable',...adminOnly,manage(req=>inventoryOperations.enable(req.params.id,req.body)));
app.post('/api/manage/warehouse/transfer',...adminOnly,manage(req=>inventoryOperations.transfer(req.body)));
app.post('/api/manage/reservations/:id',...adminOnly,manage(req=>inventoryOperations.reserveBatch(req.params.id)));
app.delete('/api/manage/reservations/:id',...adminOnly,manage(req=>inventoryOperations.releaseBatch(req.params.id)));
app.get('/api/manage/users',...adminOnly,manage(()=>({rows:management.listUsers()})));
app.post('/api/manage/users',...adminOnly,manage(async req=>({id:await management.createViewer(req.body)})));
app.put('/api/manage/users/:id',...adminOnly,manage(req=>{management.setViewerActive(req.params.id,req.body.active);return {ok:true};}));
app.get('/api/manage/barcodes/:id',...adminOnly,manage(req=>({rows:management.listBarcodes(req.params.id)})));
app.post('/api/manage/barcodes/:id',...adminOnly,manage(req=>{management.addBarcode(req.params.id,req.body.barcode);return {ok:true};}));
app.delete('/api/manage/barcodes/:id',...adminOnly,manage(req=>{management.deleteBarcode(req.params.id);return {ok:true};}));
app.get('/api/manage/specs/:id',...adminOnly,manage(req=>management.formulaSpecs(req.params.id)));
app.put('/api/manage/specs/:id',...adminOnly,manage(req=>management.saveSpecs(req.params.id,req.body)));
app.get('/api/manage/compare',...adminOnly,manage(req=>management.compareRevisions(req.query.left,req.query.right)));
app.get('/api/manage/substitutions/:id',...adminOnly,manage(req=>({rows:management.listSubstitutions(req.params.id)})));
app.post('/api/manage/substitutions/:id',...adminOnly,manage(req=>({id:management.requestSubstitution(req.params.id,req.body,req.session.user.id)})));
app.put('/api/manage/substitutions/:id/review',...adminOnly,manage(req=>{management.reviewSubstitution(req.params.id,req.body,req.session.user.id);return {ok:true};}));
app.get('/api/manage/lot-plan/:id',...adminOnly,manage(req=>management.lotSuggestion(req.params.id,req.query.quantity,req.query.method)));
app.get('/api/manage/report/:type',...adminOnly,manage(req=>({rows:management.customReport(req.params.type)})));


app.get("/api/pro/backup-schedule", ...adminOnly, (_req,res) => res.json(backupSchedule()));
app.put("/api/pro/backup-schedule", ...adminOnly, (req,res) => { try { res.json(setBackupSchedule(req.body.hours)); } catch(e){res.status(400).json({message:e.message});} });
app.get("/api/pro/history", ...adminOnly, (req,res) => res.json({ rows:recordHistory(req.query.entity,req.query.recordId) }));
app.get("/api/pro/health", ...adminOnly, (_req,res) => res.json(databaseHealth()));
app.get("/api/pro/monthly", ...adminOnly, (_req,res) => res.json({ rows:monthlyActivity() }));
app.get("/api/pro/lots/:id", ...adminOnly, (req,res)=>{try{res.json(recordedLots(req.params.id));}catch(e){res.status(400).json({message:e.message});}});
app.get("/api/pro/batch-trace/:id", ...adminOnly, (req,res)=>{try{res.json(batchTrace(req.params.id));}catch(e){res.status(400).json({message:e.message});}});
app.get("/api/pro/formula-plan/:id", ...adminOnly, (req,res) => { try { res.json(formulaPlan(req.params.id,req.query.target)); } catch(e) { res.status(400).json({ message:e.message }); } });
app.get("/api/workspace-search", ...adminOnly, (req, res) => res.json({ success:true, results: searchWorkspace(req.query.q) }));

app.use("/api/company", ...adminOnly, companyRoutes);
app.use("/api/units", ...adminOnly, unitRoutes);
app.use("/api/categories", ...adminOnly, categoryRoutes);
app.use("/api/suppliers", ...adminOnly, supplierRoutes);
app.use("/api/customers", ...adminOnly, customerRoutes);
app.use("/api/items", ...adminOnly, itemRoutes);
app.use("/api/purchases", ...adminOnly, purchaseRoutes);
app.use("/api/stock", ...adminOnly, stockRoutes);
app.use("/api/opening-stock", ...adminOnly, openingStockRoutes);
app.use("/api/stock-adjustments", ...adminOnly, stockAdjustmentRoutes);
app.use("/api/formulas", ...adminOnly, formulaRoutes);
app.use("/api/production", ...adminOnly, productionRoutes);
app.use("/api/sales", ...adminOnly, salesRoutes);
app.use("/api/customer-ledger", ...adminOnly, customerLedgerRoutes);
app.use("/api/supplier-ledger", ...adminOnly, supplierLedgerRoutes);
app.use("/api/dashboard", ...adminOnly, dashboardRoutes);
app.use("/api/reports", ...adminOnly, reportRoutes);
app.use("/api/locations", ...adminOnly, indiaLocationRoutes);
app.use("/api/opening-balances", ...adminOnly, openingBalanceRoutes);
app.use("/api/backups", ...adminOnly, backupRoutes);
app.use("/api/investments", ...adminOnly, investmentRoutes);
app.use("/api/upad", ...adminOnly, upadRoutes);

if(shared){
 const dist=fileURLToPath(new URL('../../client/dist/',import.meta.url));
 app.use('/api',(_req,res)=>res.status(404).json({message:'API route not found.'}));
 app.use(express.static(dist,{index:'index.html'}));
 app.get(/.*/,(_req,res)=>res.sendFile(path.join(dist,'index.html')));
}
app.use((err, req, res, next) => {
  console.error("Unhandled API error:", err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ success: false, message: "Unexpected server error." });
});

if (isProduction || process.env.NODE_ENV === "desktop") startBackupSchedule();

if(shared){
 const server=https.createServer({key:fs.readFileSync(process.env.RISEORA_TLS_KEY),cert:fs.readFileSync(process.env.RISEORA_TLS_CERT),minVersion:'TLSv1.2'},app);
 server.listen(sharedConfig.port,sharedConfig.bind,()=>console.log(`Riseora shared ERP running at ${sharedConfig.origin}`));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close(()=>{db.close();process.exit(0);});});
}else{
 app.listen(PORT, "127.0.0.1", () => {
  console.log(`Riseora ERP server running on http://localhost:${PORT}`);
 });
}
