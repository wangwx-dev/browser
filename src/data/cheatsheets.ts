export interface CommandItem {
  cmd: string;
  desc: string;
}

export interface CheatsheetCategory {
  title: string;
  items: CommandItem[];
}

export interface Cheatsheet {
  id: string;
  name: string;
  categories: CheatsheetCategory[];
}

export const CHEATSHEETS_DATA: Cheatsheet[] = [
  {
    id: 'linux',
    name: 'Linux / Unix',
    categories: [
      {
        title: '文件与目录 (File & Directory)',
        items: [
          { cmd: 'ls -la', desc: '列出全部文件及详细信息（包括隐藏文件）' },
          { cmd: 'pwd', desc: '显示当前所在目录的绝对路径' },
          { cmd: 'mkdir -p a/b/c', desc: '递归创建多级目录' },
          { cmd: 'rm -rf <dir>', desc: '强制并递归删除目录及内容 (慎用)' },
          { cmd: 'cp -r <src> <dest>', desc: '递归复制目录' },
          { cmd: 'mv <src> <dest>', desc: '移动文件或重命名' },
          { cmd: 'find . -name "*.txt"', desc: '在当前目录下查找特定后缀的文件' },
          { cmd: 'tar -czvf arc.tar.gz dir', desc: '将目录打包并使用 gzip 压缩' },
          { cmd: 'tar -xzvf arc.tar.gz', desc: '解压 gzip 压缩包' },
          { cmd: 'chmod 755 <file>', desc: '修改文件权限为 rwxr-xr-x' },
          { cmd: 'chown user:group <file>', desc: '修改文件所有者和所属组' }
        ]
      },
      {
        title: '进程与系统 (Process & System)',
        items: [
          { cmd: 'top / htop', desc: '实时显示系统资源与进程占用情况' },
          { cmd: 'ps aux | grep <name>', desc: '查找指定名称的进程' },
          { cmd: 'kill -9 <pid>', desc: '强制结束指定 PID 的进程' },
          { cmd: 'df -h', desc: '查看磁盘分区及空间使用情况 (人类可读格式)' },
          { cmd: 'du -sh *', desc: '查看当前目录下各文件/文件夹的大小' },
          { cmd: 'free -m', desc: '查看内存使用情况 (MB)' },
          { cmd: 'uname -a', desc: '查看系统内核信息' },
          { cmd: 'journalctl -xe', desc: '查看 Systemd 系统日志' }
        ]
      },
      {
        title: '网络 (Network)',
        items: [
          { cmd: 'ping <host>', desc: '测试网络连通性' },
          { cmd: 'curl -O <url>', desc: '下载文件并保持原文件名' },
          { cmd: 'curl -I <url>', desc: '仅获取 HTTP 响应头信息' },
          { cmd: 'netstat -tulpn', desc: '查看当前系统中监听的端口及所属进程' },
          { cmd: 'lsof -i :8080', desc: '查看占用 8080 端口的进程' },
          { cmd: 'scp <file> user@host:/path', desc: '通过 SSH 安全复制文件到远程主机' }
        ]
      }
    ]
  },
  {
    id: 'git',
    name: 'Git',
    categories: [
      {
        title: '基础配置与初始化',
        items: [
          { cmd: 'git config --global user.name "Name"', desc: '全局配置提交者姓名' },
          { cmd: 'git config --global user.email "Email"', desc: '全局配置提交者邮箱' },
          { cmd: 'git init', desc: '在当前目录初始化新的 Git 仓库' },
          { cmd: 'git clone <url>', desc: '克隆远程仓库到本地' }
        ]
      },
      {
        title: '日常提交 (Commit)',
        items: [
          { cmd: 'git status', desc: '查看工作区与暂存区状态' },
          { cmd: 'git add .', desc: '将所有改动添加到暂存区' },
          { cmd: 'git commit -m "msg"', desc: '提交暂存区的内容并附加信息' },
          { cmd: 'git commit --amend', desc: '修改最后一次提交的信息或补充改动' }
        ]
      },
      {
        title: '分支与合并 (Branching)',
        items: [
          { cmd: 'git branch', desc: '列出所有本地分支' },
          { cmd: 'git checkout -b <name>', desc: '创建并立即切换到新分支' },
          { cmd: 'git merge <branch>', desc: '将指定分支合并到当前分支' },
          { cmd: 'git rebase <branch>', desc: '将当前分支的提交变基到指定分支' },
          { cmd: 'git branch -d <branch>', desc: '安全删除已合并的本地分支' }
        ]
      },
      {
        title: '远程交互 (Remote)',
        items: [
          { cmd: 'git remote -v', desc: '查看绑定的远程仓库地址' },
          { cmd: 'git fetch', desc: '仅拉取远程最新信息，不自动合并' },
          { cmd: 'git pull origin main', desc: '拉取远程 main 分支并自动合并' },
          { cmd: 'git push origin main', desc: '推送当前本地提交到远程 main 分支' },
          { cmd: 'git push -f origin main', desc: '强制推送到远程（慎用，会覆盖远程记录）' }
        ]
      },
      {
        title: '撤销与回退 (Undo)',
        items: [
          { cmd: 'git restore <file>', desc: '丢弃工作区中特定文件的修改' },
          { cmd: 'git reset --soft HEAD~1', desc: '撤销上一次 commit，但保留代码改动' },
          { cmd: 'git reset --hard HEAD', desc: '彻底抛弃所有未提交的改动' },
          { cmd: 'git revert <commit>', desc: '生成一个新的提交来反转指定的历史提交' },
          { cmd: 'git stash', desc: '将当前工作区改动临时储藏起来' },
          { cmd: 'git stash pop', desc: '恢复最近一次储藏的改动并从储藏列表中移除' }
        ]
      }
    ]
  },
  {
    id: 'docker',
    name: 'Docker',
    categories: [
      {
        title: '镜像管理 (Images)',
        items: [
          { cmd: 'docker images', desc: '列出本地所有镜像' },
          { cmd: 'docker pull <image>', desc: '从仓库拉取镜像' },
          { cmd: 'docker build -t <name> .', desc: '使用当前目录的 Dockerfile 构建镜像' },
          { cmd: 'docker rmi <image>', desc: '删除本地指定的镜像' },
          { cmd: 'docker image prune', desc: '清理未被任何容器使用的悬空(dangling)镜像' }
        ]
      },
      {
        title: '容器管理 (Containers)',
        items: [
          { cmd: 'docker ps', desc: '列出当前正在运行的容器' },
          { cmd: 'docker ps -a', desc: '列出所有容器（包括已停止的）' },
          { cmd: 'docker run -d -p 80:80 <image>', desc: '后台运行容器并映射端口' },
          { cmd: 'docker exec -it <id> /bin/bash', desc: '进入正在运行的容器终端' },
          { cmd: 'docker stop <id>', desc: '优雅停止指定的容器' },
          { cmd: 'docker rm <id>', desc: '删除已停止的容器' },
          { cmd: 'docker rm -f <id>', desc: '强制停止并删除容器' },
          { cmd: 'docker logs -f <id>', desc: '实时查看容器的输出日志' }
        ]
      },
      {
        title: '网络与系统 (Network & System)',
        items: [
          { cmd: 'docker network ls', desc: '列出所有 Docker 网络' },
          { cmd: 'docker inspect <id>', desc: '查看容器或镜像的详细配置信息 (JSON)' },
          { cmd: 'docker system df', desc: '查看 Docker 磁盘使用情况' },
          { cmd: 'docker system prune -a', desc: '清理所有未使用的数据(镜像、容器、网络)' }
        ]
      }
    ]
  },
  {
    id: 'k8s',
    name: 'Kubernetes (kubectl)',
    categories: [
      {
        title: '集群与上下文',
        items: [
          { cmd: 'kubectl cluster-info', desc: '查看集群基本信息' },
          { cmd: 'kubectl config get-contexts', desc: '列出所有可用的 kubeconfig 上下文' },
          { cmd: 'kubectl config use-context <name>', desc: '切换到指定的集群上下文' }
        ]
      },
      {
        title: '资源查看 (Get & Describe)',
        items: [
          { cmd: 'kubectl get pods -n <ns>', desc: '列出指定命名空间下的所有 Pods' },
          { cmd: 'kubectl get pods -A', desc: '列出所有命名空间下的 Pods' },
          { cmd: 'kubectl get svc', desc: '列出当前命名空间下的所有 Services' },
          { cmd: 'kubectl describe pod <name>', desc: '查看某个 Pod 的详细信息与事件 (Events)' }
        ]
      },
      {
        title: '操作与调试 (Exec & Logs)',
        items: [
          { cmd: 'kubectl logs -f <pod_name>', desc: '实时查看 Pod 的日志' },
          { cmd: 'kubectl exec -it <pod> -- sh', desc: '进入 Pod 的交互式终端' },
          { cmd: 'kubectl port-forward svc/<svc> 8080:80', desc: '将本地 8080 端口转发到集群内 Service 的 80 端口' },
          { cmd: 'kubectl apply -f file.yaml', desc: '应用 YAML 文件中的资源定义' },
          { cmd: 'kubectl delete -f file.yaml', desc: '删除 YAML 文件中定义的资源' },
          { cmd: 'kubectl rollout restart deploy <name>', desc: '重启指定 Deployment 中的所有 Pod' }
        ]
      }
    ]
  },
  {
    id: 'npm',
    name: 'Npm / Yarn / Pnpm',
    categories: [
      {
        title: 'Npm',
        items: [
          { cmd: 'npm init -y', desc: '快速初始化 package.json' },
          { cmd: 'npm install <pkg>', desc: '安装依赖到 dependencies' },
          { cmd: 'npm install -D <pkg>', desc: '安装依赖到 devDependencies' },
          { cmd: 'npm uninstall <pkg>', desc: '卸载指定依赖' },
          { cmd: 'npm run <script>', desc: '执行 package.json 中定义的脚本' },
          { cmd: 'npm cache clean --force', desc: '强制清理本地 npm 缓存' }
        ]
      },
      {
        title: 'Yarn',
        items: [
          { cmd: 'yarn init -y', desc: '快速初始化 package.json' },
          { cmd: 'yarn add <pkg>', desc: '安装依赖' },
          { cmd: 'yarn add -D <pkg>', desc: '安装开发环境依赖' },
          { cmd: 'yarn remove <pkg>', desc: '移除依赖' },
          { cmd: 'yarn <script>', desc: '执行脚本 (可以省略 run)' }
        ]
      },
      {
        title: 'Pnpm',
        items: [
          { cmd: 'pnpm init', desc: '初始化项目' },
          { cmd: 'pnpm add <pkg>', desc: '安装依赖并利用硬链接极速缓存' },
          { cmd: 'pnpm store prune', desc: '清理未被引用的包缓存释放空间' }
        ]
      }
    ]
  },
  {
    id: 'windows',
    name: 'Windows (CMD/PS)',
    categories: [
      {
        title: '基础文件系统',
        items: [
          { cmd: 'dir / sl', desc: '列出当前目录文件 (CMD / PS)' },
          { cmd: 'mkdir <dir> / md <dir>', desc: '创建文件夹' },
          { cmd: 'rmdir /s /q <dir>', desc: '强制无提示递归删除目录 (CMD)' },
          { cmd: 'Remove-Item -Recurse -Force <dir>', desc: '强制递归删除目录 (PowerShell)' }
        ]
      },
      {
        title: '系统与进程',
        items: [
          { cmd: 'tasklist', desc: '查看运行中的进程列表' },
          { cmd: 'taskkill /F /PID <pid>', desc: '强制结束进程 (通过 PID)' },
          { cmd: 'taskkill /F /IM <name.exe>', desc: '强制结束进程 (通过进程名)' },
          { cmd: 'Get-Process', desc: '列出进程 (PowerShell 专属)' }
        ]
      },
      {
        title: '网络',
        items: [
          { cmd: 'ipconfig /all', desc: '查看详细的网络适配器配置' },
          { cmd: 'ipconfig /flushdns', desc: '清除本地 DNS 缓存' },
          { cmd: 'netstat -ano', desc: '查看所有端口及对应进程的 PID' },
          { cmd: 'Test-NetConnection -ComputerName <ip> -Port <port>', desc: '测试特定端口的连通性 (PowerShell)' }
        ]
      }
    ]
  },
  {
    id: 'vim',
    name: 'Vim / Vi',
    categories: [
      {
        title: '模式切换',
        items: [
          { cmd: 'i', desc: '进入插入模式 (Insert mode) - 光标前' },
          { cmd: 'a', desc: '进入插入模式 - 光标后' },
          { cmd: 'o', desc: '在当前行下方新开一行并进入插入模式' },
          { cmd: 'ESC', desc: '回到正常模式 (Normal mode)' },
          { cmd: 'v', desc: '进入可视模式 (Visual mode) 进行文本选择' }
        ]
      },
      {
        title: '移动与光标',
        items: [
          { cmd: 'h / j / k / l', desc: '左 / 下 / 上 / 右 移动光标' },
          { cmd: 'gg', desc: '跳到文件第一行' },
          { cmd: 'G', desc: '跳到文件最后一行' },
          { cmd: '0 / ^ / $', desc: '跳到行首 / 行首非空字符 / 行尾' },
          { cmd: 'w / b', desc: '向后跳一个单词 / 向前跳一个单词' }
        ]
      },
      {
        title: '编辑与操作',
        items: [
          { cmd: 'dd', desc: '剪切(删除)当前行' },
          { cmd: 'yy', desc: '复制当前行' },
          { cmd: 'p / P', desc: '在光标后/光标前粘贴' },
          { cmd: 'u', desc: '撤销上一步操作' },
          { cmd: 'Ctrl + r', desc: '重做(取消撤销)' }
        ]
      },
      {
        title: '查找与替换',
        items: [
          { cmd: '/pattern', desc: '向下查找 pattern，按 n 找下一个，N 找上一个' },
          { cmd: '?pattern', desc: '向上查找 pattern' },
          { cmd: ':%s/old/new/g', desc: '全局替换文件中的 old 为 new' },
          { cmd: ':%s/old/new/gc', desc: '全局替换并在每次替换前要求确认' }
        ]
      },
      {
        title: '保存与退出',
        items: [
          { cmd: ':w', desc: '保存修改' },
          { cmd: ':q', desc: '退出 (没有修改时)' },
          { cmd: ':wq / :x', desc: '保存并退出' },
          { cmd: ':q!', desc: '强制退出，放弃修改' }
        ]
      }
    ]
  }
];
