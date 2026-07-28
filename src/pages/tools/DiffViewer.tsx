import { diffLines } from 'diff'
import { useMemo, useState } from 'react'

import './DiffViewer.css'

export default function DiffViewer() {
  const [original, setOriginal] = useState('这是原始文本。\n修改或者删除这些内容来查看高亮变化。')
  const [modified, setModified] = useState('这是修改后的文本。\n修改或者删除这些内容来查看高亮变化。\n新增加的一行！')
  const changes = useMemo(() => diffLines(original, modified), [modified, original])

  return (
    <div className="page-container diff-page">
      <div className="header">
        <h1>文本 / 代码 Diff 对比</h1>
        <p>逐行对比完全在浏览器本地完成，不会上传输入内容。</p>
      </div>

      <div className="diff-input-grid">
        <label className="diff-field">
          <span>原始文本</span>
          <textarea
            className="form-control diff-input"
            value={original}
            onChange={(event) => setOriginal(event.target.value)}
            spellCheck={false}
          />
        </label>
        <label className="diff-field">
          <span>修改文本</span>
          <textarea
            className="form-control diff-input"
            value={modified}
            onChange={(event) => setModified(event.target.value)}
            spellCheck={false}
          />
        </label>
      </div>

      <section className="diff-result" aria-labelledby="diff-result-title">
        <div className="diff-result-header">
          <h2 id="diff-result-title">行级差异</h2>
          <span><b className="diff-legend-added">+</b> 新增　<b className="diff-legend-removed">−</b> 删除</span>
        </div>
        <pre className="diff-code" tabIndex={0} aria-label="行级差异结果">
          <code>
            {changes.map((change, changeIndex) => {
              const kind = change.added ? 'added' : change.removed ? 'removed' : 'same'
              const marker = change.added ? '+' : change.removed ? '−' : ' '
              const lines = change.value.split('\n')

              return lines.map((line, lineIndex) => {
                if (lineIndex === lines.length - 1 && line === '') return null
                return (
                  <span className={`diff-line diff-line-${kind}`} key={`${changeIndex}-${lineIndex}`}>
                    <span className="diff-marker" aria-hidden="true">{marker}</span>
                    {line || ' '}{'\n'}
                  </span>
                )
              })
            })}
          </code>
        </pre>
      </section>
    </div>
  )
}
