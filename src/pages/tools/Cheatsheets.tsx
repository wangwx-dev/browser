import { useState } from 'react';

const CHEATSHEETS = {
  git: `
# Git 常用命令

## 基本操作
git init                    # 初始化仓库
git clone <url>             # 克隆远程仓库
git status                  # 查看状态
git add .                   # 暂存所有更改
git commit -m "msg"         # 提交更改
git push origin main        # 推送到远程 main 分支
git pull                    # 拉取远程更改

## 分支管理
git branch                  # 列出所有本地分支
git branch -a               # 列出所有本地和远程分支
git checkout -b <branch>    # 创建并切换到新分支
git merge <branch>          # 合并指定分支到当前分支
git branch -d <branch>      # 删除分支

## 回滚与撤销
git reset --hard HEAD       # 抛弃工作区和暂存区的所有修改
git reset --soft HEAD~1     # 撤销上一次 commit，保留代码更改
git revert <commit>         # 生成一个新提交来撤销指定提交
git checkout -- <file>      # 丢弃工作区中特定文件的修改
  `,
  linux: `
# Linux 常用命令

## 文件与目录
ls -la                      # 列出包含隐藏文件的详细信息
cd /path                    # 切换目录
pwd                         # 显示当前路径
mkdir -p a/b/c              # 递归创建目录
rm -rf <dir>                # 强制递归删除目录
cp -r <src> <dest>          # 递归复制
mv <src> <dest>             # 移动/重命名文件或目录

## 进程与系统
top / htop                  # 查看系统资源和进程
ps aux | grep <name>        # 查找特定进程
kill -9 <pid>               # 强制杀死进程
df -h                       # 查看磁盘可用空间
free -m                     # 查看内存使用情况
tail -f <file>              # 实时查看日志文件末尾

## 网络
ping <host>                 # 测试网络连通性
curl -O <url>               # 下载文件
netstat -tulpn              # 查看端口占用
  `,
  windows: `
# Windows (PowerShell/CMD) 常用命令

## 基础命令
dir / ls                    # 列出目录内容
cd / sl                     # 改变当前目录
mkdir / md                  # 创建目录
del / rm                    # 删除文件
rmdir /s /q <dir>           # 强制递归删除目录 (CMD)
Remove-Item -Recurse -Force <dir> # 强制递归删除目录 (PowerShell)

## 网络排查
ipconfig /all               # 查看网络配置
ping <host>                 # 测试连通性
tracert <host>              # 路由追踪
netstat -ano                # 查看端口及对应的 PID
Test-NetConnection -ComputerName <host> -Port <port> # 测试端口连通性 (PowerShell)

## 系统与进程
tasklist                    # 列出所有进程
taskkill /F /PID <pid>      # 强制结束指定进程
Get-Process                 # 列出进程 (PowerShell)
Stop-Process -Id <pid>      # 结束进程 (PowerShell)
  `,
  http: `
# HTTP 状态码速查

## 2xx (成功)
200 OK                      # 请求成功
201 Created                 # 资源被成功创建
204 No Content              # 请求成功，但无返回内容

## 3xx (重定向)
301 Moved Permanently       # 永久重定向
302 Found                   # 临时重定向
304 Not Modified            # 资源未修改，使用缓存

## 4xx (客户端错误)
400 Bad Request             # 请求参数有误或语法错误
401 Unauthorized            # 未授权，需登录
403 Forbidden               # 拒绝访问，权限不足
404 Not Found               # 资源不存在
405 Method Not Allowed      # 请求方法不被允许
429 Too Many Requests       # 请求过于频繁

## 5xx (服务器错误)
500 Internal Server Error   # 服务器内部错误
502 Bad Gateway             # 网关错误
503 Service Unavailable     # 服务不可用（超载或停机维护）
504 Gateway Timeout         # 网关超时
  `
};

export default function Cheatsheets() {
  const [activeTab, setActiveTab] = useState<'git' | 'linux' | 'windows' | 'http'>('git');

  return (
    <div className="page-container">
      <div className="header">
        <h1>命令备忘录 (Cheatsheets)</h1>
      </div>

      <div className="tool-card">
        <div className="button-group" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
          <button className={`btn ${activeTab === 'git' ? '' : 'btn-secondary'}`} onClick={() => setActiveTab('git')}>Git</button>
          <button className={`btn ${activeTab === 'linux' ? '' : 'btn-secondary'}`} onClick={() => setActiveTab('linux')}>Linux</button>
          <button className={`btn ${activeTab === 'windows' ? '' : 'btn-secondary'}`} onClick={() => setActiveTab('windows')}>Windows</button>
          <button className={`btn ${activeTab === 'http' ? '' : 'btn-secondary'}`} onClick={() => setActiveTab('http')}>HTTP 状态码</button>
        </div>
        
        <div className="result-box" style={{ marginTop: '1.5rem', minHeight: '400px', fontSize: '0.95rem' }}>
          {CHEATSHEETS[activeTab].trim()}
        </div>
      </div>
    </div>
  );
}
