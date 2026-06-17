import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const fsRouter = Router();

export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface FsListResult {
  path: string;
  parent: string | null;
  /** 是否为根（无父目录可上溯）。 */
  isRoot: boolean;
  home: string;
  entries: FsEntry[];
}

/**
 * 浏览本机目录。仅供本地开发壳使用——后端跑在用户机器上，
 * 前端（含手机）看不到机器文件系统，故由后端列目录返回绝对路径。
 *
 * GET /api/fs/list?path=/abs/dir
 * - path 省略或不存在 → 回落 home 目录
 * - 默认只回目录（dirsOnly=false 时也带文件，前端可灰显）
 */
fsRouter.get("/list", async (req, res) => {
  const home = os.homedir();
  const dirsOnly = req.query.dirsOnly !== "false";
  let target = typeof req.query.path === "string" && req.query.path.trim() ? req.query.path.trim() : home;
  target = path.resolve(target);

  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    // 路径不存在/不可读 → 回落 home
    target = home;
  }
  if (stat && !stat.isDirectory()) {
    target = path.dirname(target);
  }

  let dirents;
  try {
    dirents = await fs.readdir(target, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return res.status(code === "EACCES" ? 403 : 400).json({
      error: "read_failed",
      path: target,
      message: code === "EACCES" ? "无权限读取该目录" : "无法读取该目录",
    });
  }

  const entries: FsEntry[] = dirents
    .filter((d) => !d.name.startsWith(".")) // 隐藏点文件/目录
    .map((d) => {
      // 解析符号链接的目录性：尽量识别指向目录的软链
      const isDir = d.isDirectory() || d.isSymbolicLink();
      return { name: d.name, path: path.join(target, d.name), isDir };
    })
    .filter((e) => (dirsOnly ? e.isDir : true))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const parent = path.dirname(target);
  const result: FsListResult = {
    path: target,
    parent: parent === target ? null : parent,
    isRoot: parent === target,
    home,
    entries,
  };
  res.json(result);
});
